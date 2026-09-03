"use client";

import { useState } from "react";
import { usePagination, Pagination } from "@/components/Pagination";
import { ticketStatusStyles, priorityStyles } from "@/lib/styles";
import { formatDate } from "@/lib/utils";
import type { Ticket } from "../../types/ticket";
import ReassignButton from "./ReassignButton";
import WeeklyReportButton from "@/components/WeeklyReportButton";

interface TicketsSectionProps {
  tickets: Ticket[];
  staffList: Array<{ id: string; name: string; email: string; role: string; avatar: string; active: boolean }>;
  onViewTicket: (ticket: Ticket) => void;
  onReassign: (ticketId: string, staffId: string) => void;
}

export default function TicketsSection({ tickets, staffList, onViewTicket, onReassign }: TicketsSectionProps) {
  const [filter, setFilter] = useState<string>("all");

  const filtered =
    filter === "all"
      ? tickets
      : tickets.filter((t) => t.status === filter);

  const { paginatedItems: paginatedTickets, page: ticketsPage, totalPages: ticketsTotalPages, setPage: setTicketsPage } = usePagination(filtered);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {(["all", "open", "in_progress", "resolved", "closed"] as const).map(
            (s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  filter === s
                    ? "bg-foreground text-background"
                    : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                {s.replace("_", " ")}
              </button>
            ),
          )}
        </div>
        <WeeklyReportButton tickets={tickets} userRole="superadmin" />
      </div>

      <div className="space-y-3">
        {paginatedTickets.map((ticket) => (
          <div
            key={ticket.id}
            className="rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    {ticket.id}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ticketStatusStyles[ticket.status]}`}
                  >
                    {ticket.status.replace("_", " ")}
                  </span>
                  <span
                    className={`text-xs font-medium capitalize ${priorityStyles[ticket.priority]}`}
                  >
                    {ticket.priority}
                  </span>
                  <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
                    {ticket.category}
                  </span>
                </div>
                <h3 className="mt-2 text-sm font-semibold text-foreground">
                  {ticket.subject}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>By {ticket.submittedBy}</span>
                  <span>→ {ticket.assignedAgent}</span>
                  <span>Created {formatDate(ticket.createdAt)}</span>
                  <span>Updated {formatDate(ticket.updatedAt)}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <ReassignButton ticket={ticket} staffList={staffList} onReassign={onReassign} />
                <button
                  onClick={() => onViewTicket(ticket)}
                  className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  View
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Pagination page={ticketsPage} totalPages={ticketsTotalPages} onPageChange={setTicketsPage} />

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 py-16 dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No tickets in this category.
          </p>
        </div>
      )}
    </div>
  );
}
