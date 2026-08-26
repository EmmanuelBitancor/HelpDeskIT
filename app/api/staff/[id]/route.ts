import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, email, role } = body;

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof role !== "string"
    ) {
      return NextResponse.json(
        { error: "Name, email, and role are required" },
        { status: 400 }
      );
    }

    if (!name.trim() || !email.trim() || !role.trim()) {
      return NextResponse.json(
        { error: "Name, email, and role are required" },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, {
        status: 400
      });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!account || (account.role !== "admin" && account.role !== "superadmin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceRoleKey || !supabaseUrl) {
      const missing = !serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : "NEXT_PUBLIC_SUPABASE_URL";
      console.error(`Staff update misconfigured: missing ${missing}`);
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 }
      );
    }

    // Load the staff record to find its current email and linked account.
    const staffRes = await fetch(
      `${supabaseUrl}/rest/v1/support_staff?select=*&id=eq.${encodeURIComponent(id)}`,
      {
        method: "GET",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    );

    if (!staffRes.ok) {
      const staffError = await staffRes.text();
      console.error("Failed to load staff:", staffError);
      return NextResponse.json(
        { error: "Failed to load staff record" },
        { status: 500 }
      );
    }

    const staffRows = await staffRes.json();
    const staff = staffRows?.[0];
    if (!staff) {
      return NextResponse.json(
        { error: "Staff member not found" },
        { status: 404 }
      );
    }

    const oldEmail = String(staff.email ?? "");
    const oldName = String(staff.name ?? "");
    const oldRole = String(staff.role ?? "");

    // Find the account linked to this staff member via email.
    const accountRes = await fetch(
      `${supabaseUrl}/rest/v1/accounts?select=user_id&email=eq.${encodeURIComponent(oldEmail)}&role=eq.support`,
      {
        method: "GET",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    );

    if (!accountRes.ok) {
      const accountError = await accountRes.text();
      console.error("Failed to load account:", accountError);
      return NextResponse.json(
        { error: "Failed to load account record" },
        { status: 500 }
      );
    }

    const accountRows = await accountRes.json();
    const accountRow = accountRows?.[0];
    const userId = String(accountRow?.user_id ?? "");

    if (!userId) {
      return NextResponse.json(
        { error: "Staff member is not linked to an account" },
        { status: 500 }
      );
    }

    const authHeaders = {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    };

    const restHeaders = {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: "return=representation",
    };

    // 1. Update the auth user (login identity = email).
    const authUpdateRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${userId}`,
      {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({
          email,
          email_confirm: true,
          user_metadata: { name, role: "support" },
        }),
      }
    );

    if (!authUpdateRes.ok) {
      const authData = await authUpdateRes.json();
      console.error("Supabase auth error:", authData);
      return NextResponse.json(
        { error: "Failed to update auth user" },
        { status: 400 }
      );
    }

    // 2. Update support_staff.
    const staffUpdateRes = await fetch(
      `${supabaseUrl}/rest/v1/support_staff?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: restHeaders,
        body: JSON.stringify({
          name,
          email,
          role,
          avatar: getInitials(name),
        }),
      }
    );

    if (!staffUpdateRes.ok) {
      const staffError = await staffUpdateRes.text();
      console.error("Failed to update staff:", staffError);

      // Rollback auth user to previous values.
      await fetch(
        `${supabaseUrl}/auth/v1/admin/users/${userId}`,
        {
          method: "PUT",
          headers: authHeaders,
          body: JSON.stringify({
            email: oldEmail,
            email_confirm: true,
            user_metadata: { name: oldName, role: oldRole },
          }),
        }
      ).catch((err) =>
        console.error("Rollback auth user failed:", err)
      );

      return NextResponse.json(
        { error: "Failed to update staff record" },
        { status: 500 }
      );
    }

    // 3. Update accounts.
    const accountUpdateRes = await fetch(
      `${supabaseUrl}/rest/v1/accounts?user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: "PATCH",
        headers: restHeaders,
        body: JSON.stringify({
          name,
          email,
          avatar: getInitials(name),
        }),
      }
    );

    if (!accountUpdateRes.ok) {
      const accountError = await accountUpdateRes.text();
      console.error("Failed to update account:", accountError);

      // Rollback support_staff.
      await fetch(
        `${supabaseUrl}/rest/v1/support_staff?id=eq.${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: restHeaders,
          body: JSON.stringify({
            name: oldName,
            email: oldEmail,
            role: oldRole,
            avatar: staff.avatar,
          }),
        }
      ).catch((err) => console.error("Rollback staff failed:", err));

      // Rollback auth user.
      await fetch(
        `${supabaseUrl}/auth/v1/admin/users/${userId}`,
        {
          method: "PUT",
          headers: authHeaders,
          body: JSON.stringify({
            email: oldEmail,
            email_confirm: true,
            user_metadata: { name: oldName, role: oldRole },
          }),
        }
      ).catch((err) => console.error("Rollback auth user failed:", err));

      return NextResponse.json(
        { error: "Failed to update account record" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      staff: {
        id,
        name,
        email,
        role,
        avatar: getInitials(name),
        active: true,
      },
    });
  } catch (error) {
    console.error("Update staff error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}