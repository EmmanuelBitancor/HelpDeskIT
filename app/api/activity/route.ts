import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      action,
      target_type,
      target_id,
      details,
      ip_address,
      user_agent,
    } = body;

    if (!action || typeof action !== "string") {
      return NextResponse.json(
        { error: "Action is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("name, role")
      .eq("user_id", user.id)
      .maybeSingle();

    const actorName = account?.name || user.email || "Unknown";
    const actorRole = account?.role || "user";

    const logId = `act-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const { error } = await supabase.from("activity_logs").insert({
      id: logId,
      actor_id: user.id,
      actor_name: actorName,
      actor_role: actorRole,
      action,
      target_type: target_type || null,
      target_id: target_id || null,
      details: details || null,
      ip_address: ip_address || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      user_agent: user_agent || request.headers.get("user-agent") || null,
    });

    if (error) {
      console.error("Failed to log activity:", error);
      return NextResponse.json(
        { error: "Failed to log activity" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Activity log error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (account?.role !== "superadmin") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);
    const action = searchParams.get("action");
    const actorId = searchParams.get("actor_id");

    let query = supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (action) {
      query = query.eq("action", action);
    }
    if (actorId) {
      query = query.eq("actor_id", actorId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch activity logs:", error);
      return NextResponse.json(
        { error: "Failed to fetch activity logs" },
        { status: 500 }
      );
    }

    return NextResponse.json({ logs: data || [] });
  } catch (error) {
    console.error("Activity fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
