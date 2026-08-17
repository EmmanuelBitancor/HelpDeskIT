import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
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

    const isSuperAdmin = account?.role === "superadmin";

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");

    let query = supabase
      .from("user_sessions")
      .select("*")
      .order("last_active", { ascending: false });

    if (!isSuperAdmin && userId) {
      query = query.eq("user_id", userId);
    } else if (!isSuperAdmin) {
      const { data: ownAccount } = await supabase
        .from("accounts")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (ownAccount?.id) {
        query = query.eq("user_id", ownAccount.id);
      } else {
        return NextResponse.json({ sessions: [] });
      }
    }

    if (userId && isSuperAdmin) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sessions: data || [] });
  } catch (error) {
    console.error("Sessions fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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
      .select("role, id")
      .eq("user_id", user.id)
      .maybeSingle();

    const isSuperAdmin = account?.role === "superadmin";
    const ownAccountId = account?.id;

    const body = await request.json();
    const { session_id, user_id } = body;

    if (!session_id && !user_id) {
      return NextResponse.json(
        { error: "session_id or user_id is required" },
        { status: 400 }
      );
    }

    let query = supabase.from("user_sessions").delete();

    if (session_id) {
      query = query.eq("id", session_id);
      if (!isSuperAdmin) {
        query = query.eq("user_id", ownAccountId ?? "");
      }
    } else if (user_id && isSuperAdmin) {
      query = query.eq("user_id", user_id);
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Session delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
