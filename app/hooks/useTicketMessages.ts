import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export interface TicketMessageStatus {
  ticketId: string;
  unreadCount: number;
  hasUnread: boolean;
  lastMessageAt: string | null;
}

export function useTicketMessages(userId: string | undefined) {
  const [ticketMessages, setTicketMessages] = useState<Record<string, TicketMessageStatus>>({});
  const [loading, setLoading] = useState(true);
  const requestIdRef = useRef(0);

  const fetchUnreadCounts = useCallback(async () => {
    if (!userId) {
      setTicketMessages({});
      setLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;

    try {
      // Get all conversations for this user
      const { data: conversations } = await supabase
        .from("conversations")
        .select("id, ticket_id")
        .or(`created_by.eq.${userId},created_for.eq.${userId}`);

      if (requestId !== requestIdRef.current) return;

      if (!conversations || conversations.length === 0) {
        setTicketMessages({});
        setLoading(false);
        return;
      }

      const conversationIds = conversations.map((c) => c.id);
      const ticketIdToConv: Record<string, string> = {};
      conversations.forEach((c) => {
        if (c.ticket_id) {
          ticketIdToConv[c.ticket_id] = c.id;
        }
      });

      // Get unread messages for each conversation
      const { data: messages } = await supabase
        .from("messages")
        .select("conversation_id, created_at, sender_id, read_at")
        .in("conversation_id", conversationIds)
        .neq("sender_id", userId)
        .is("read_at", null)
        .order("created_at", { ascending: false });

      if (requestId !== requestIdRef.current) return;

      // Get last message timestamp for each conversation
      const { data: lastMessages } = await supabase
        .from("messages")
        .select("conversation_id, created_at")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false });

      if (requestId !== requestIdRef.current) return;

      // Build last message map
      const lastMessageMap: Record<string, string> = {};
      if (lastMessages) {
        lastMessages.forEach((msg) => {
          if (!lastMessageMap[msg.conversation_id]) {
            lastMessageMap[msg.conversation_id] = msg.created_at;
          }
        });
      }

      // Count unread messages per ticket
      const unreadCounts: Record<string, number> = {};
      if (messages) {
        messages.forEach((msg) => {
          const ticketId = Object.keys(ticketIdToConv).find(
            (tid) => ticketIdToConv[tid] === msg.conversation_id
          );
          if (ticketId) {
            unreadCounts[ticketId] = (unreadCounts[ticketId] || 0) + 1;
          }
        });
      }

      // Build the final status map
      const status: Record<string, TicketMessageStatus> = {};
      Object.entries(ticketIdToConv).forEach(([ticketId, convId]) => {
        const count = unreadCounts[ticketId] || 0;
        status[ticketId] = {
          ticketId,
          unreadCount: count,
          hasUnread: count > 0,
          lastMessageAt: lastMessageMap[convId] || null,
        };
      });

      setTicketMessages(status);
    } catch (error) {
      console.error("Failed to fetch ticket message status:", error);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    fetchUnreadCounts();

    // Set up real-time subscription for new messages
    if (!userId) return;

    const channel = supabase
      .channel("user-message-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        () => {
          fetchUnreadCounts();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        () => {
          fetchUnreadCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchUnreadCounts]);

  return { ticketMessages, loading, refresh: fetchUnreadCounts };
}
