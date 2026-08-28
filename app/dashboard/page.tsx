"use client";

import { useEffect, useState } from "react";
import NewTicketModal from "./components/NewTicketModal";
import TicketDetailModal from "./components/TicketDetailModal";
import KnowledgeBase from "./components/KnowledgeBase";
import SupportChatModal from "./components/SupportChatModal";
import { useAuth } from "@/context/AuthContext";
import SignOutButton from "@/components/SignOutButton";
import { DashboardSkeleton } from "@/components/skeleton";
import ForbiddenAccessModal from "@/components/ForbiddenAccessModal";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity";
import { getCachedData, setCachedData } from "@/lib/cache";
import { usePagination, Pagination } from "@/components/Pagination";
import { ticketStatusStyles, priorityStyles } from "@/lib/styles";
import { formatDate, priorityLabels } from "@/lib/utils";
import type { Ticket, TicketPriority, SupportStaff } from "../types/ticket";
import { toAdminTicket as toTicket } from "../types/mappers";

const supabase = createClient();

export default function DashboardPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTab, setActiveTab] = useState<"active" | "past">("active");
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [isKbOpen, setIsKbOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatTicket, setChatTicket] = useState<{ id: string; subject: string; assignedStaff: Ticket["assignedStaff"] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";

    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "light" || savedTheme === "dark") return savedTheme;

    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  const { user, loading, signingOut } = useAuth();

  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.classList.toggle("dark", theme === "dark");
      localStorage.setItem("theme", theme);
    }
  }, [theme]);

  useEffect(() => {
    if (!user?.email) return;
    let active = true;

    const cachedTickets = getCachedData<Ticket[]>("dashboard_tickets");
    const cachedStaff = getCachedData<SupportStaff[]>("dashboard_staff");
    if (cachedTickets?.data) {
      const staffMap = new Map<string, SupportStaff>(
        (cachedStaff?.data ?? []).map((s) => [String(s.id), s])
      );
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTickets(
        cachedTickets.data.map((t) => {
          const staff = t.assignedTo ? staffMap.get(t.assignedTo) : undefined;
          return staff ? { ...t, assignedStaff: staff } : t;
        })
      );
    }

    (async () => {
      const [{ data: ticketsData, error: ticketsError }, { data: staffData, error: staffError }] = await Promise.all([
        supabase
          .from("tickets")
          .select("*")
          .eq("submitted_by", user.email)
          .order("created_at", { ascending: false }),
        supabase.from("support_staff").select("*"),
      ]);
      if (active) {
        if (ticketsError || staffError) {
          console.error("Failed to load dashboard data:", ticketsError ?? staffError);
          setError(ticketsError?.message ?? staffError?.message ?? "We couldn't load your dashboard data. Please check your connection and try again.");
          return;
        }
        const staffMap = new Map<string, SupportStaff>();
        if (staffData) {
          for (const s of staffData) {
            staffMap.set(String(s.id), {
              id: String(s.id),
              name: String(s.name ?? ""),
              email: String(s.email ?? ""),
              role: String(s.role ?? ""),
              avatar: String(s.avatar ?? "?"),
              active: Boolean(s.active),
            });
          }
        }
        if (ticketsData) {
          const mapped = ticketsData.map((r) => {
            const ticket = toTicket(r);
            if (ticket.assignedTo && staffMap.has(ticket.assignedTo)) {
              const staff = staffMap.get(ticket.assignedTo)!;
              ticket.assignedStaff = {
                id: staff.id,
                name: staff.name,
                email: staff.email,
                role: staff.role,
                avatar: staff.avatar,
              };
            }
            return ticket;
          });
          setTickets(mapped);
          setCachedData("dashboard_tickets", mapped, 30_000);
        }
        if (staffData) {
          const staffList = Array.from(staffMap.values());
          setCachedData("dashboard_staff", staffList, 60_000);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.email]);

  useEffect(() => {
    if (!user?.email) return;
    let mounted = true;

    const refresh = async () => {
      const [{ data: ticketsData, error: ticketsError }, { data: staffData, error: staffError }] = await Promise.all([
        supabase
          .from("tickets")
          .select("*")
          .eq("submitted_by", user.email)
          .order("created_at", { ascending: false }),
        supabase.from("support_staff").select("*"),
      ]);
      if (!mounted) return;
if (ticketsError || staffError) {
          console.error("Failed to load dashboard data:", ticketsError ?? staffError);
          setError(ticketsError?.message ?? staffError?.message ?? "We couldn't load your dashboard data. Please check your connection and try again.");
          return;
        }
      const staffMap = new Map<string, SupportStaff>();
      if (staffData) {
        for (const s of staffData) {
          staffMap.set(String(s.id), {
            id: String(s.id),
            name: String(s.name ?? ""),
            email: String(s.email ?? ""),
            role: String(s.role ?? ""),
            avatar: String(s.avatar ?? "?"),
            active: Boolean(s.active),
          });
        }
      }
      if (ticketsData) {
        const mapped = ticketsData.map((r) => {
          const ticket = toTicket(r);
          if (ticket.assignedTo && staffMap.has(ticket.assignedTo)) {
            const staff = staffMap.get(ticket.assignedTo)!;
            ticket.assignedStaff = {
              id: staff.id,
              name: staff.name,
              email: staff.email,
              role: staff.role,
              avatar: staff.avatar,
            };
          }
          return ticket;
        });
        setTickets(mapped);
      }
    };

    refresh();

    const channels = [
      supabase.channel("realtime-user-tickets").on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets", filter: `submitted_by=eq.${user.email}` },
        () => {
          refresh();
        }
      ),
      supabase.channel("realtime-user-staff").on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_staff" },
        () => {
          refresh();
        }
      ),
    ];

    channels.forEach((channel) => channel.subscribe());

    return () => {
      mounted = false;
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  }, [user?.email]);

  const activeTickets = tickets.filter(
    (t) => t.status === "open" || t.status === "in_progress",
  );
  const pastTickets = tickets.filter(
    (t) => t.status === "resolved" || t.status === "closed",
  );

  const displayedTickets = activeTab === "active" ? activeTickets : pastTickets;

  const { paginatedItems: paginatedTickets, page: ticketsPage, totalPages: ticketsTotalPages, setPage: setTicketsPage } = usePagination(displayedTickets);

  const stats = {
    open: tickets.filter((t) => t.status === "open").length,
    inProgress: tickets.filter((t) => t.status === "in_progress").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
    total: tickets.length,
  };

  const handleNewTicket = async (form: {
    fullname: string;
    department: string;
    subject: string;
    category: string;
    priority: TicketPriority;
    description: string;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!user?.email) return { success: false, error: "Not authenticated" };
    const description = [
      form.fullname ? `Name: ${form.fullname}` : "",
      form.department ? `Dept: ${form.department}` : "",
      form.description,
    ]
      .filter(Boolean)
      .join("\n");

    const now = new Date().toISOString();
    const ticketId = `TK-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const { data, error } = await supabase
      .from("tickets")
      .insert({
        id: ticketId,
        subject: form.subject,
        category: form.category,
        priority: form.priority,
        status: "open",
        description,
        submitted_by: user.email,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message ?? "We couldn't create your ticket. Please try again in a moment." };
    }

    setTickets((prev) => [toTicket(data), ...prev]);
    logActivity({
      action: "ticket_created",
      target_type: "ticket",
      target_id: data.id,
      details: `Created ticket: ${form.subject}`,
    }).catch(() => {});
    return { success: true };
  };

  const toggleTheme = () => {
    setTheme((prev) => {
      const nextTheme = prev === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", nextTheme === "dark");
      localStorage.setItem("theme", nextTheme);
      return nextTheme;
    });
  };

  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== "user") {
      // Log unauthorized access attempt
      fetch("/api/unauthorized-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "/dashboard",
          reason: user ? `Insufficient role: ${user.role}` : "Not authenticated",
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        }),
      }).catch(() => {});
    }
  }, [user, loading]);

  if (loading) return <DashboardSkeleton />;
  if (!user || user.role !== "user") {
    if (signingOut) return null;
    return (
      <>
        <DashboardSkeleton />
        <ForbiddenAccessModal
          isOpen
          onClose={() => {}}
          attemptedPath="/dashboard"
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-2 py-2">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background">
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
                    d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v8.25A2.25 2.25 0 006 16.5h.75m3 3h.75m-3 3v.75m0 0h.75m-3 0h.75"
                  />
                </svg>
              </div>
              <h1 className="text-lg font-semibold text-foreground">
                HelpDeskIT
              </h1>
            </div>
            <div className="flex items-center gap-4">
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
                {user?.email ?? "user@company.com"}
              </span>
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
            {error}
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="Dismiss error message"
              className="ml-2 text-red-500 hover:text-red-700 dark:hover:text-red-300"
            >
              ✕
            </button>
          </div>
        )}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">
              Ticket Dashboard
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Manage and track all your IT support requests in one place.
            </p>
          </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsKbOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
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
                    d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A9 9 0 006 18c1.052 0 2.062-.18 3-.512m0-13.042A8.967 8.967 0 0118 3.75c1.052 0 2.062.18 3 .512v14.25A9 9 0 0118 18c-1.052 0-2.062-.18-3-.512"
                  />
                </svg>
                Browse Knowledge Base
              </button>
              <button
                onClick={() => setIsNewTicketOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-sm transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2"
              >
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
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
                Submit New Ticket
              </button>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
              Total
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {stats.total}
            </p>
          </div>
        </div>

        <div className="mt-8">
          <div className="border-b border-zinc-200 dark:border-zinc-800">
            <nav className="-mb-px flex gap-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab("active")}
                className={`whitespace-nowrap border-b-2 py-3 text-sm font-medium transition-colors ${
                  activeTab === "active"
                    ? "border-foreground text-foreground"
                    : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                }`}
              >
                Active Tickets
                {activeTickets.length > 0 && (
                  <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-xs dark:bg-zinc-800">
                    {activeTickets.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("past")}
                className={`whitespace-nowrap border-b-2 py-3 text-sm font-medium transition-colors ${
                  activeTab === "past"
                    ? "border-foreground text-foreground"
                    : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                }`}
              >
                Past Tickets
                {pastTickets.length > 0 && (
                  <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-xs dark:bg-zinc-800">
                    {pastTickets.length}
                  </span>
                )}
              </button>
            </nav>
          </div>

          <div className="mt-6">
            {displayedTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 py-16 dark:border-zinc-700">
                <svg
                  className="h-10 w-10 text-zinc-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v8.25A2.25 2.25 0 006 16.5h.75m3 3h.75m-3 3v.75m0 0h.75m-3 0h.75"
                  />
                </svg>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  You don&apos;t have any tickets yet. Submit a new ticket to get started!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
{paginatedTickets.map((ticket) => (
          <div
            key={ticket.id}
            onClick={() => {
              setSelectedTicket(ticket);
              setIsDetailOpen(true);
            }}
            className="cursor-pointer rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
          >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                            {ticket.id}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ticketStatusStyles[ticket.status]}`}
                          >
                            {ticket.status.replace("_", " ")}
                          </span>
                          <span
                            className={`text-xs font-medium ${priorityStyles[ticket.priority]}`}
                          >
                            {priorityLabels[ticket.priority]}
                          </span>
                        </div>
                        <h3 className="mt-2 text-sm font-semibold text-foreground">
                          {ticket.subject}
                        </h3>
                        <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-zinc-500 dark:text-zinc-400">
                          {typeof ticket.description === 'string' ? ticket.description.replace(/\s*\|\s*/g, '\n') : ticket.description}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
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
                          <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                            {ticket.category}
                          </span>
                          {ticket.assignedStaff ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 dark:bg-blue-900/20">
                              <svg className="h-3.5 w-3.5 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.25h15a1.5 1.5 0 001.5-1.5V19a5.25 5.25 0 00-10.5 0v.75a1.5 1.5 0 01-1.5 1.5H4.5z" />
                              </svg>
                              {ticket.assignedStaff.name}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                               Awaiting Assignment
                            </span>
                          )}
                        </div>
                      </div>
                      {(ticket.status === "open" || ticket.status === "in_progress") && ticket.assignedStaff && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setChatTicket({
                              id: ticket.id,
                              subject: ticket.subject,
                              assignedStaff: ticket.assignedStaff,
                            });
                            setIsChatOpen(true);
                          }}
                          className="shrink-0 inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
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
                              d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 013 21V12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                            />
                          </svg>
                          Send Message
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <Pagination page={ticketsPage} totalPages={ticketsTotalPages} onPageChange={setTicketsPage} />
              </div>
            )}
          </div>
        </div>
      </main>

      <NewTicketModal
        isOpen={isNewTicketOpen}
        onClose={() => setIsNewTicketOpen(false)}
        onSubmit={handleNewTicket}
      />
      <KnowledgeBase
        isOpen={isKbOpen}
        onClose={() => setIsKbOpen(false)}
      />
      <TicketDetailModal
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedTicket(null);
        }}
        ticket={selectedTicket}
      />
      {isChatOpen && chatTicket && chatTicket.assignedStaff && (
        <SupportChatModal
          isOpen={isChatOpen}
          onClose={() => {
            setIsChatOpen(false);
            setChatTicket(null);
          }}
          ticketId={chatTicket.id}
          ticketSubject={chatTicket.subject}
          currentUser={{
            id: user?.id || "",
            name: user?.name || "",
            email: user?.email || "",
            role: user?.role || "user",
          }}
          assignedStaff={{
            id: chatTicket.assignedStaff.id,
            name: chatTicket.assignedStaff.name,
            email: chatTicket.assignedStaff.email || "",
            role: chatTicket.assignedStaff.role,
          }}
        />
      )}
    </div>
  );
}
