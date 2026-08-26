import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/email-templates";

export async function GET() {
  try {
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

    const accountsRes = await fetch(`${supabaseUrl}/rest/v1/accounts?select=*`, {
      method: "GET",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });

    if (!accountsRes.ok) {
      const accountsError = await accountsRes.text();
      console.error("Supabase accounts error:", accountsError);
      return NextResponse.json(
        { error: "Failed to fetch account records" },
        { status: 500 }
      );
    }

    const accountsData = await accountsRes.json();

    const allUsers: Record<string, unknown>[] = [];
    let page = 1;
    const perPage = 100;
    const MAX_PAGES = 100;

    while (page <= MAX_PAGES) {
      const authRes = await fetch(
        `${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
        {
          method: "GET",
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
        }
      );

      if (!authRes.ok) {
        const authError = await authRes.text();
        console.error("Supabase auth error:", authError);
        return NextResponse.json(
          { error: "Failed to fetch users from authentication" },
          { status: 500 }
        );
      }

      const authData = await authRes.json();
      const usersOnPage = authData.users || [];

      if (usersOnPage.length === 0) {
        break;
      }

      allUsers.push(...usersOnPage);

      if (usersOnPage.length < perPage) {
        break;
      }

      page++;
    }

    if (page > MAX_PAGES) {
      console.error("User fetch exceeded max pages");
      return NextResponse.json(
        { error: "Too many users to fetch" },
        { status: 500 }
      );
    }

    const accountsByEmail = new Map(
      (accountsData || [])
        .filter((acc: Record<string, unknown>) => acc.email != null)
        .map((acc: Record<string, unknown>) => [
          String(acc.email).toLowerCase(),
          acc,
        ])
    );

    const users = (allUsers || []).map((authUser: Record<string, unknown>) => {
      const email = String(authUser.email || "").toLowerCase();
      const account = accountsByEmail.get(email) as Record<string, unknown> | undefined;
      const metadata = (authUser.user_metadata as Record<string, unknown>) || {};

      return {
        id: String(authUser.id),
        email,
        name: String((account?.name as string) || (metadata.name as string) || authUser.email || ""),
        role: String((account?.role as string) || (metadata.role as string) || "user"),
        status: String((account?.status as string) || "active"),
        avatar: String((account?.avatar as string) || (metadata.avatar as string) || "?"),
        createdAt: String(authUser.created_at || ""),
        lastLogin: authUser.last_sign_in_at ? String(authUser.last_sign_in_at) : "—",
        ticketCount: 0,
      };
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("List users error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { error: "Name, email, and password must be strings" },
        { status: 400 }
      );
    }

    if (!name.trim() || !email.trim() || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
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

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const authRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/users`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          email,
          password,
          email_confirm: true,
          user_metadata: { name, role: "user" },
        }),
      }
    );

    const authData = await authRes.json();

    if (!authRes.ok) {
console.error("Supabase auth error:", authData);
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      );
    }

    const userId = authData.id || authData.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Failed to create user: missing user id" },
        { status: 500 }
      );
    }

    const initials = name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    const dbRes = await fetch(`${supabaseUrl}/rest/v1/accounts`, {
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
        role: "user",
        status: "active",
        avatar: initials || "U",
      }),
    });

    if (!dbRes.ok) {
      const dbError = await dbRes.text();
      console.error("Failed to create account:", dbError);

      const { error: deleteError } = await fetch(
        `${supabaseUrl}/auth/v1/admin/users/${userId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
        }
      ).then((res) => {
        if (!res.ok) {
          return res.text().then((text) => ({ error: new Error(text) }));
        }
        return { error: null as Error | null };
      });

      if (deleteError) {
        console.error("Failed to cleanup auth user after account creation failure:", deleteError);
      }

      return NextResponse.json(
        { error: "Failed to create user account" },
        { status: 400 }
      );
    }

    const templates = welcomeEmail({ name, email });
    sendEmail({
      to: email,
      subject: templates.subject,
      html: templates.html,
      text: templates.text,
    }).catch((err) => console.error("User welcome email failed:", err));

    return NextResponse.json({
      success: true,
      user: { id: userId, name, email, role: "user" },
    });
  } catch (error) {
    console.error("Add user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
