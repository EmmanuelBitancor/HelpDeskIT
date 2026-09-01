"use client";

import { useEffect, useRef, useState } from "react";

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface NewConversationModalProps {
  show: boolean;
  recipients: UserInfo[];
  onClose: () => void;
  onSelect: (recipientId: string) => void;
}

const avatarColors = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-indigo-500",
];

export default function NewConversationModal({
  show,
  recipients,
  onClose,
  onSelect,
}: NewConversationModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [search, setSearch] = useState("");

  const filteredRecipients = recipients.filter((recipient) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;

    return (
      recipient.name.toLowerCase().includes(query) ||
      recipient.email.toLowerCase().includes(query) ||
      recipient.role.toLowerCase().includes(query)
    );
  });

  useEffect(() => {
    if (!show) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => !el.hasAttribute("disabled"));

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
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocusRef.current && previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className="absolute inset-0 z-10 flex items-start justify-center overflow-y-auto bg-black/50 p-4 safe-top safe-bottom sm:items-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="newConversationTitle"
        tabIndex={-1}
        className="my-4 w-full max-w-md rounded-2xl bg-white shadow-xl dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h3 id="newConversationTitle" className="text-lg font-semibold text-foreground">
            New Message
          </h3>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">
          <div className="mb-4">
            <label htmlFor="recipient-search" className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
              Search people
            </label>
            <input
              id="recipient-search"
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, email, or role"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-foreground placeholder-zinc-400 outline-none transition-colors focus:border-foreground focus:ring-1 focus:ring-foreground dark:border-zinc-700 dark:bg-zinc-800 dark:placeholder-zinc-500"
            />
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {recipients.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60">
                No available recipients
              </p>
            ) : filteredRecipients.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60">
                No matching recipients found
              </p>
            ) : (
              filteredRecipients.map((recipient) => (
                <button
                  key={recipient.id}
                  onClick={() => onSelect(recipient.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-left transition-all hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-700"
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white ${
                      avatarColors[(recipient.name || recipient.email).charCodeAt(0) % avatarColors.length]
                    }`}
                  >
                    {(recipient.name || recipient.email)
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{recipient.name}</p>
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
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
  );
}
