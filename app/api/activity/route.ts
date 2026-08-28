import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ALLOWED_ACTIONS, type ActivityAction } from "@/lib/activity";
import { checkRateLimit, getClientIdentifier } from "@/app/api/_lib/ratelimit";
import { boundedString, getClientIp } from "@/app/api/_lib/request";

const MAX_FIELD_LENGTH = 500;

export async function POST(request: NextRequest) {
  try {
    const identifier = getClientIdentifier(request);
    const rateLimit = await checkRateLimit(identifier, "activity");

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }

    const bodyResult = await parseJsonBody<{
      action: unknown;
      target_type?: unknown;
      target_id?: unknown;
      details?: unknown;
    }>(request);
    if (!bodyResult.ok) return NextResponse.json({ error: bodyResult.error }, { status: 400 });

    const { action, target_type, target_id, details } = bodyResult.data;
    const normalizedAction = typeof action === "string" ? action.trim() : "";

    if (!normalizedAction || !ALLOWED_ACTIONS.has(normalizedAction as ActivityAction)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
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
      action: normalizedAction,
      target_type: boundedString(target_type, MAX_FIELD_LENGTH),
      target_id: boundedString(target_id, MAX_FIELD_LENGTH),
      details: boundedString(details, MAX_FIELD_LENGTH),
      ip_address: getClientIp(request),
      user_agent: request.headers.get("user-agent") || null,
    });

    if (error) {
      console.error("Failed to log activity:", error);
      return NextResponse.json(
        { error: "Failed to log activity" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Activity log error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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

    if (account?.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.max(1, Math.min(Number(searchParams.get("limit")) || 100, 500));
    const action = searchParams.get("action");
    const actorId = searchParams.get("actor_id");

    let query = supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (action) {
      if (!ALLOWED_ACTIONS.has(action as ActivityAction)) {
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
      }
      query = query.eq("action", action as ActivityAction);
    }
    if (actorId) {
      query = query.eq("actor_id", actorId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch activity logs:", error);
      return NextResponse.json(
        { error: "Failed to fetch activity logs" },
        { status: 500 },
      );
    }

    return NextResponse.json({ logs: data || [] });
  } catch (error) {
    console.error("Activity fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function parseJsonBody<T = unknown>(
  request: NextRequest,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const data = (await request.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Invalid JSON body" };
  }
}
