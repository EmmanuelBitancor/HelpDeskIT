import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ALLOWED_ACTIONS } from "@/lib/activity";

const MAX_FIELD_LENGTH = 500;

function boundedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, MAX_FIELD_LENGTH);
}

const RATE_LIMIT_REQUESTS = 30;
const RATE_LIMIT_WINDOW = 60_000;
const memoryStore = new Map<string, { count: number; resetAt: number }>();

function getClientIdentifier(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anonymous"
  );
}

async function checkRateLimit(identifier: string, namespace = "default") {
  const now = Date.now();
  const key = `${namespace}:${identifier}`;

  const entry = memoryStore.get(key);

  if (entry && now > entry.resetAt) {
    memoryStore.delete(key);
  }

  if (memoryStore.size > 10000) {
    for (const [k, val] of memoryStore.entries()) {
      if (now > val.resetAt) {
        memoryStore.delete(k);
      }
    }
    if (memoryStore.size > 10000) {
      const firstKey = memoryStore.keys().next().value;
      if (firstKey) memoryStore.delete(firstKey);
    }
  }

  const current = memoryStore.get(key);

  if (!current) {
    memoryStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { success: true, remaining: RATE_LIMIT_REQUESTS - 1 };
  }

  if (current.count >= RATE_LIMIT_REQUESTS) {
    return { success: false, remaining: 0 };
  }

  current.count += 1;
  return { success: true, remaining: RATE_LIMIT_REQUESTS - current.count };
}

export async function POST(request: NextRequest) {
  try {
    const identifier = getClientIdentifier(request);
    const rateLimit = await checkRateLimit(identifier, "activity");

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const {
      action,
      target_type,
      target_id,
      details,
    } = body;

    const normalizedAction = typeof action === "string" ? action.trim() : "";

    if (!normalizedAction || !ALLOWED_ACTIONS.has(normalizedAction)) {
      return NextResponse.json(
        { error: "Invalid action" },
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

    const derivedIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;
    const derivedUserAgent = request.headers.get("user-agent") || null;

    const { error } = await supabase.from("activity_logs").insert({
      id: logId,
      actor_id: user.id,
      actor_name: actorName,
      actor_role: actorRole,
      action: normalizedAction,
      target_type: boundedString(target_type),
      target_id: boundedString(target_id),
      details: boundedString(details),
      ip_address: derivedIp,
      user_agent: derivedUserAgent,
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
    const limit = Math.max(1, Math.min(Number(searchParams.get("limit")) || 100, 500));
    const action = searchParams.get("action");
    const actorId = searchParams.get("actor_id");

    let query = supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (action && ALLOWED_ACTIONS.has(action)) {
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
