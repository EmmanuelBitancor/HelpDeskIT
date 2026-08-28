import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");

    if (!token || !token.trim()) {
      return NextResponse.json(
        { error: "Reset token is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: resetRecord } = await supabase
      .from("password_resets")
      .select("*")
      .eq("token", token.trim())
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!resetRecord) {
      return NextResponse.json(
        { error: "Invalid or expired reset token" },
        { status: 400 }
      );
    }

    // Token is valid — proceed with password reset.
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

    const supabase = await createClient();

    const { data: resetRecord } = await supabase
      .from("password_resets")
      .select("*")
      .eq("token", token.trim())
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!resetRecord) {
      return NextResponse.json(
        { error: "Invalid or expired reset token" },
        { status: 400 }
      );
    }

    // Look up the auth user by email to reset their password.
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceRoleKey || !supabaseUrl) {
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 }
      );
    }

    const userLookupRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(resetRecord.email)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
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

    const updateRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUser.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
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

    const { error: consumeError } = await supabase
      .from("password_resets")
      .update({ used: true })
      .eq("id", resetRecord.id);

    if (consumeError) {
      console.error("Failed to consume password reset token:", consumeError);
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
