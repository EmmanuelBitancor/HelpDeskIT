import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIdentifier } from "@/app/api/_lib/ratelimit";
import { boundedString, getClientIp } from "@/app/api/_lib/request";

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await checkRateLimit(getClientIdentifier(request), "unauthorized-access");
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }

    const bodyResult = await parseJsonBody<{
      path?: unknown;
      reason?: unknown;
      userAgent?: unknown;
    }>(request);
    if (!bodyResult.ok) return NextResponse.json({ error: bodyResult.error }, { status: 400 });

    const { path, reason, userAgent } = bodyResult.data;

    const supabase = await createClient();

    // Get the current user if they exist (for authenticated but unauthorized access)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Log the unauthorized access attempt
    await supabase.from("activity_logs").insert({
      actor_id: user?.id ?? "anonymous",
      actor_name: user?.email ?? "Anonymous",
      actor_role: "unknown",
      action: "unauthorized_access_attempt",
      target_type: "route",
      target_id: boundedString(path, 200),
      details: boundedString(reason, 200),
      ip_address: getClientIp(request),
      metadata: {
        user_agent: boundedString(userAgent, 200),
        path: boundedString(path, 200),
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to log unauthorized access:", error);
    return NextResponse.json({ error: "Failed to log attempt" }, { status: 500 });
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
