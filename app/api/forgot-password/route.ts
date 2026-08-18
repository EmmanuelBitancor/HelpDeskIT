import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIdentifier } from "@/app/api/_lib/ratelimit";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    const identifier = getClientIdentifier(request);
    const rateLimit = await checkRateLimit(identifier);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const supabase = await createClient();
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.NODE_ENV !== "production"
        ? request.headers.get("origin") || "http://localhost:3000"
        : null);

    if (!origin) {
      console.error("Missing NEXT_PUBLIC_SITE_URL in production environment");
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 }
      );
    }

    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${origin}/auth/reset-password`,
    });

    if (error) {
      console.error("Password reset provider error:", error);
    }

    return NextResponse.json(
      { message: "If an account exists, a reset email will be sent." }
    );
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
