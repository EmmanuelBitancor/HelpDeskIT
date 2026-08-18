"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Skeleton } from "@/components/skeleton";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

interface Conversation {
  id: string;
  created_by: string;
  created_for: string;
  created_by_role: string;
  created_for_role: string;
  created_by_name?: string;
  created_for_name?: string;
  updated_at: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  created_at: string;
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface ChatPanelProps {
  currentUser: UserInfo;
  getRecipients: () => Promise<UserInfo[]>;
  title?: string;
  onClose: () => void;
}

export default function ChatPanel({
  currentUser,
  getRecipients,
  title = "Messages",
  onClose,
}: ChatPanelProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [recipients, setRecipients] = useState<UserInfo[]>([]);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const newConversationRef = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef<string | null>(null);

  const getFocusableElements = useCallback((containerRef: React.RefObject<HTMLDivElement | null>) => {
    if (!containerRef.current) return [];
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute("disabled"));
  }, []);

  useEffect(() => {
    if (!showNewConversation) return;

    const previousFocus = document.activeElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowNewConversation(false);
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = getFocusableElements(newConversationRef);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || !newConversationRef.current?.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !newConversationRef.current?.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    newConversationRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocus && previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    };
  }, [showNewConversation, getFocusableElements]);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch(`/api/conversations`);
      const data = await res.json();
      if (res.ok && data.conversations) {
        setConversations(data.conversations);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadRecipients = useCallback(async () => {
    try {
      const users = await getRecipients();
      setRecipients(users.filter((u) => u.id !== currentUser.id));
    } catch {
      // ignore
    }
  }, [currentUser.id, getRecipients]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadConversations();
    loadRecipients();
  }, [currentUser.id, loadConversations, loadRecipients]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (showNewConversation) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = getFocusableElements(dialogRef);
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
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showNewConversation, onClose, getFocusableElements]);

  useEffect(() => {
    if (!selectedConversation) return;
    let mounted = true;

    const channel = supabase
      .channel(`realtime-chat-${selectedConversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedConversation.id}`,
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
  }, [selectedConversation, currentUser.id]);

  const selectConversation = async (conversation: Conversation) => {
    selectedIdRef.current = conversation.id;
    setSelectedConversation(conversation);
    setMessages([]);
    try {
      const res = await fetch(`/api/messages?conversation_id=${conversation.id}`);
      const data = await res.json();
      if (selectedIdRef.current === conversation.id && res.ok && data.messages) {
        setMessages(data.messages);
      }
    } catch {
      // ignore
    }
  };

  const startConversation = async (recipientId: string) => {
    try {
      setError(null);
      const res = await fetch(`/api/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ created_for: recipientId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Server error: ${res.status}`);
      }
      if (data.conversation) {
        setConversations((prev) =>
          prev.some((c) => c.id === data.conversation.id) ? prev : [data.conversation, ...prev]
        );
        setSelectedConversation(data.conversation);
        setMessages([]);
        setShowNewConversation(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || isSending) return;

    setIsSending(true);
    setError(null);
    const tempContent = newMessage.trim();
    setNewMessage("");

    try {
      const res = await fetch(`/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: selectedConversation.id,
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

  const getConversationTitle = (conversation: Conversation) => {
    const otherId =
      conversation.created_by === currentUser.id
        ? conversation.created_for
        : conversation.created_by;
    const other = recipients.find((r) => r.id === otherId);
    if (other) return other.name || other.email || "Unknown";

    const storedName =
      conversation.created_by === currentUser.id
        ? conversation.created_for_name
        : conversation.created_by_name;
    if (storedName) return storedName;

    return "Unknown";
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chatPanelTitle"
        tabIndex={-1}
        className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h3 id="chatPanelTitle" className="text-lg font-semibold text-foreground">
            {title}
          </h3>
          <button
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
              <div className="border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
                {error}
                <button
                  onClick={() => setError(null)}
                  aria-label="Dismiss error"
                  className="ml-2 text-red-500 hover:text-red-700 dark:hover:text-red-300"
                >
                  ✕
                </button>
              </div>
            )}

        <div className="flex flex-1 overflow-hidden">
          {/* Conversations list */}
          <div className="w-64 border-r border-zinc-200 dark:border-zinc-800">
            <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
              <button
                onClick={() => setShowNewConversation(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-3 py-2 text-sm font-semibold text-background transition-colors hover:opacity-90"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                New Message
              </button>
            </div>
            <div className="h-full overflow-y-auto">
              {isLoading ? (
                <div className="space-y-3 p-4">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-4 text-center text-sm text-zinc-400">No conversations yet</div>
              ) : (
                conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    onClick={() => selectConversation(conversation)}
                    className={`flex w-full flex-col items-start gap-1 border-b border-zinc-100 p-3 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800 ${
                      selectedConversation?.id === conversation.id
                        ? "bg-zinc-100 dark:bg-zinc-800"
                        : ""
                    }`}
                  >
                    <span className="text-sm font-medium text-foreground">
                      {getConversationTitle(conversation)}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {new Date(conversation.updated_at).toLocaleDateString()}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Messages area */}
          <div className="flex flex-1 flex-col">
            {selectedConversation ? (
              <>
                <div className="border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
                  <h4 className="text-sm font-semibold text-foreground">
                    {getConversationTitle(selectedConversation)}
                  </h4>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-zinc-400">
                      No messages yet. Start the conversation!
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
                              className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                                isOwn
                                  ? "rounded-br-sm bg-foreground text-background"
                                  : "rounded-bl-sm bg-zinc-100 text-foreground dark:bg-zinc-800"
                              }`}
                            >
                              {!isOwn && (
                                <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                  {message.sender_name} ({message.sender_role})
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
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-zinc-400">
                Select a conversation or start a new one
              </div>
            )}
          </div>
        </div>

        {/* New conversation modal */}
        {showNewConversation && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 p-4">
            <div
              ref={newConversationRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="newConversationTitle"
              tabIndex={-1}
              className="w-full max-w-md rounded-2xl bg-white shadow-xl dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
                <h3 id="newConversationTitle" className="text-lg font-semibold text-foreground">
                  New Message
                </h3>
                <button
                  onClick={() => setShowNewConversation(false)}
                  aria-label="Close dialog"
                  className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6">
                <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
                  Select a recipient to start a conversation:
                </p>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {recipients.length === 0 ? (
                    <p className="text-sm text-zinc-400">No available recipients</p>
                  ) : (
                    recipients.map((recipient) => (
                      <button
                        key={recipient.id}
                        onClick={() => startConversation(recipient.id)}
                        className="flex w-full items-center gap-3 rounded-lg border border-zinc-200 p-3 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      >
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white ${
                            avatarColors[(recipient.name || recipient.email).charCodeAt(0) % avatarColors.length]
                          }`}
                        >
                          {(recipient.name || recipient.email)
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{recipient.name}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {recipient.role} · {recipient.email}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const avatarColors = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-indigo-500",
];
