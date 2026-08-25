import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path, reason, userAgent, ip } = body;

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
      target_id: path,
      details: reason,
      ip_address: ip || request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
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