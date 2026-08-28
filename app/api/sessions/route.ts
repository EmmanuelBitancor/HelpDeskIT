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
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    const isSuperAdmin = account?.role === "superadmin";

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");

    let query = supabase
      .from("user_sessions")
      .select("*")
      .order("last_active", { ascending: false });

    if (!isSuperAdmin) {
      if (!account?.id) {
        return NextResponse.json({ sessions: [] });
      }

      if (userId && userId !== account.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      query = query.eq("user_id", account.id);
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

export async function POST(request: NextRequest) {
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
      .select("id, name, email, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const sessionId = crypto.randomUUID();
    const userAgent =
      request.headers.get("user-agent")?.slice(0, 120) || "unknown";
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;

    const { error } = await supabase.from("user_sessions").insert({
      id: sessionId,
      user_id: account.id,
      user_email: account.email,
      user_name: account.name,
      user_role: account.role,
      device: userAgent,
      ip_address: ipAddress,
      user_agent: userAgent,
      last_active: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Failed to create session:", error);
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }

    return NextResponse.json({ sessionId });
  } catch (error) {
    console.error("Session create error:", error);
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

    if (
      (session_id !== undefined && typeof session_id !== "string") ||
      (user_id !== undefined && typeof user_id !== "string")
    ) {
      return NextResponse.json(
        { error: "session_id and user_id must be strings" },
        { status: 400 }
      );
    }

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

    const { error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!count) {
      return NextResponse.json({ error: "No sessions found to delete" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Session delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
