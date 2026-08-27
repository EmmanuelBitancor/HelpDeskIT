import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/api/_lib/auth";

export async function listConversationsHandler(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const supabase = authResult.supabase;
  const account = authResult.account;

  const otherParty = request.nextUrl.searchParams.get("other_party");

  if (otherParty) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(otherParty)) {
      return NextResponse.json({ error: "Invalid other_party format" }, { status: 400 });
    }
  }

  let query = supabase
    .from("conversations")
    .select("*")
    .or(`created_by.eq.${account.id},created_for.eq.${account.id}`)
    .order("updated_at", { ascending: false });

  if (otherParty) {
    query = query.or(
      `and(created_by.eq.${account.id},created_for.eq.${otherParty}),and(created_by.eq.${otherParty},created_for.eq.${account.id})`,
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("Conversations query error:", error);
    const message = error.message || "Failed to fetch conversations";
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

  const conversations = data || [];
  const conversationIds = conversations.map((c) => c.id);
  const unreadCounts: Record<string, number> = {};

  if (conversationIds.length > 0) {
    const { data: unreadMessages, error: unreadError } = await supabase
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", conversationIds)
      .neq("sender_id", account.id)
      .is("read_at", null);

    if (unreadError) {
      console.error("Unread counts query error:", unreadError);
    } else if (unreadMessages) {
      for (const msg of unreadMessages) {
        unreadCounts[msg.conversation_id] = (unreadCounts[msg.conversation_id] || 0) + 1;
      }
    }
  }

  return NextResponse.json({ conversations, unreadCounts });
}
