import { NextRequest, NextResponse } from "next/server";

function getServiceHeaders() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return null;
  }

  return {
    supabaseUrl,
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");

    if (!token || !token.trim()) {
      return NextResponse.json(
        { error: "Reset token is required" },
        { status: 400 }
      );
    }

    const service = getServiceHeaders();
    if (!service) {
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 }
      );
    }

    // Query password_resets using service role to bypass RLS
    const res = await fetch(
      `${service.supabaseUrl}/rest/v1/password_resets?token=eq.${encodeURIComponent(token.trim())}&used=eq.false&expires_at=gt.${new Date().toISOString()}`,
      {
        method: "GET",
        headers: service.headers,
      }
    );

    if (!res.ok) {
      console.error("Failed to verify reset token:", await res.text());
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }

    const records = await res.json();
    const resetRecord = records?.[0];

    if (!resetRecord) {
      return NextResponse.json(
        { error: "Invalid or expired reset token" },
        { status: 400 }
      );
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error("Reset password token verification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (typeof token !== "string" || !token.trim()) {
      return NextResponse.json(
        { error: "Reset token is required" },
        { status: 400 }
      );
    }

    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const service = getServiceHeaders();
    if (!service) {
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 }
      );
    }

    // Look up the reset record using service role
    const res = await fetch(
      `${service.supabaseUrl}/rest/v1/password_resets?token=eq.${encodeURIComponent(token.trim())}&used=eq.false&expires_at=gt.${new Date().toISOString()}`,
      {
        method: "GET",
        headers: service.headers,
      }
    );

    if (!res.ok) {
      console.error("Failed to look up reset token:", await res.text());
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }

    const records = await res.json();
    const resetRecord = records?.[0];

    if (!resetRecord) {
      return NextResponse.json(
        { error: "Invalid or expired reset token" },
        { status: 400 }
      );
    }

    // Look up the auth user by email to reset their password.
    const userLookupRes = await fetch(
      `${service.supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(resetRecord.email)}`,
      {
        method: "GET",
        headers: service.headers,
      }
    );

    if (!userLookupRes.ok) {
      return NextResponse.json(
        { error: "Failed to locate user account" },
        { status: 400 }
      );
    }

    const userData = await userLookupRes.json();
    const authUser = (userData.users || []).find(
      (u: { email?: string }) => u.email === resetRecord.email
    );

    if (!authUser?.id) {
      return NextResponse.json(
        { error: "User account not found" },
        { status: 404 }
      );
    }

    const updateRes = await fetch(`${service.supabaseUrl}/auth/v1/admin/users/${authUser.id}`, {
      method: "PUT",
      headers: service.headers,
      body: JSON.stringify({ password }),
    });

    if (!updateRes.ok) {
      const updateData = await updateRes.json();
      console.error("Supabase auth update error:", updateData);
      return NextResponse.json(
        { error: "Failed to reset password" },
        { status: 400 }
      );
    }

    // Mark the token as used
    const consumeRes = await fetch(
      `${service.supabaseUrl}/rest/v1/password_resets?id=eq.${resetRecord.id}`,
      {
        method: "PATCH",
        headers: { ...service.headers, Prefer: "return=representation" },
        body: JSON.stringify({ used: true }),
      }
    );

    if (!consumeRes.ok) {
      console.error("Failed to consume password reset token:", await consumeRes.text());
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}