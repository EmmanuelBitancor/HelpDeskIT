import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/email-templates";
import { checkRateLimit, getClientIdentifier } from "@/app/api/_lib/ratelimit";

const MAX_OTP_ATTEMPTS = 5;

export async function POST(request: NextRequest) {
  try {
    const clientLimit = await checkRateLimit(getClientIdentifier(request), "verify-otp");
    if (!clientLimit.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email, token } = body;

    if (typeof email !== "string" || !email.trim() || typeof token !== "string" || !token.trim()) {
      return NextResponse.json(
        { error: "Email and token are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const emailLimit = await checkRateLimit(`email:${normalizedEmail}`, "verify-otp");
    if (!emailLimit.success) {
      return NextResponse.json(
        { error: "Too many requests for this email. Please try again later." },
        { status: 429 }
      );
    }

    const supabase = await createClient();

    // Look up the current valid OTP for this email.
    const { data: otpRow } = await supabase
      .from("email_verifications")
      .select("*")
      .eq("email", normalizedEmail)
      .eq("type", "otp")
      .eq("verified", false)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otpRow) {
      return NextResponse.json(
        { error: "Invalid or expired OTP" },
        { status: 400 }
      );
    }

    // Wrong token — invalidate the OTP so further guesses are impossible.
    if (otpRow.token !== token.trim()) {
      await supabase.from("email_verifications").delete().eq("id", otpRow.id);
      return NextResponse.json(
        { error: "Invalid or expired OTP" },
        { status: 400 }
      );
    }

    // Token matches — mark as verified and proceed with account activation.
    const { error: updateError } = await supabase
      .from("email_verifications")
      .update({ verified: true })
      .eq("id", otpRow.id);

    if (updateError) {
      console.error("Failed to mark OTP as verified:", updateError);
      return NextResponse.json(
        { error: "Failed to verify code. Please try again." },
        { status: 500 }
      );
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceRoleKey || !supabaseUrl) {
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 }
      );
    }

    // Confirm the auth user.
    const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(normalizedEmail)}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });

    if (!authRes.ok) {
      const authError = await authRes.text();
      console.error("Failed to lookup auth user:", authError);
      return NextResponse.json(
        { error: "Failed to activate account. Please try again later." },
        { status: 500 }
      );
    }

    const authData = await authRes.json();
    const users = authData.users || [];
    const user = users.find((u: { email?: string }) => u.email === normalizedEmail);

    if (!user?.id) {
      return NextResponse.json(
        { error: "Account not found. Please contact support." },
        { status: 404 }
      );
    }

    // Activate the auth account.
    const confirmRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ email_confirm: true }),
    });

    if (!confirmRes.ok) {
      const confirmError = await confirmRes.text();
      console.error("Failed to confirm auth user:", confirmError);
      return NextResponse.json(
        { error: "Failed to activate account. Please try again later." },
        { status: 500 }
      );
    }

    // Mark the accounts row as active.
    const accountRes = await fetch(
      `${supabaseUrl}/rest/v1/accounts?user_id=eq.${encodeURIComponent(user.id)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ status: "active" }),
      }
    );

    if (!accountRes.ok) {
      const accountError = await accountRes.text();
      console.error("Failed to activate account row:", accountError);
      return NextResponse.json(
        { error: "Failed to activate account. Please try again later." },
        { status: 500 }
      );
    }

    // Send the welcome email now that the address is verified.
    const name = String(user.user_metadata?.name ?? normalizedEmail);
    const templates = welcomeEmail({ name, email: normalizedEmail });
    sendEmail({
      to: normalizedEmail,
      subject: templates.subject,
      html: templates.html,
      text: templates.text,
    }).catch((err) => console.error("Welcome email failed:", err));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
