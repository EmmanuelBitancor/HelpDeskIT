import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("id, email, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const otherParty = searchParams.get("other_party");

    let query = supabase
      .from("conversations")
      .select("*")
      .or(`created_by.eq.${account.id},created_for.eq.${account.id}`)
      .order("updated_at", { ascending: false });

    if (otherParty) {
      query = query.or(
        `and(created_by.eq.${account.id},created_for.eq.${otherParty}),and(created_by.eq.${otherParty},created_for.eq.${account.id})`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error("Conversations query error:", error);
      const message = error.message || "Failed to fetch conversations";
      return NextResponse.json(
        { error: message.includes("does not exist") ? "Chat system not initialized. Please run the database migration." : message },
        { status: 500 }
      );
    }

    return NextResponse.json({ conversations: data || [] });
  } catch (error) {
    console.error("Conversations fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { created_for, created_for_role } = body;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("id, email, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const targetRole = created_for_role || account.role;

    if (!created_for) {
      return NextResponse.json(
        { error: "created_for is required" },
        { status: 400 }
      );
    }

    if (!targetRole) {
      return NextResponse.json(
        { error: "Unable to determine target role" },
        { status: 400 }
      );
    }

    const conversationId = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const { data, error } = await supabase
      .from("conversations")
      .insert({
        id: conversationId,
        created_by: account.id,
        created_for,
        created_by_role: account.role,
        created_for_role: targetRole,
      })
      .select()
      .single();

    if (error) {
      console.error("Conversation insert error:", error);
      const message = error.message || "Failed to create conversation";
      return NextResponse.json(
        { error: message.includes("does not exist") ? "Chat system not initialized. Please run the database migration." : message },
        { status: 400 }
      );
    }

    return NextResponse.json({ conversation: data }, { status: 201 });
  } catch (error) {
    console.error("Conversation create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
