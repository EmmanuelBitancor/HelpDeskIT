"use client";

import { useRef, useEffect, useCallback } from "react";
import { formatDate } from "@/lib/utils";
import { Ticket, SupportStaff } from "../types";

interface TicketDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: Ticket | null;
  staffList: SupportStaff[];
  currentStaff: SupportStaff;
  draftStatus: Ticket["status"];
  draftNotes: string;
  onDraftStatusChange: (status: Ticket["status"]) => void;
  onDraftNotesChange: (notes: string) => void;
  onSave: () => void;
  getAvatarColor: (name: string) => string;
}

const statusOrder: Ticket["status"][] = [
  "open",
  "in_progress",
  "resolved",
  "closed",
];

function formatTime(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function TicketDetailModal({
  isOpen,
  onClose,
  ticket,
  staffList,
  currentStaff,
  draftStatus,
  draftNotes,
  onDraftStatusChange,
  onDraftNotesChange,
  onSave,
  getAvatarColor,
}: TicketDetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const modalOwnedCloseRef = useRef(false);

  const getFocusableElements = useCallback(() => {
    if (!dialogRef.current) return [];
    return Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute("disabled"));
  }, []);

  const closeModal = useCallback(() => {
    modalOwnedCloseRef.current = true;
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement as HTMLElement;
    modalOwnedCloseRef.current = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        modalOwnedCloseRef.current = true;
        onClose();
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
      if (modalOwnedCloseRef.current && previousFocus) {
        previousFocus.focus();
      }
    };
  }, [isOpen, onClose, getFocusableElements]);

  if (!isOpen || !ticket) return null;

  const canEdit = ticket.status !== "closed";
  const showNotes = draftStatus === "resolved" || draftStatus === "closed";

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4 safe-top safe-bottom sm:items-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticketDetailTitle"
        tabIndex={-1}
        className="my-4 w-full max-w-2xl rounded-2xl bg-white shadow-xl dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h3 id="ticketDetailTitle" className="text-lg font-semibold text-foreground">
            Ticket {ticket.id}
          </h3>
          <button
            onClick={closeModal}
            className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-3 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-full ${getAvatarColor(
              currentStaff.name,
            )} text-xs font-semibold text-white`}
          >
            {currentStaff.avatar}
          </div>
          <div className="text-sm">
            <span className="font-medium text-foreground">
              {currentStaff.name}
            </span>
            <span className="text-zinc-500 dark:text-zinc-400">
              {" "}
              · {currentStaff.role}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 md:gap-6">
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Ticket Subject
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {ticket.subject}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Category
            </p>
            <p className="mt-1 text-sm text-foreground">{ticket.category}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Submitted By
            </p>
            <p className="mt-1 text-sm text-foreground">
              {ticket.submittedBy || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Priority
            </p>
            <p className="mt-1 text-sm font-medium capitalize text-foreground">
              {ticket.priority}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Created
            </p>
            <p className="mt-1 text-sm text-foreground">
              {formatDate(ticket.createdAt)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Last Updated
            </p>
            <p className="mt-1 text-sm text-foreground">
              {formatDate(ticket.updatedAt)}
            </p>
          </div>
        </div>

        <div className="border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Description
          </p>
          <p className="mt-1 whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">
            {typeof ticket.description === 'string' ? ticket.description.replace(/\s*\|\s*/g, '\n') : ticket.description}
          </p>
        </div>

        {ticket.history && ticket.history.length > 0 && (
          <div className="border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Ticket History
            </p>
            <ul className="mt-2 space-y-2">
              {ticket.history.map((entry) => {
                const author =
                  entry.by === currentStaff.id
                    ? currentStaff.name
                    : staffList.find((s) => s.id === entry.by)?.name ??
                      entry.by;
                return (
                  <li key={entry.id} className="flex flex-wrap gap-2 text-sm">
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      {formatDate(entry.at)} {formatTime(entry.at)}
                    </span>
                    <span className="font-medium text-foreground">
                      {author}
                    </span>
                    <span className="text-zinc-600 dark:text-zinc-400">
                          changed status to
                        </span>
                    <span className="font-medium text-foreground">
                      {entry.status.replace("_", " ")}
                    </span>
                    {entry.note && (
                      <>
                        <span className="text-zinc-600 dark:text-zinc-400">
                          —
                        </span>
                        <span className="text-zinc-600 dark:text-zinc-400">
                          {entry.note}
                        </span>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div className="mb-4">
            <label
              htmlFor="ticketStatus"
              className="block text-sm font-medium text-foreground"
            >
              Status
            </label>
            <select
              id="ticketStatus"
              value={draftStatus}
              onChange={(e) =>
                onDraftStatusChange(e.target.value as Ticket["status"])
              }
              disabled={!canEdit}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground disabled:cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-800"
            >
              {statusOrder.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          {showNotes && (
            <div className="mb-4">
              <label
                htmlFor="resolutionNotes"
                className="block text-sm font-medium text-foreground"
              >
                Resolution Notes
              </label>
              <textarea
                id="resolutionNotes"
                rows={3}
                value={draftNotes}
                onChange={(e) => onDraftNotesChange(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground dark:border-zinc-700 dark:bg-zinc-800"
                 placeholder="Describe the resolution or any follow-up actions..."
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeModal}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  onSave();
                  closeModal();
                }}
                className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-sm transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2"
              >
                Save Changes
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
