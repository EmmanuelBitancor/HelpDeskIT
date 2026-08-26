import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIdentifier } from "@/app/api/_lib/ratelimit";

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await checkRateLimit(getClientIdentifier(request), "unauthorized-access");
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();

    const clamp = (value: unknown, max: number) =>
      typeof value === "string" ? value.slice(0, max) : null;

    const path = clamp(body.path, 200);
    const reason = clamp(body.reason, 200);
    const userAgent = clamp(body.userAgent, 200);

    const supabase = await createClient();

    // Get the current user if they exist (for authenticated but unauthorized access)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Derive IP from request headers only; never trust client-supplied ip.
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip");

    // Log the unauthorized access attempt
    await supabase.from("activity_logs").insert({
      actor_id: user?.id ?? "anonymous",
      actor_name: user?.email ?? "Anonymous",
      actor_role: "unknown",
      action: "unauthorized_access_attempt",
      target_type: "route",
      target_id: path,
      details: reason,
      ip_address: ipAddress,
      metadata: {
        user_agent: userAgent,
        path,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to log unauthorized access:", error);
    return NextResponse.json({ error: "Failed to log attempt" }, { status: 500 });
  }
}