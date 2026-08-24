import { NextRequest, NextResponse } from "next/server";

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

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
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

    const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: false,
        user_metadata: { name, role: "user" },
      }),
    });

    const authData = await authRes.json();

    if (!authRes.ok) {
      console.error("Supabase auth error:", authData);
      return NextResponse.json(
        { error: authData.msg || "Failed to create user" },
        { status: 400 }
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

    return NextResponse.json({
      success: true,
      user: { id: userId, name, email, role: "user" },
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
