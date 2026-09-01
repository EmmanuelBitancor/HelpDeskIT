import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ expired: true, reason: "no_auth" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");

    // If no session ID, check if user has valid Supabase session
    if (!sessionId) {
      return NextResponse.json({ expired: false, reason: "no_session_id_but_auth_valid" }, { status: 200 });
    }

    // Get the session from database
    const { data: session, error } = await supabase
      .from("user_sessions")
      .select("expires_at, remember_me")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();

    // If no session found in DB but user has valid Supabase session, they're logged in
    // This handles the case where the migration hasn't been run yet
    if (error || !session) {
      return NextResponse.json({ expired: false, reason: "session_not_found_but_auth_valid" }, { status: 200 });
    }

    // If remember_me is true, don't check expiry (Supabase handles token refresh)
    if (session.remember_me) {
      return NextResponse.json({ expired: false, reason: "remember_me" }, { status: 200 });
    }

    // Check if session has expiry set and has expired
    if (session.expires_at) {
      const expiresAt = new Date(session.expires_at);
      const now = new Date();

      if (now > expiresAt) {
        // Session expired, delete it
        await supabase.from("user_sessions").delete().eq("id", sessionId);
        return NextResponse.json({ expired: true, reason: "expired" }, { status: 200 });
      }
    }

    return NextResponse.json({ expired: false }, { status: 200 });
  } catch (error) {
    console.error("Session check error:", error);
    // On error, don't sign out - let Supabase handle auth state
    return NextResponse.json({ expired: false, reason: "error" }, { status: 200 });
  }
}
