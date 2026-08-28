import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/api/_lib/auth";

export async function getMessagesHandler(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const supabase = authResult.supabase;
  const account = authResult.account;

  const conversationId = request.nextUrl.searchParams.get("conversation_id");

  if (!conversationId) {
    return NextResponse.json(
      { error: "conversation_id is required" },
      { status: 400 },
    );
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
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

  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (messagesError) {
    console.error("Messages query error:", messagesError);
    const message = messagesError.message || "Failed to fetch messages";
    return NextResponse.json(
      {
        error:
          message.includes("does not exist") ?
            "Chat system not initialized. Please run the database migration." :
            message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ messages: messages || [] });
}
