import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { passwordResetEmail, passwordResetNotificationEmail } from "@/lib/email-templates";
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
    const rateLimit = await checkRateLimit(identifier, "forgot-password");

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

    const { data: targetAccount } = await supabase
      .from("accounts")
      .select("id, name, email, user_id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    const genericResponse = NextResponse.json({
      message: "If an account exists, a reset email will be sent.",
    });

    if (!targetAccount) {
      return genericResponse;
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase.from("password_resets").insert({
      id: crypto.randomUUID(),
      email: normalizedEmail,
      token,
      expires_at: expiresAt,
      user_id: targetAccount.user_id,
    });

    if (insertError) {
      console.error("Failed to create password reset token:", insertError);
      return NextResponse.json(
        { error: "Unable to process the request. Please try again later." },
        { status: 500 }
      );
    }

    const templates = passwordResetEmail({
      email: normalizedEmail,
      token,
      origin,
    });

    await sendEmail({
      to: normalizedEmail,
      subject: templates.subject,
      html: templates.html,
      text: templates.text,
    });

    await sendEmail({
      to: normalizedEmail,
      subject: passwordResetNotificationEmail({ name: targetAccount.name, email: normalizedEmail }).subject,
      html: passwordResetNotificationEmail({ name: targetAccount.name, email: normalizedEmail }).html,
      text: passwordResetNotificationEmail({ name: targetAccount.name, email: normalizedEmail }).text,
    });

    return genericResponse;
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
