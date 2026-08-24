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

    const supabase = await createClient();

    const genericResponse = NextResponse.json({
      message: "If an account exists, a reset email will be sent.",
    });

    const { data: targetAccount } = await supabase
      .from("accounts")
      .select("id, name, email, role")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (!targetAccount) {
      return genericResponse;
    }

    const ticketId = `TK-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const { error: ticketError } = await supabase.from("tickets").insert({
      id: ticketId,
      subject: "Password Reset Request",
      category: "Access",
      priority: "medium",
      status: "open",
      description: `User ${targetAccount.name} (${targetAccount.email}) requested a password reset. Please assist them to regain access to their account.`,
      submitted_by: normalizedEmail,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (ticketError) {
      console.error("Failed to create password reset ticket:", ticketError);
    }

    return genericResponse;
  } catch (error) {
    console.error("Password reset request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
