import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/api/_lib/auth";
import { validateEmail } from "@/app/api/_lib/request";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;

    const forbidden = requireAdmin(authResult.account);
    if (forbidden) return forbidden;

    const serviceRole = serviceRoleHeaders();
    if (!serviceRole) {
      console.error("Staff update misconfigured: missing service role");
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const { id } = await params;

    const bodyResult = await parseJsonBody<{ name: unknown; email: unknown; role: unknown }>(request);
    if (!bodyResult.ok) return NextResponse.json({ error: bodyResult.error }, { status: 400 });

    const { name, email, role } = bodyResult.data;

    if (typeof name !== "string" || typeof email !== "string" || typeof role !== "string") {
      return NextResponse.json(
        { error: "Name, email, and role are required" },
        { status: 400 },
      );
    }

    const trimmedName = name.trim();
    const trimmedEmail = validateEmail(email);
    const trimmedRole = role.trim();

    if (!trimmedName || !trimmedEmail || !trimmedRole) {
      return NextResponse.json(
        { error: "Name, email, and role are required" },
        { status: 400 },
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    // Load the staff record to find its current email and linked account.
    const staffRes = await fetch(
      `${serviceRole.url}/rest/v1/support_staff?select=*&id=eq.${encodeURIComponent(id)}`,
      {
        method: "GET",
        headers: serviceRole.headers,
      },
    );

    if (!staffRes.ok) {
      const staffError = await staffRes.text();
      console.error("Failed to load staff:", staffError);
      return NextResponse.json(
        { error: "Failed to load staff record" },
        { status: 500 },
      );
    }

    const staffRows = await staffRes.json();
    const staff = staffRows?.[0];
    if (!staff) {
      return NextResponse.json(
        { error: "Staff member not found" },
        { status: 404 },
      );
    }

    const oldEmail = String(staff.email ?? "");
    const oldName = String(staff.name ?? "");
    const oldRole = String(staff.role ?? "");

    // Find the account linked to this staff member via email.
    const accountRes = await fetch(
      `${serviceRole.url}/rest/v1/accounts?select=user_id&email=eq.${encodeURIComponent(oldEmail)}&role=eq.support`,
      {
        method: "GET",
        headers: serviceRole.headers,
      },
    );

    if (!accountRes.ok) {
      const accountError = await accountRes.text();
      console.error("Failed to load account:", accountError);
      return NextResponse.json(
        { error: "Failed to load account record" },
        { status: 500 },
      );
    }

    const accountRows = await accountRes.json();
    const accountRow = accountRows?.[0];
    const userId = String(accountRow?.user_id ?? "");

    if (!userId) {
      return NextResponse.json(
        { error: "Staff member is not linked to an account" },
        { status: 500 },
      );
    }

    const authHeaders = {
      ...serviceRole.headers,
    };

    const restHeaders = {
      ...serviceRole.headers,
    };

    // 1. Update the auth user (login identity = email).
    const authUpdateRes = await fetch(
      `${serviceRole.url}/auth/v1/admin/users/${userId}`,
      {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({
          email: trimmedEmail,
          email_confirm: true,
          user_metadata: { name: trimmedName, role: "support" },
        }),
      },
    );

    if (!authUpdateRes.ok) {
      const authData = await authUpdateRes.json();
      console.error("Supabase auth error:", authData);
      return NextResponse.json(
        { error: "Failed to update auth user" },
        { status: 400 },
      );
    }

    // 2. Update support_staff.
    const staffUpdateRes = await fetch(
      `${serviceRole.url}/rest/v1/support_staff?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: restHeaders,
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          role: trimmedRole,
          avatar: getInitials(trimmedName),
        }),
      },
    );

    if (!staffUpdateRes.ok) {
      const staffError = await staffUpdateRes.text();
      console.error("Failed to update staff:", staffError);

      // Rollback auth user to previous values.
      await fetch(
        `${serviceRole.url}/auth/v1/admin/users/${userId}`,
        {
          method: "PUT",
          headers: authHeaders,
          body: JSON.stringify({
            email: oldEmail,
            email_confirm: true,
            user_metadata: { name: oldName, role: oldRole },
          }),
        },
      ).catch((err) => console.error("Rollback auth user failed:", err));

      return NextResponse.json(
        { error: "Failed to update staff record" },
        { status: 500 },
      );
    }

    // 3. Update accounts.
    const accountUpdateRes = await fetch(
      `${serviceRole.url}/rest/v1/accounts?user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: "PATCH",
        headers: restHeaders,
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          avatar: getInitials(trimmedName),
        }),
      },
    );

    if (!accountUpdateRes.ok) {
      const accountError = await accountUpdateRes.text();
      console.error("Failed to update account:", accountError);

      // Rollback support_staff.
      await fetch(
        `${serviceRole.url}/rest/v1/support_staff?id=eq.${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: restHeaders,
          body: JSON.stringify({
            name: oldName,
            email: oldEmail,
            role: oldRole,
            avatar: staff.avatar,
          }),
        },
      ).catch((err) => console.error("Rollback staff failed:", err));

      // Rollback auth user.
      await fetch(
        `${serviceRole.url}/auth/v1/admin/users/${userId}`,
        {
          method: "PUT",
          headers: authHeaders,
          body: JSON.stringify({
            email: oldEmail,
            email_confirm: true,
            user_metadata: { name: oldName, role: oldRole },
          }),
        },
      ).catch((err) => console.error("Rollback auth user failed:", err));

      return NextResponse.json(
        { error: "Failed to update account record" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      staff: {
        id,
        name: trimmedName,
        email: trimmedEmail,
        role: trimmedRole,
        avatar: getInitials(trimmedName),
        active: true,
      },
    });
  } catch (error) {
    console.error("Update staff error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function requireAdmin(account: { role: string }): NextResponse | null {
  if (account.role !== "admin" && account.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

function serviceRoleHeaders() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return null;
  }

  return {
    url: supabaseUrl,
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: "return=representation",
    },
  };
}

async function parseJsonBody<T = unknown>(
  request: NextRequest,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const data = (await request.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Invalid JSON body" };
  }
}
