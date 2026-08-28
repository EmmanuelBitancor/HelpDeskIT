import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { staffWelcomeEmail } from "@/lib/email-templates";
import { requireAuth } from "@/app/api/_lib/auth";
import { validateEmail } from "@/app/api/_lib/request";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;

    const forbidden = requireAdmin(authResult.account);
    if (forbidden) return forbidden;

    const serviceRole = serviceRoleHeaders();
    if (!serviceRole) {
      console.error("Staff misconfigured: missing service role");
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const bodyResult = await parseJsonBody<{
      name: unknown;
      email: unknown;
      password: unknown;
      role: unknown;
      generatePassword?: unknown;
    }>(request);
    if (!bodyResult.ok) return NextResponse.json({ error: bodyResult.error }, { status: 400 });

    const { name, email, password, role, generatePassword } = bodyResult.data;

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

    if (trimmedName.length > 100 || trimmedRole.length > 100 || trimmedEmail.length > 254) {
      return NextResponse.json(
        { error: "Name, email, or role is too long" },
        { status: 400 },
      );
    }

    let resolvedPassword: string;
    if (generatePassword === true) {
      if (typeof password !== "undefined" && (typeof password !== "string" || password.length < 8)) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters" },
          { status: 400 },
        );
      }
      resolvedPassword = crypto.randomUUID();
    } else {
      if (typeof password !== "string" || password.length < 8) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters" },
          { status: 400 },
        );
      }
      resolvedPassword = password;
    }

    const id = `staff-${Date.now()}`;

    const authRes = await fetch(`${serviceRole.url}/auth/v1/admin/users`, {
      method: "POST",
      headers: serviceRole.headers,
      body: JSON.stringify({
        email: trimmedEmail,
        password: resolvedPassword,
        email_confirm: true,
        user_metadata: { name: trimmedName, role: "support" },
      }),
    });

    const authData = await authRes.json();

    if (!authRes.ok) {
      console.error("Supabase auth error:", authData);
      return NextResponse.json(
        { error: "Failed to create auth user" },
        { status: 400 },
      );
    }

    const userId = authData.id || authData.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Failed to create auth user: missing user id" },
        { status: 500 },
      );
    }

    const initials = getInitials(trimmedName);

    const staffRes = await fetch(`${serviceRole.url}/rest/v1/support_staff`, {
      method: "POST",
      headers: serviceRole.headers,
      body: JSON.stringify({
        id,
        name: trimmedName,
        email: trimmedEmail,
        role: trimmedRole,
        avatar: initials,
        active: true,
      }),
    });

    if (!staffRes.ok) {
      const staffError = await staffRes.text();
      console.error("Failed to create staff:", staffError);

      await fetch(`${serviceRole.url}/auth/v1/admin/users/${userId}`, {
        method: "DELETE",
        headers: serviceRole.headers,
      });

      return NextResponse.json(
        { error: "Failed to create staff record" },
        { status: 500 },
      );
    }

    const accountRes = await fetch(`${serviceRole.url}/rest/v1/accounts`, {
      method: "POST",
      headers: serviceRole.headers,
      body: JSON.stringify({
        id: crypto.randomUUID(),
        user_id: userId,
        name: trimmedName,
        email: trimmedEmail,
        role: "support",
        status: "active",
        avatar: initials,
      }),
    });

    if (!accountRes.ok) {
      const accountError = await accountRes.text();
      console.error("Failed to create account:", accountError);

      // Rollback support_staff
      await fetch(
        `${serviceRole.url}/rest/v1/support_staff?id=eq.${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: serviceRole.headers,
        },
      );

      // Rollback auth user
      await fetch(`${serviceRole.url}/auth/v1/admin/users/${userId}`, {
        method: "DELETE",
        headers: serviceRole.headers,
      });

      return NextResponse.json(
        { error: "Failed to create staff account" },
        { status: 500 },
      );
    }

    const templates = staffWelcomeEmail({ name: trimmedName, email: trimmedEmail });
    sendEmail({
      to: trimmedEmail,
      subject: templates.subject,
      html: templates.html,
      text: templates.text,
    }).catch((err) => console.error("Staff welcome email failed:", err));

    return NextResponse.json({
      success: true,
      staff: { id, name: trimmedName, email: trimmedEmail, role: trimmedRole, avatar: initials, active: true },
    });
  } catch (error) {
    console.error("Create staff error:", error);
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
