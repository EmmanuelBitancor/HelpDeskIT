import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { checkRateLimit, getClientIdentifier } from "@/app/api/_lib/ratelimit";
import { sendEmail } from "@/lib/email";
import { otpEmail } from "@/lib/email-templates";
import { isStrongPassword } from "@/lib/password-validation";

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await checkRateLimit(getClientIdentifier(request), "signup");
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { name, email, password } = body;

    if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { error: "Name, email, and password must be strings" },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    if (!isStrongPassword(password)) {
      return NextResponse.json(
        {
          error:
            "Password must be at least 6 characters and include an uppercase letter, a number, and a symbol",
        },
        { status: 400 }
      );
    }

    const normalizedEmail = trimmedEmail.toLowerCase();
    const normalizedName = trimmedName;

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceRoleKey || !supabaseUrl) {
      const missing = !serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : "NEXT_PUBLIC_SUPABASE_URL";
      console.error(`Signup misconfigured: missing ${missing}`);
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 }
      );
    }

    // Create the auth user with email_confirm: false so the OTP step is the
    // only way the address gets confirmed. The welcome email is sent only
    // after verification succeeds.
    const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        email: normalizedEmail,
        password,
        email_confirm: false,
        user_metadata: { name: normalizedName, role: "user" },
      }),
    });

    const authData = await authRes.json();

    if (!authRes.ok) {
      console.error("Supabase auth error:", authData);
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 400 }
      );
    }

    const userId = authData.id || authData.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Failed to create user: missing user id" },
        { status: 500 }
      );
    }

    const initials = normalizedName
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    // The auth trigger may have already inserted an accounts row for this
    // user. Check for an existing row by email first so we can update it
    // instead of inserting a duplicate (which violates the unique email
    // constraint).
    const checkRes = await fetch(
      `${supabaseUrl}/rest/v1/accounts?email=eq.${encodeURIComponent(normalizedEmail)}`,
      {
        method: "GET",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    );

    let dbRes: Response;
    const existingAccounts = checkRes.ok ? await checkRes.json() : [];
    const existing = existingAccounts[0];

    if (existing) {
      if (existing.user_id && existing.user_id !== userId) {
        // Real duplicate: this email is already linked to another auth user.
        await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
        });
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 409 }
        );
      }

      // Orphaned row (user_id is null) or trigger-created row — claim/update it.
      dbRes = await fetch(
        `${supabaseUrl}/rest/v1/accounts?id=eq.${existing.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            user_id: userId,
            name: normalizedName,
            email: normalizedEmail,
            role: "user",
            status: "pending_verification",
            avatar: initials || "U",
          }),
        }
      );
    } else {
      // No existing row — insert fresh.
      dbRes = await fetch(`${supabaseUrl}/rest/v1/accounts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          user_id: userId,
          name: normalizedName,
          email: normalizedEmail,
          role: "user",
          status: "pending_verification",
          avatar: initials || "U",
        }),
      });
    }

    if (!dbRes.ok) {
      const dbError = await dbRes.text();
      console.error("Failed to update/create account:", dbError);

      const { error: deleteError } = await fetch(
        `${supabaseUrl}/auth/v1/admin/users/${userId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
        }
      ).then((res) => {
        if (!res.ok) {
          return res.text().then((text) => ({ error: new Error(text) }));
        }
        return { error: null as Error | null };
      });

      if (deleteError) {
        console.error("Failed to cleanup auth user after account update failure:", deleteError);
      }

      return NextResponse.json(
        { error: "Failed to create user account" },
        { status: 400 }
      );
    }

    // Generate the OTP here so the user has a code as soon as the modal
    // opens, instead of having to click "Resend Code" first.
    const otp = randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Remove any existing unverified OTPs for this email before inserting
    // the new one, so a stale code can't be reused.
    await fetch(
      `${supabaseUrl}/rest/v1/email_verifications?email=eq.${encodeURIComponent(normalizedEmail)}&type=eq.otp&verified=eq.false`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    );

    const otpInsertRes = await fetch(
      `${supabaseUrl}/rest/v1/email_verifications`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          email: normalizedEmail,
          token: otp,
          type: "otp",
          expires_at: expiresAt,
        }),
      }
    );

    if (!otpInsertRes.ok) {
      const otpError = await otpInsertRes.text();
      console.error("Failed to store OTP:", otpError);
    }

    const templates = otpEmail({ email: normalizedEmail, otp });
    const emailResult = await sendEmail({
      to: normalizedEmail,
      subject: templates.subject,
      html: templates.html,
      text: templates.text,
    });

    if (!emailResult.success) {
      console.error("Failed to send OTP email:", emailResult.error);
    }

    return NextResponse.json({
      success: true,
      user: { id: userId, name: normalizedName, email: normalizedEmail, role: "user" },
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
