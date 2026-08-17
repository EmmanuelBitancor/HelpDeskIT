import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceRoleKey || !supabaseUrl) {
      const missing = !serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : "NEXT_PUBLIC_SUPABASE_URL";
      return NextResponse.json(
        { error: `Server not configured: missing ${missing}` },
        { status: 500 }
      );
    }

    const [authRes, accountsRes] = await Promise.all([
      fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: "GET",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }),
      fetch(`${supabaseUrl}/rest/v1/accounts?select=*`, {
        method: "GET",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }),
    ]);

    if (!authRes.ok) {
      const authError = await authRes.text();
      console.error("Supabase auth error:", authError);
      return NextResponse.json(
        { error: "Failed to fetch users from authentication" },
        { status: 500 }
      );
    }

    const authData = await authRes.json();
    const accountsData = accountsRes.ok ? await accountsRes.json() : [];

    const accountsByEmail = new Map(
      (accountsData || []).map((acc: Record<string, unknown>) => [
        String(acc.email).toLowerCase(),
        acc,
      ])
    );

    const users = (authData.users || []).map((authUser: Record<string, unknown>) => {
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

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
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
        { error: authData.msg || "Failed to create user" },
        { status: 400 }
      );
    }

    const userId = authData.id;

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
        id: `u-${Date.now()}`,
        user_id: userId,
        name,
        email,
        role: "user",
        avatar: initials || "U",
      }),
    });

    if (!dbRes.ok) {
      const dbError = await dbRes.text();
      console.error("Failed to create account:", dbError);
    }

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
