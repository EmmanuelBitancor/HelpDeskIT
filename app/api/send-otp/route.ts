import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { otpEmail } from "@/lib/email-templates";
import { checkRateLimit, getClientIdentifier } from "@/app/api/_lib/ratelimit";

export async function POST(request: NextRequest) {
   try {
     const rateLimit = await checkRateLimit(getClientIdentifier(request), "send-otp");
     if (!rateLimit.success) {
       return NextResponse.json(
         { error: "Too many requests. Please try again later." },
         { status: 429 }
       );
     }

     const body = await request.json();
    const { email } = body;

    if (typeof email !== "string" || !email.trim()) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const supabase = await createClient();

    const { data: existingUser } = await supabase
      .from("accounts")
      .select("email, status")
      .eq("email", normalizedEmail)
      .maybeSingle();

    // Allow resends for an unverified account; reject fully-created ones.
    if (existingUser && existingUser.status !== "pending_verification") {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 400 }
      );
    }

    const otp = randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Remove any existing unverified OTPs for this email before inserting
    // the new one, so a stale code can't be reused.
    await supabase
      .from("email_verifications")
      .delete()
      .eq("email", normalizedEmail)
      .eq("type", "otp")
      .eq("verified", false);

    const { error: insertError } = await supabase.from("email_verifications").insert({
      id: crypto.randomUUID(),
      email: normalizedEmail,
      token: otp,
      type: "otp",
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error("Failed to create OTP:", insertError);
      return NextResponse.json(
        { error: "Failed to generate OTP" },
        { status: 500 }
      );
    }

    const templates = otpEmail({ email: normalizedEmail, otp });
    const result = await sendEmail({
      to: normalizedEmail,
      subject: templates.subject,
      html: templates.html,
      text: templates.text,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: "Failed to send OTP email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Send OTP error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
