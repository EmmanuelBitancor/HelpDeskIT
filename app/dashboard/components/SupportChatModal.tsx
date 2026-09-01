"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useNotifications } from "@/app/hooks/useNotifications";

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
  const { refresh: refreshNotifications } = useNotifications();
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
          throw new Error(data.error || `Server error: ${res.status}. Please try again.`);
        }

        if (data.conversation) {
          setConversation(data.conversation);
        }
} catch (err) {
          setError(err instanceof Error ? err.message : "We couldn't load the chat. Please check your connection and try again.");
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
          // Mark messages as read after rendering.
          await fetch(`/api/messages/read?conversation_id=${conversation.id}`, {
            method: "PATCH",
          });
          refreshNotifications();
        }
      } catch {
        // ignore
      }
    };

    loadMessages();

    return () => {
      mounted = false;
    };
  }, [conversation, refreshNotifications]);

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
          throw new Error(data.error || `Server error: ${res.status}. Please try again.`);
        }
      if (data.message) {
        setMessages((prev) => [...prev, data.message]);
      }
} catch (err) {
          setError(err instanceof Error ? err.message : "We couldn't send your message. Please try again.");
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
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-2 safe-top safe-bottom sm:items-center sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="supportChatTitle"
        tabIndex={-1}
        className="my-2 flex h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] bg-slate-50 shadow-[0_24px_80px_rgba(14,116,144,0.18)] ring-1 ring-sky-200 dark:bg-zinc-900 dark:ring-zinc-700 sm:my-4 sm:h-[85vh]"
      >
        <div className="flex items-center justify-between border-b border-sky-100 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-500 px-5 py-4 text-white shadow-sm">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/12 text-white shadow-sm ring-1 ring-white/30 backdrop-blur-sm">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m-8 5h12a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300" aria-label="Support is online" />
                <span className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-50">
                  Support
                </span>
              </div>
              <h3 id="supportChatTitle" className="truncate text-base font-semibold text-white">
                {assignedStaff.name}
              </h3>
              <p className="truncate text-xs text-sky-100">
                Ticket: {ticketSubject}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="rounded-lg p-1 text-sky-50/90 transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div role="alert" className="border-b border-red-200 bg-red-50 px-5 py-2.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
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
            <div className="flex flex-1 items-center justify-center bg-gradient-to-b from-sky-50 to-white dark:from-zinc-950 dark:to-zinc-900">
              <div className="space-y-3 p-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-3 w-32 animate-pulse rounded bg-sky-200 dark:bg-zinc-800" />
                    <div className="h-3 w-48 animate-pulse rounded bg-sky-100 dark:bg-zinc-800" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto bg-gradient-to-b from-sky-50/70 via-white to-sky-50/60 p-4 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-sky-200 bg-white/80 px-6 text-center text-sm text-slate-600 shadow-inner dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300">
                    Start a conversation with {assignedStaff.name}. They&apos;ll get back to you as soon as possible.
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
                            className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                              isOwn
                                ? "rounded-br-md bg-gradient-to-br from-sky-600 to-blue-600 text-white"
                                : "rounded-bl-md bg-white text-slate-700 ring-1 ring-sky-100 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
                            }`}
                          >
                            {!isOwn && (
                              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-600 dark:text-sky-300">
                                {message.sender_name}
                              </p>
                            )}
                            <p className="whitespace-pre-line">{message.content}</p>
                            <p
                              className={`mt-1 text-[11px] ${
                                isOwn ? "text-sky-100" : "text-slate-400 dark:text-zinc-400"
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

              <div className="border-t border-sky-100 bg-white/90 p-4 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/90">
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
                    placeholder="Type your message here..."
                    disabled={isSending}
                    className="flex-1 rounded-xl border border-sky-200 bg-sky-50/80 px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none transition-colors focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400 disabled:opacity-50"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || isSending}
                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-600 to-blue-600 text-white shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  </button>
                </div>
                {isSending && (
                  <p className="mt-2 text-xs text-sky-600 dark:text-sky-300">Sending…</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
