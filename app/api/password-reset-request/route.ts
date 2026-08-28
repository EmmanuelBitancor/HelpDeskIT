import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIdentifier } from "@/app/api/_lib/ratelimit";
import { sendEmail } from "@/lib/email";
import { passwordResetNotificationEmail } from "@/lib/email-templates";

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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    const identifier = getClientIdentifier(request);
    const ipRateLimit = await checkRateLimit(identifier, "password-reset-request");

    if (!ipRateLimit.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const emailRateLimit = await checkRateLimit(`email:${normalizedEmail}`, "password-reset-request");

    if (!emailRateLimit.success) {
      return NextResponse.json(
        { error: "Too many requests for this email. Please try again later." },
        { status: 429 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 }
      );
    }

    const headers = {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    };

    const genericResponse = NextResponse.json({
      message: "If an account exists, a reset email will be sent.",
    });

    // Use the service role so RLS does not block anonymous callers.
    const accountRes = await fetch(
      `${supabaseUrl}/rest/v1/accounts?email=eq.${encodeURIComponent(normalizedEmail)}`,
      { method: "GET", headers },
    );

    if (!accountRes.ok) {
      console.error("Failed to look up account for password reset request:", accountRes.status);
      return genericResponse;
    }

    const accounts = await accountRes.json();
    const targetAccount = accounts?.[0];

    if (!targetAccount) {
      return genericResponse;
    }

    const ticketId = `TK-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const ticketRes = await fetch(`${supabaseUrl}/rest/v1/tickets`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: ticketId,
        subject: "Password Reset Request",
        category: "Access",
        priority: "medium",
        status: "open",
        description: `User ${targetAccount.name} (${targetAccount.email}) requested a password reset. Please assist them to regain access to their account.`,
        submitted_by: normalizedEmail,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });

    if (!ticketRes.ok) {
      console.error("Failed to create password reset ticket:", await ticketRes.text());
      return NextResponse.json(
        { error: "Unable to process the request. Please try again later." },
        { status: 500 }
      );
    }

    const templates = passwordResetNotificationEmail({
      name: targetAccount.name,
      email: normalizedEmail,
    });

    await sendEmail({
      to: normalizedEmail,
      subject: templates.subject,
      html: templates.html,
      text: templates.text,
    });

    return genericResponse;
  } catch (error) {
    console.error("Password reset request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
