import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { passwordResetEmail, passwordResetNotificationEmail } from "@/lib/email-templates";
import { checkRateLimit, getClientIdentifier } from "@/app/api/_lib/ratelimit";
import { validateEmail } from "@/app/api/_lib/request";

export async function POST(request: NextRequest) {
  try {
    const bodyResult = await parseJsonBody<{ email: unknown }>(request);
    if (!bodyResult.ok) return NextResponse.json({ error: bodyResult.error }, { status: 400 });

    const { email } = bodyResult.data;
    const normalizedEmail = validateEmail(email);
    if (!normalizedEmail) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const identifier = getClientIdentifier(request);
    const rateLimit = await checkRateLimit(identifier, "forgot-password");

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.NODE_ENV !== "production"
        ? request.headers.get("origin") || "https://helpdesk-nine-pi.vercel.app"
        : null);

    if (!origin) {
      console.error("Missing NEXT_PUBLIC_SITE_URL in production environment");
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 },
      );
    }

    const headers = {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    };

    // Look up the account by email using the service role so RLS does not
    // block anonymous callers on the public forgot-password endpoint.
    const accountRes = await fetch(
      `${supabaseUrl}/rest/v1/accounts?email=eq.${encodeURIComponent(normalizedEmail)}`,
      { method: "GET", headers },
    );

    const genericResponse = NextResponse.json({
      message: "If an account exists, a reset email will be sent.",
    });

    if (!accountRes.ok) {
      // Don't leak whether the account exists — return the generic response
      console.error("Failed to look up account for password reset:", accountRes.status);
      return genericResponse;
    }

    const accounts = await accountRes.json();
    const targetAccount = accounts?.[0];

    if (!targetAccount) {
      return genericResponse;
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/password_resets`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: crypto.randomUUID(),
        email: normalizedEmail,
        token,
        expires_at: expiresAt,
      }),
    });

    if (!insertRes.ok) {
      console.error("Failed to create password reset token:", await insertRes.text());
      return NextResponse.json(
        { error: "Unable to process the request. Please try again later." },
        { status: 500 },
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
