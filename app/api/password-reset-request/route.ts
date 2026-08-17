import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    const supabase = await createClient();

    const { data: targetAccount } = await supabase
      .from("accounts")
      .select("id, name, email, role")
      .eq("email", email)
      .maybeSingle();

    if (!targetAccount) {
      return NextResponse.json(
        { error: "No account found with this email" },
        { status: 404 }
      );
    }

    const ticketId = `TK-${Date.now()}`;
    const { error: ticketError } = await supabase.from("tickets").insert({
      id: ticketId,
      subject: "Password Reset Request",
      category: "Access",
      priority: "medium",
      status: "open",
      description: `User ${targetAccount.name} (${targetAccount.email}) requested a password reset. Please assist them to regain access to their account.`,
      submitted_by: email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (ticketError) {
      return NextResponse.json(
        { error: ticketError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, ticketId });
  } catch (error) {
    console.error("Password reset request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
