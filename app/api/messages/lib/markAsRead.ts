import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/api/_lib/auth";

export async function markAsReadHandler(request: NextRequest) {
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

  const { error: readError } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .neq("sender_id", account.id)
    .is("read_at", null);

  if (readError) {
    console.error("Mark-as-read error:", readError);
    return NextResponse.json({ error: "Failed to mark messages as read" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
