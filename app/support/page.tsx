"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import TicketDetailModal from "./components/TicketDetailModal";
import { Ticket, SupportStaff, TicketStatus, TicketHistoryEntry } from "./types";
import { toStaff, toHistoryEntry, toSupportTicket } from "../types/mappers";
import { useAuth } from "@/context/AuthContext";
import { FORBIDDEN_ROUTE } from "@/context/authTypes";
import SignOutButton from "@/components/SignOutButton";
import Loading from "@/components/Loading";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

const statusStyles: Record<TicketStatus, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  in_progress:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  resolved:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  closed: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const priorityStyles: Record<string, string> = {
  low: "text-zinc-500",
  medium: "text-amber-600",
  high: "text-orange-600",
  critical: "text-red-600",
};

const priorityLabels: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getAvatarColor(name: string) {
  const colors = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-indigo-500",
  ];
  const index = name
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[index % colors.length];
}

export default function SupportDashboard() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [staffList, setStaffList] = useState<SupportStaff[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(true);

  const currentStaff = useMemo<SupportStaff | null>(
    () => (user ? staffList.find((s) => s.email === user.email) ?? null : null),
    [user, staffList],
  );

  useEffect(() => {
    if (!user?.email) return;
    let active = true;
    (async () => {
      try {
        const { data: staffData } = await supabase
          .from("support_staff")
          .select("*")
          .order("name");
        if (!active || !staffData) return;
        const staff = staffData.map(toStaff);
        setStaffList(staff);
        const me = staff.find((s) => s.email === user.email) ?? staff[0];
        if (!me) return;
        const { data: ticketsData } = await supabase
          .from("tickets")
          .select("*")
          .eq("assigned_to", me.id)
          .order("created_at", { ascending: false });
        if (!active) return;
        const ticketIds = (ticketsData ?? []).map((r) => String(r.id));
        const { data: historyData } = ticketIds.length
          ? await supabase
              .from("ticket_history")
              .select("*")
              .in("ticket_id", ticketIds)
              .order("at")
          : { data: [] };
        if (!active) return;
        const byTicket = new Map<string, TicketHistoryEntry[]>();
        (historyData ?? []).forEach((h) => {
          const key = String(h.ticket_id);
          const arr = byTicket.get(key) ?? [];
          arr.push(toHistoryEntry(h));
          byTicket.set(key, arr);
        });
        setTickets(
          (ticketsData ?? []).map((r) =>
            toSupportTicket(r, byTicket.get(String(r.id)) ?? []),
          ),
        );
      } finally {
        if (active) setIsLoadingStaff(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.email]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [draftStatus, setDraftStatus] = useState<Ticket["status"]>("open");
  const [draftNotes, setDraftNotes] = useState("");
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.classList.toggle("dark", theme === "dark");
      localStorage.setItem("theme", theme);
    }
  }, [theme]);

  const myTickets = useMemo(
    () => (currentStaff ? tickets.filter((t) => t.assignedTo === currentStaff.id) : []),
    [tickets, currentStaff],
  );

  const filteredTickets = useMemo(() => {
    const query = search.toLowerCase().trim();
    return myTickets.filter((ticket) => {
      const matchesStatus =
        statusFilter === "all" || ticket.status === statusFilter;
      const matchesSearch =
        !query ||
        ticket.id.toLowerCase().includes(query) ||
        ticket.subject.toLowerCase().includes(query) ||
        ticket.description.toLowerCase().includes(query) ||
        ticket.category.toLowerCase().includes(query) ||
        (ticket.submittedBy &&
          ticket.submittedBy.toLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [myTickets, search, statusFilter]);

  const stats = useMemo(() => {
    const open = myTickets.filter((t) => t.status === "open").length;
    const inProgress = myTickets.filter((t) => t.status === "in_progress")
      .length;
    const resolved = myTickets.filter((t) => t.status === "resolved").length;
    const closed = myTickets.filter((t) => t.status === "closed").length;
    const critical = myTickets.filter(
      (t) =>
        t.priority === "critical" &&
        t.status !== "closed" &&
        t.status !== "resolved",
    ).length;
    return { open, inProgress, resolved, closed, total: myTickets.length, critical };
  }, [myTickets]);

  const updateTicketStatus = async (
    ticketId: string,
    status: TicketStatus,
    resolutionNotes: string,
  ) => {
    const now = new Date().toISOString();
    const historyId = `h-${ticketId}-${Date.now()}`;
    const { error: ticketError } = await supabase
      .from("tickets")
      .update({ status, updated_at: now, resolution_notes: resolutionNotes })
      .eq("id", ticketId);
    if (ticketError) {
      console.error("Failed to update ticket", ticketError);
      return;
    }
    const { error: historyError } = await supabase.from("ticket_history").insert({
      id: historyId,
      ticket_id: ticketId,
      status,
      note: resolutionNotes,
      by: currentStaff!.id,
      at: now,
    });
    if (historyError) console.error("Failed to record history", historyError);
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? {
              ...t,
              status,
              updatedAt: now,
              resolutionNotes,
              history: [
                ...(t.history ?? []),
                {
                  id: historyId,
                  status,
                  note: resolutionNotes,
                  by: currentStaff!.id,
                  at: now,
                },
              ],
            }
          : t,
      ),
    );
  };

  const openTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setDraftStatus(ticket.status);
    setDraftNotes(ticket.resolutionNotes ?? "");
    setIsDetailOpen(true);
  };

  const closeDetail = () => {
    setIsDetailOpen(false);
    setSelectedTicket(null);
  };

  const saveTicketUpdate = () => {
    if (!selectedTicket) return;
    updateTicketStatus(selectedTicket.id, draftStatus, draftNotes);
    closeDetail();
  };

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      localStorage.setItem("theme", next);
      return next;
    });
  };

  const priority = (ticket: Ticket) => priorityLabels[ticket.priority];

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/");
    } else if (user.role !== "support") {
      router.replace(FORBIDDEN_ROUTE);
    }
  }, [user, loading, router]);

  if (loading) return <Loading />;
  if (!user || user.role !== "support") {
    return <Loading />;
  }

  if (isLoadingStaff || !currentStaff) return <Loading />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-2 py-2">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 text-white">
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
                    d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">
                  HelpDeskIT Support
                </h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Support Staff Dashboard
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full ${getAvatarColor(
                  currentStaff.name,
                )} text-xs font-semibold text-white`}
              >
                {currentStaff.avatar}
              </div>
              <span className="hidden text-sm font-medium text-foreground sm:inline">
                {currentStaff.name}
              </span>
              <button
                onClick={toggleTheme}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21.75 15.002A9 9 0 1112 2.25a.75.75 0 01.696 1.03 7.5 7.5 0 008.024 10.026.75.75 0 01.03 1.696z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 3v1.5m0 15V21m9-9h-1.5m-15 0H3m15.364 6.364l-1.06-1.06M6.697 6.697l-1.06-1.06m12.728 0l-1.06 1.06M6.697 17.303l-1.06 1.06M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                )}
                Theme
              </button>
              <span className="hidden text-sm text-zinc-600 dark:text-zinc-400 sm:inline">
                {currentStaff.email}
              </span>
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-2">
          <h2 className="text-2xl font-semibold text-foreground">
            {`${currentStaff.name}'s Dashboard`}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {currentStaff.role} &middot; {currentStaff.email}
          </p>
        </div>

        <div className="mb-8 flex items-center gap-4">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full ${getAvatarColor(
              currentStaff.name,
            )} text-sm font-semibold text-white`}
          >
            {currentStaff.avatar}
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Active Tickets
            </p>
            <p className="text-2xl font-semibold text-foreground">
              {stats.total} total
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Total
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {stats.total}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Open
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {stats.open}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              In Progress
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {stats.inProgress}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Resolved
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {stats.resolved}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Closed
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {stats.closed}
            </p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/20">
            <p className="text-xs font-medium text-red-600 dark:text-red-400">
              Critical
            </p>
            <p className="mt-1 text-2xl font-semibold text-red-700 dark:text-red-300">
              {stats.critical}
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-md">
                <svg
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 0010.5 18.75a7.5 7.5 0 00-7.5-7.5A7.5 7.5 0 003.75 10.5m0 0L21 21z"
                  />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tickets..."
                  className="w-full rounded-lg border border-zinc-300 py-2 pl-9 pr-4 text-sm text-foreground placeholder-zinc-400 outline-none transition-colors focus:border-foreground focus:ring-1 focus:ring-foreground dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
              <div className="flex gap-3">
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as TicketStatus | "all")
                  }
                  className="rounded-lg border border-zinc-300 py-2 pl-3 pr-8 text-sm text-foreground outline-none transition-colors focus:border-foreground focus:ring-1 focus:ring-foreground dark:border-zinc-700 dark:bg-zinc-800"
                >
                  <option value="all">All Statuses</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
                <tr>
                  <th className="px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                    Ticket ID
                  </th>
                  <th className="px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                    Subject
                  </th>
                  <th className="px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                    Category
                  </th>
                  <th className="px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                    Priority
                  </th>
                  <th className="px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                    Status
                  </th>
                  <th className="px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                    Submitted By
                  </th>
                  <th className="px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                    Created
                  </th>
                  <th className="px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredTickets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-12 text-center text-zinc-500 dark:text-zinc-400"
                    >
                      No tickets found matching your filters
                    </td>
                  </tr>
                ) : (
                  filteredTickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <td className="px-6 py-4 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                        {ticket.id}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => openTicket(ticket)}
                          className="text-left font-medium text-foreground hover:underline"
                        >
                          {ticket.subject}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">
                        {ticket.category}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs font-medium ${priorityStyles[ticket.priority]}`}
                        >
                          {priority(ticket)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[ticket.status]}`}
                        >
                          {ticket.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">
                        {ticket.submittedBy || "—"}
                      </td>
                      <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">
                        {formatDate(ticket.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => openTicket(ticket)}
                          className="text-xs font-medium text-foreground underline hover:no-underline"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <TicketDetailModal
        isOpen={isDetailOpen}
        onClose={closeDetail}
        ticket={selectedTicket}
        staffList={staffList}
        currentStaff={currentStaff}
        draftStatus={draftStatus}
        draftNotes={draftNotes}
        onDraftStatusChange={setDraftStatus}
        onDraftNotesChange={setDraftNotes}
        onSave={saveTicketUpdate}
        getAvatarColor={getAvatarColor}
      />
    </div>
  );
}
