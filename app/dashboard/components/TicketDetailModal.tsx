"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Ticket, TicketHistoryEntry } from "../../types/ticket";
import { toHistoryEntry } from "../../types/mappers";

interface TicketDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: Ticket | null;
}

const priorityLabels: Record<Ticket["priority"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const statusLabels: Record<Ticket["status"], string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

const statusColors: Record<Ticket["status"], string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  in_progress:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  resolved:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  closed: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const priorityColors: Record<Ticket["priority"], string> = {
  low: "text-zinc-500",
  medium: "text-amber-600",
  high: "text-orange-600",
  critical: "text-red-600",
};

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function TicketDetailModal({
  isOpen,
  onClose,
  ticket,
}: TicketDetailModalProps) {
  const [history, setHistory] = useState<TicketHistoryEntry[]>(ticket?.history ?? []);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const getFocusableElements = useCallback(() => {
    if (!dialogRef.current) return [];
    return Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute("disabled"));
  }, []);

  useEffect(() => {
    if (isOpen && ticket) {
      const fetchHistory = async () => {
        setIsLoadingHistory(true);
        try {
          const response = await fetch(`/api/ticket-history/${ticket.id}`);
          if (response.ok) {
            const data = await response.json();
            setHistory(data.entries ?? []);
          }
        } catch (error) {
          console.error("Failed to fetch ticket history:", error);
        } finally {
          setIsLoadingHistory(false);
        }
      };
      fetchHistory();
    }
  }, [isOpen, ticket]);

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
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
      previousFocus.focus();
    };
  }, [isOpen, onClose, getFocusableElements]);

  if (!isOpen || !ticket) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticketDetailTitle"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl rounded-2xl bg-white shadow-xl dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h3 id="ticketDetailTitle" className="text-lg font-semibold text-foreground">
            {ticket.subject}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          <div className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                {ticket.id}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[ticket.status]}`}
              >
                {statusLabels[ticket.status]}
              </span>
              <span
                className={`text-xs font-medium ${priorityColors[ticket.priority]}`}
              >
                {priorityLabels[ticket.priority]}
              </span>
              <span className="text-xs rounded-md bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                {ticket.category}
              </span>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Description</h4>
              <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-line">
                {ticket.description}
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                  />
                </svg>
                Created {formatDate(ticket.createdAt)}
              </span>
              <span className="inline-flex items-center gap-1">
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992h4.992m12.012 0h4.992v4.992M2.985 9.348v4.992h4.992"
                  />
                </svg>
                Updated {formatDate(ticket.updatedAt)}
              </span>
              {ticket.submittedBy && (
                <span>Submitted by: {ticket.submittedBy}</span>
              )}
            </div>

            {ticket.assignedStaff && (
              <div className="flex items-center gap-2 text-sm">
                <img
                  src={ticket.assignedStaff.avatar}
                  alt={ticket.assignedStaff.name}
                  className="h-8 w-8 rounded-full"
                />
                <div>
                  <p className="font-medium text-zinc-800 dark:text-zinc-200">
                    {ticket.assignedStaff.name}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {ticket.assignedStaff.email} • {ticket.assignedStaff.role}
                  </p>
                </div>
              </div>
            )}

            {ticket.resolutionNotes && (
              <div className="border-t border-zinc-200 pt-4">
                <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Resolution Notes</h4>
                <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-line bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3">
                  {ticket.resolutionNotes}
                </p>
              </div>
            )}

            {history.length > 0 && (
              <div className="border-t border-zinc-200 pt-4">
                <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">History</h4>
                <div className="space-y-3">
                  {history.map((entry) => (
                    <div
                      key={entry.id}
                      className="border-l-2 border-zinc-200 pl-4 dark:border-zinc-700"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                          {new Date(entry.at).toLocaleString()}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[entry.status]}`}
                        >
                          {statusLabels[entry.status]}
                        </span>
                      </div>
                      {entry.note && (
                        <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">
                          {entry.note}
                        </p>
                      )}
                      {entry.by && entry.by !== ticket.assignedStaff?.id && (
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          Updated by: {entry.by}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isLoadingHistory && (
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Loading history...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}