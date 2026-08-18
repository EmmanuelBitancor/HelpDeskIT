"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  created_by: string;
  created_for: string;
  created_by_role: string;
  created_for_role: string;
  updated_at: string;
}

interface SupportChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string;
  ticketSubject: string;
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  assignedStaff: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export default function SupportChatModal({
  isOpen,
  onClose,
  ticketId,
  ticketSubject,
  currentUser,
  assignedStaff,
}: SupportChatModalProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const getFocusableElements = useCallback(() => {
    if (!dialogRef.current) return [];
    return Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute("disabled"));
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = getFocusableElements();
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || !dialogRef.current?.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !dialogRef.current?.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    dialogRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const findOrCreateConversation = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/conversations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            staff_email: assignedStaff.email,
            ticket_id: ticketId,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Server error: ${res.status}`);
        }

        if (data.conversation) {
          setConversation(data.conversation);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load chat");
      } finally {
        setIsLoading(false);
      }
    };

    findOrCreateConversation();
  }, [isOpen, currentUser.id, assignedStaff.email, ticketId]);

  useEffect(() => {
    if (!conversation) return;
    let mounted = true;

    const channel = supabase
      .channel(`realtime-support-chat-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          if (!mounted) return;
          const newMessage = payload.new as Message;
          if (newMessage.sender_id !== currentUser.id) {
            setMessages((prev) => [...prev, newMessage]);
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [conversation, currentUser.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!conversation) return;
    let mounted = true;

    const loadMessages = async () => {
      try {
        const res = await fetch(`/api/messages?conversation_id=${conversation.id}`);
        const data = await res.json();
        if (mounted && res.ok && data.messages) {
          setMessages(data.messages);
        }
      } catch {
        // ignore
      }
    };

    loadMessages();

    return () => {
      mounted = false;
    };
  }, [conversation]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversation || isSending) return;

    setIsSending(true);
    setError(null);
    const tempContent = newMessage.trim();
    setNewMessage("");

    try {
      const res = await fetch(`/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversation.id,
          content: tempContent,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Server error: ${res.status}`);
      }
      if (data.message) {
        setMessages((prev) => [...prev, data.message]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setNewMessage(tempContent);
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="supportChatTitle"
        tabIndex={-1}
        className="flex h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div className="min-w-0">
            <h3 id="supportChatTitle" className="truncate text-base font-semibold text-foreground">
              {assignedStaff.name}
            </h3>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {ticketSubject}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="border-b border-red-200 bg-red-50 px-5 py-2.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
            {error}
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="Dismiss error"
              className="ml-2 text-red-500 hover:text-red-700 dark:hover:text-red-300"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex flex-1 flex-col">
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="space-y-3 p-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-3 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                    <div className="h-3 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4">
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-zinc-400">
                    Start a conversation with {assignedStaff.name}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((message) => {
                      const isOwn = message.sender_id === currentUser.id;
                      return (
                          <div
                            key={message.id}
                            className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                                isOwn
                                  ? "rounded-br-sm bg-foreground text-background"
                                  : "rounded-bl-sm bg-zinc-100 text-foreground dark:bg-zinc-800"
                              }`}
                            >
                              {!isOwn && (
                                <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                  {message.sender_name}
                                </p>
                              )}
                              <p className="whitespace-pre-line">{message.content}</p>
                              <p
                                className={`mt-1 text-xs ${
                                  isOwn ? "text-white/60" : "text-zinc-400"
                                }`}
                              >
                                {formatTime(message.created_at)}
                              </p>
                            </div>
                          </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Type a message..."
                    disabled={isSending}
                    className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground placeholder-zinc-400 outline-none transition-colors focus:border-foreground focus:ring-1 focus:ring-foreground dark:border-zinc-700 dark:bg-zinc-800 disabled:opacity-50"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || isSending}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
