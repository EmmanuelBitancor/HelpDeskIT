import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { staffWelcomeEmail } from "@/lib/email-templates";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, role, generatePassword } = body;

    if (typeof name !== "string" || typeof email !== "string" || typeof role !== "string") {
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

    if (name.trim().length > 100 || role.trim().length > 100 || email.length > 254) {
      return NextResponse.json(
        { error: "Name, email, or role is too long" },
        { status: 400 }
      );
    }

    if (generatePassword === true) {
      if (typeof password !== "undefined" && (typeof password !== "string" || password.length < 8)) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters" },
          { status: 400 }
        );
      }
    } else {
      if (typeof password !== "string" || password.length < 8) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters" },
          { status: 400 }
        );
      }
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
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
      return NextResponse.json(
        { error: `Server not configured: missing ${missing}` },
        { status: 500 }
      );
    }

    const id = `staff-${Date.now()}`;

    const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        email,
        password: generatePassword === true ? crypto.randomUUID() : password,
        email_confirm: true,
        user_metadata: { name, role: "support" },
      }),
    });

    const authData = await authRes.json();

    if (!authRes.ok) {
      console.error("Supabase auth error:", authData);
      return NextResponse.json(
        { error: "Failed to create auth user" },
        { status: 400 }
      );
    }

    const userId = authData.id || authData.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Failed to create auth user: missing user id" },
        { status: 500 }
      );
    }

    const initials = getInitials(name);

    const staffRes = await fetch(`${supabaseUrl}/rest/v1/support_staff`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        id,
        name,
        email,
        role,
        avatar: initials,
        active: true,
      }),
    });

    if (!staffRes.ok) {
      const staffError = await staffRes.text();
      console.error("Failed to create staff:", staffError);

      await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      });

      return NextResponse.json(
        { error: "Failed to create staff record" },
        { status: 500 }
      );
    }

    const accountRes = await fetch(`${supabaseUrl}/rest/v1/accounts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        user_id: userId,
        name,
        email,
        role: "support",
        status: "active",
        avatar: initials,
      }),
    });

    if (!accountRes.ok) {
      const accountError = await accountRes.text();
      console.error("Failed to create account:", accountError);

      // Rollback support_staff
      await fetch(`${supabaseUrl}/rest/v1/support_staff?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      });

      // Rollback auth user
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      });

      return NextResponse.json(
        { error: "Failed to create staff account" },
        { status: 500 }
      );
    }

    const templates = staffWelcomeEmail({ name, email });
    sendEmail({
      to: email,
      subject: templates.subject,
      html: templates.html,
      text: templates.text,
    }).catch((err) => console.error("Staff welcome email failed:", err));

    return NextResponse.json({
      success: true,
      staff: { id, name, email, role, avatar: initials, active: true },
    });
  } catch (error) {
    console.error("Create staff error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
