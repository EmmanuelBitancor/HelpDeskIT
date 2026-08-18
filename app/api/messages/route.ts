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
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversation_id");

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversation_id is required" },
        { status: 400 }
      );
    }

    const { data: conversation } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .maybeSingle();

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (
      conversation.created_by !== account.id &&
      conversation.created_for !== account.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: messages, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Messages query error:", error);
      const message = error.message || "Failed to fetch messages";
      return NextResponse.json(
        { error: message.includes("does not exist") ? "Chat system not initialized. Please run the database migration." : message },
        { status: 500 }
      );
    }

    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .neq("sender_id", account.id)
      .is("read_at", null);

    return NextResponse.json({ messages: messages || [] });
  } catch (error) {
    console.error("Messages fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversation_id, content } = body;

    if (!conversation_id || typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "conversation_id and content are required" },
        { status: 400 }
      );
    }

    if (content.length > 5000) {
      return NextResponse.json(
        { error: "Content must not exceed 5000 characters" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("id, name, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const { data: conversation } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", conversation_id)
      .maybeSingle();

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (
      conversation.created_by !== account.id &&
      conversation.created_for !== account.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const { data, error } = await supabase
      .from("messages")
      .insert({
        id: messageId,
        conversation_id,
        sender_id: account.id,
        sender_name: account.name,
        sender_role: account.role,
        content: content.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error("Message insert error:", error);
      const message = error.message || "Failed to send message";
      return NextResponse.json(
        { error: message.includes("does not exist") ? "Chat system not initialized. Please run the database migration." : message },
        { status: 400 }
      );
    }

    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversation_id);

    return NextResponse.json({ message: data }, { status: 201 });
  } catch (error) {
    console.error("Message create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
