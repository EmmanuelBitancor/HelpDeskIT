import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIdentifier } from "@/app/api/_lib/ratelimit";
import { sendEmail } from "@/lib/email";
import { otpEmail } from "@/lib/email-templates";

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

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const normalizedEmail = trimmedEmail.toLowerCase();
    const normalizedName = trimmedName;

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceRoleKey || !supabaseUrl) {
      const missing = !serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : "NEXT_PUBLIC_SUPABASE_URL";
      return NextResponse.json(
        { error: `Server not configured: missing ${missing}` },
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

    // Insert the accounts row in pending_verification state. The resend
    // endpoint looks for this status to know it can regenerate an OTP for
    // an address that already has an account row.
    const dbRes = await fetch(`${supabaseUrl}/rest/v1/accounts`, {
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

    if (!dbRes.ok) {
      const dbError = await dbRes.text();
      console.error("Failed to create account:", dbError);

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
        console.error("Failed to cleanup auth user after account creation failure:", deleteError);
      }

      return NextResponse.json(
        { error: "Failed to create user account" },
        { status: 400 }
      );
    }

    // Generate the OTP here so the user has a code as soon as the modal
    // opens, instead of having to click "Resend Code" first.
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

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
