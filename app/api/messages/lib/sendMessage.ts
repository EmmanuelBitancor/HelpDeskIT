import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/api/_lib/auth";

export async function sendMessageHandler(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const supabase = authResult.supabase;
  const account = authResult.account;

  const body = await request.json();
  const { conversation_id, content } = body;

  if (!conversation_id || typeof content !== "string" || !content.trim()) {
    return NextResponse.json(
      { error: "conversation_id and content are required" },
      { status: 400 },
    );
  }

  if (content.length > 5000) {
    return NextResponse.json(
      { error: "Content must not exceed 5000 characters" },
      { status: 400 },
    );
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversation_id)
    .maybeSingle();

  if (conversationError) {
    console.error("Conversation lookup error:", conversationError);
    return NextResponse.json(
      { error: conversationError.message || "Failed to fetch conversation" },
      { status: 500 },
    );
  }

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
      {
        error:
          message.includes("does not exist") ?
            "Chat system not initialized. Please run the database migration." :
            message,
      },
      { status: 400 },
    );
  }

  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversation_id);

  return NextResponse.json({ message: data }, { status: 201 });
}
