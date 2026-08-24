import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
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
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const unreadMessages = await countUnreadMessages(supabase, account.id);
    const pendingUsers = await countPendingUsers(supabase, account);
    const systemErrors = await countSystemErrors(supabase, account);
    const recentActivities = await countRecentActivities(supabase, account.id);

    return NextResponse.json({
      unreadMessages,
      pendingUsers,
      systemErrors,
      recentActivities,
    });
  } catch (error) {
    console.error("Notifications count error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function countUnreadMessages(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<number> {
  const { data: userConversations } = await supabase
    .from("conversations")
    .select("id")
    .or(`created_by.eq.${userId},created_for.eq.${userId}`);

  const conversationIds = (userConversations || []).map((c) => c.id);
  if (conversationIds.length === 0) return 0;

  const { count, error } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .is("read_at", null)
    .neq("sender_id", userId)
    .in("conversation_id", conversationIds);

  if (error) {
    console.error("Unread messages count error:", error);
    return 0;
  }

  return count || 0;
}

async function countPendingUsers(supabase: Awaited<ReturnType<typeof createClient>>, account: { id: string; role: string }): Promise<number> {
  if (account.role !== "superadmin" && account.role !== "admin") {
    return 0;
  }

  const { count, error } = await supabase
    .from("accounts")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  if (error) {
    console.error("Pending users count error:", error);
    return 0;
  }

  return count || 0;
}

async function countSystemErrors(
  supabase: Awaited<ReturnType<typeof createClient>>,
  account: { role: string }
): Promise<number> {
  if (account.role !== "superadmin" && account.role !== "admin") {
    return 0;
  }

  const { count, error } = await supabase
    .from("system_logs")
    .select("*", { count: "exact", head: true })
    .eq("level", "error")
    .gte("timestamp", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    console.error("System errors count error:", error);
    return 0;
  }

  return count || 0;
}

async function countRecentActivities(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("activity_logs")
    .select("*", { count: "exact", head: true })
    .eq("actor_id", userId)
    .in("target_type", ["user", "ticket"])
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    console.error("Recent activities count error:", error);
    return 0;
  }

  return count || 0;
}
