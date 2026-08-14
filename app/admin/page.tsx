"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import StaffModal from "./components/StaffModal";
import { useAuth } from "@/context/AuthContext";
import { FORBIDDEN_ROUTE } from "@/context/authTypes";
import SignOutButton from "@/components/SignOutButton";
import Loading from "@/components/Loading";
import { createClient } from "@/lib/supabase/client";
import type { Ticket, SupportStaff, TicketStatus, TicketPriority } from "../types/ticket";
import { toAdminTicket, toStaff } from "../types/mappers";

const supabase = createClient();

const statusStyles: Record<TicketStatus, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  in_progress:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  resolved:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  closed: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const priorityStyles: Record<TicketPriority, string> = {
  low: "text-zinc-500",
  medium: "text-amber-600",
  high: "text-orange-600",
  critical: "text-red-600",
};

const priorityLabels: Record<TicketPriority, string> = {
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

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export default function AdminDashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [staffList, setStaffList] = useState<SupportStaff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<SupportStaff | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isStaffFormOpen, setIsStaffFormOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<SupportStaff | null>(null);
  const [staffForm, setStaffForm] = useState({
    name: "",
    email: "",
    role: "",
  });
  const [staffFormError, setStaffFormError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });
  const ticketDialogRef = useRef<HTMLDivElement>(null);
  const staffDialogRef = useRef<HTMLDivElement>(null);

  const getFocusableElements = useCallback((root: HTMLElement | null) => {
    if (!root) return [];
    return Array.from(
      root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute("disabled"));
  }, []);

  useEffect(() => {
    if (!selectedTicket || !ticketDialogRef.current) return;

    const previousFocus = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedTicket(null);
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = getFocusableElements(ticketDialogRef.current);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || !ticketDialogRef.current?.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !ticketDialogRef.current?.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    ticketDialogRef.current.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus.focus();
    };
  }, [selectedTicket, getFocusableElements]);

  useEffect(() => {
    if (!isStaffFormOpen || !staffDialogRef.current) return;

    const previousFocus = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsStaffFormOpen(false);
        setEditingStaff(null);
        setStaffForm({ name: "", email: "", role: "" });
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = getFocusableElements(staffDialogRef.current);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || !staffDialogRef.current?.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !staffDialogRef.current?.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    staffDialogRef.current.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus.focus();
    };
  }, [isStaffFormOpen, getFocusableElements]);

  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.classList.toggle("dark", theme === "dark");
      localStorage.setItem("theme", theme);
    }
  }, [theme]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [{ data: ticketsData }, { data: staffData }] = await Promise.all([
          supabase.from("tickets").select("*").order("created_at", { ascending: false }),
          supabase.from("support_staff").select("*").order("name"),
        ]);
        if (active) {
          if (ticketsData) setTickets(ticketsData.map((r) => toAdminTicket(r)));
          if (staffData) setStaffList(staffData.map((r) => toStaff(r)));
        }
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const filteredTickets = useMemo(() => {
    const query = search.toLowerCase().trim();
    const base = selectedStaff
      ? tickets.filter((t) => t.assignedTo === selectedStaff.id)
      : tickets;

    return base.filter((ticket) => {
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
  }, [tickets, search, statusFilter, selectedStaff]);

  const stats = useMemo(() => {
    const base = selectedStaff
      ? tickets.filter((t) => t.assignedTo === selectedStaff.id)
      : tickets;
    const open = base.filter((t) => t.status === "open").length;
    const inProgress = base.filter((t) => t.status === "in_progress").length;
    const resolved = base.filter((t) => t.status === "resolved").length;
    const closed = base.filter((t) => t.status === "closed").length;
    const critical = base.filter(
      (t) =>
        t.priority === "critical" &&
        t.status !== "closed" &&
        t.status !== "resolved",
    ).length;
    return { open, inProgress, resolved, closed, total: base.length, critical };
  }, [tickets, selectedStaff]);

  const assignTicket = async (ticketId: string, staffId: string) => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("tickets")
      .update({ assigned_to: staffId || null, updated_at: now })
      .eq("id", ticketId);
    if (error) {
      console.error("Failed to assign ticket", error);
      return;
    }
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? { ...t, assignedTo: staffId || undefined, updatedAt: now }
          : t,
      ),
    );
    setSelectedTicket((prev) =>
      prev && prev.id === ticketId
        ? { ...prev, assignedTo: staffId || undefined, updatedAt: now }
        : prev,
    );
  };

  const openAddStaff = () => {
    setEditingStaff(null);
    setStaffForm({ name: "", email: "", role: "" });
    setIsStaffFormOpen(true);
    setIsStaffModalOpen(false);
  };

  const openEditStaff = (staff: SupportStaff) => {
    setEditingStaff(staff);
    setStaffForm({ name: staff.name, email: staff.email, role: staff.role });
    setIsStaffFormOpen(true);
    setIsStaffModalOpen(false);
  };

  const handleSaveStaff = async () => {
    setStaffFormError(null);
    if (
      !staffForm.name.trim() ||
      !staffForm.email.trim() ||
      !staffForm.role.trim()
    )
      return;

    if (editingStaff) {
      const payload = {
        name: staffForm.name.trim(),
        email: staffForm.email.trim(),
        role: staffForm.role.trim(),
      };
      const { error } = await supabase
        .from("support_staff")
        .update(payload)
        .eq("id", editingStaff.id);
      if (error) {
        setStaffFormError(error.message);
        return;
      }
      setStaffList((prev) =>
        prev.map((s) => (s.id === editingStaff.id ? { ...s, ...payload } : s)),
      );
    } else {
      const id = `staff-${Date.now()}`;
      const newStaff: SupportStaff = {
        id,
        name: staffForm.name.trim(),
        email: staffForm.email.trim(),
        role: staffForm.role.trim(),
        avatar: getInitials(staffForm.name.trim()),
        active: true,
      };
      const { error } = await supabase.from("support_staff").insert({
        id,
        name: newStaff.name,
        email: newStaff.email,
        role: newStaff.role,
        avatar: newStaff.avatar,
        active: true,
      });
      if (error) {
        setStaffFormError(error.message);
        return;
      }
      setStaffList((prev) => [...prev, newStaff]);
    }

    setIsStaffFormOpen(false);
    setStaffForm({ name: "", email: "", role: "" });
    setEditingStaff(null);
  };

  const toggleStaffStatus = async (staffId: string) => {
    const target = staffList.find((s) => s.id === staffId);
    if (!target) return;
    const next = !target.active;
    const { error } = await supabase
      .from("support_staff")
      .update({ active: next })
      .eq("id", staffId);
    if (error) {
      console.error("Failed to toggle staff status", error);
      return;
    }
    setStaffList((prev) =>
      prev.map((s) => (s.id === staffId ? { ...s, active: next } : s)),
    );
  };

  const deleteStaff = async (staffId: string) => {
    const { error } = await supabase.rpc("delete_staff", {
      staff_id: staffId,
    });
    if (error) {
      console.error("Failed to delete staff", error);
      return;
    }
    setStaffList((prev) => prev.filter((s) => s.id !== staffId));
    setTickets((prev) =>
      prev.map((t) =>
        t.assignedTo === staffId
          ? { ...t, assignedTo: undefined, updatedAt: new Date().toISOString() }
          : t,
      ),
    );
    if (selectedStaff?.id === staffId) setSelectedStaff(null);
  };

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      localStorage.setItem("theme", next);
      return next;
    });
  };

  const getStaffWorkload = (staffId: string) => {
    const staffTickets = tickets.filter(
      (t) =>
        t.assignedTo === staffId &&
        t.status !== "closed" &&
        t.status !== "resolved",
    );
    return {
      total: staffTickets.length,
      open: staffTickets.filter((t) => t.status === "open").length,
      inProgress: staffTickets.filter((t) => t.status === "in_progress").length,
      critical: staffTickets.filter((t) => t.priority === "critical").length,
    };
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/");
    } else if (user.role !== "admin") {
      router.replace(FORBIDDEN_ROUTE);
    }
  }, [user, loading, router]);

  if (loading) return <Loading />;
  if (!user || user.role !== "admin") {
    return <Loading />;
  }

  if (isLoading) return <Loading />;

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
                  HelpDeskIT Admin
                </h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Support Team Management
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={openAddStaff}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
                    d="M18 7.5v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                <span className="hidden sm:inline">Manage Staff</span>
              </button>
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
                <span className="hidden sm:inline">Theme</span>
              </button>
              <span className="hidden text-sm text-zinc-600 dark:text-zinc-400 sm:inline">
                {user?.email ?? "admin@company.com"}
              </span>
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">
              {selectedStaff
                ? `${selectedStaff.name}'s Tickets`
                : "Admin Dashboard"}
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {selectedStaff
                ? `Viewing and managing tickets assigned to ${selectedStaff.name}`
                : "Manage IT support staff and monitor ticket assignments"}
            </p>
          </div>
          <div className="flex gap-3">
            {selectedStaff && (
              <button
                onClick={() => setSelectedStaff(null)}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
                    d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
                  />
                </svg>
                Back to Overview
              </button>
            )}
          </div>
        </div>

        {!selectedStaff && (
          <div className="mb-8">
            <button
              onClick={() => setIsStaffModalOpen(true)}
              className="inline-flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
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
                  d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106c0 2.106.691 4.148 1.997 5.772M15 19.128a4.125 4.125 0 01-7.533-2.493M15 19.128c-1.113 0-2.16-.285-3.07-.786M15 19.128c-2.106 0-4.148-.691-5.772-1.997M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
                />
              </svg>
              View IT Support Staff ({staffList.length})
            </button>
          </div>
        )}

        {!selectedStaff && staffList.length === 0 && (
          <div className="mb-8 flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
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
                d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106c0 2.106.691 4.148 1.997 5.772M15 19.128a4.125 4.125 0 01-7.533-2.493M15 19.128c-1.113 0-2.16-.285-3.07-.786M15 19.128c-2.106 0-4.148-.691-5.772-1.997M9.879 7.519c1.171-1.025 3.071-1.171 1.172 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
              />
            </svg>
            <p className="mt-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">
              No support staff found
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Add staff members to start managing tickets
            </p>
          </div>
        )}

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
                    Assigned To
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
                  filteredTickets.map((ticket) => {
                    const assignee = ticket.assignedTo
                      ? staffList.find((s) => s.id === ticket.assignedTo)
                      : null;
                    return (
                      <tr
                        key={ticket.id}
                        className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      >
                        <td className="px-6 py-4 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                          {ticket.id}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => setSelectedTicket(ticket)}
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
                            {priorityLabels[ticket.priority]}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[ticket.status]}`}
                          >
                            {ticket.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {assignee ? (
                            <button
                              onClick={() => setSelectedStaff(assignee)}
                              className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2 py-1 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                            >
                              <div
                                className={`flex h-6 w-6 items-center justify-center rounded-full ${getAvatarColor(assignee.name)} text-xs font-semibold text-white`}
                              >
                                {assignee.avatar}
                              </div>
                              <span className="text-xs text-zinc-700 dark:text-zinc-300">
                                {assignee.name}
                              </span>
                            </button>
                          ) : (
                            <span className="text-xs text-zinc-400">
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">
                          {formatDate(ticket.createdAt)}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => setSelectedTicket(ticket)}
                            className="text-xs font-medium text-foreground underline hover:no-underline"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {selectedTicket && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
        >
          <div
            ref={ticketDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="adminTicketDetailTitle"
            tabIndex={-1}
            className="w-full max-w-lg rounded-2xl bg-white shadow-xl dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <h3 id="adminTicketDetailTitle" className="text-lg font-semibold text-foreground">
                {selectedTicket.id}
              </h3>
              <button
                onClick={() => setSelectedTicket(null)}
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
            <div className="space-y-4 p-6">
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  {selectedTicket.subject}
                </h4>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {selectedTicket.description}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Category
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {selectedTicket.category}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Priority
                  </p>
                  <p
                    className={`mt-1 text-sm font-medium ${priorityStyles[selectedTicket.priority]}`}
                  >
                    {priorityLabels[selectedTicket.priority]}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Status
                  </p>
                  <span
                    className={`mt-1 inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium ${statusStyles[selectedTicket.status]}`}
                  >
                    {selectedTicket.status.replace("_", " ")}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Assigned To
                  </p>
                  <select
                    value={selectedTicket.assignedTo || ""}
                    onChange={(e) =>
                      assignTicket(selectedTicket.id, e.target.value)
                    }
                    className="mt-1 rounded-lg border border-zinc-300 px-2.5 py-1 text-sm text-foreground outline-none focus:border-foreground focus:ring-1 focus:ring-foreground dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    <option value="">Unassigned</option>
                    {staffList.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name} - {staff.role}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Submitted By
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {selectedTicket.submittedBy || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Created
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {formatDate(selectedTicket.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Last Updated
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {formatDate(selectedTicket.updatedAt)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isStaffFormOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
        >
          <div
            ref={staffDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="adminStaffFormTitle"
            tabIndex={-1}
            className="w-full max-w-md rounded-2xl bg-white shadow-xl dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <h3 id="adminStaffFormTitle" className="text-lg font-semibold text-foreground">
                {editingStaff ? "Edit Support Staff" : "Add Support Staff"}
              </h3>
              <button
                onClick={() => {
                  setIsStaffFormOpen(false);
                  setEditingStaff(null);
                  setStaffForm({ name: "", email: "", role: "" });
                }}
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
            <div className="space-y-4 p-6">
              <div>
                <label
                  htmlFor="staffName"
                  className="block text-sm font-medium text-foreground"
                >
                  Full Name
                </label>
                <input
                  id="staffName"
                  type="text"
                  value={staffForm.name}
                  onChange={(e) =>
                    setStaffForm({ ...staffForm, name: e.target.value })
                  }
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground dark:border-zinc-700 dark:bg-zinc-900"
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <label
                  htmlFor="staffEmail"
                  className="block text-sm font-medium text-foreground"
                >
                  Email Address
                </label>
                <input
                  id="staffEmail"
                  type="email"
                  value={staffForm.email}
                  onChange={(e) =>
                    setStaffForm({ ...staffForm, email: e.target.value })
                  }
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground dark:border-zinc-700 dark:bg-zinc-900"
                  placeholder="Enter email address"
                />
              </div>
              <div>
                <label
                  htmlFor="staffRole"
                  className="block text-sm font-medium text-foreground"
                >
                  Role / Title
                </label>
                <input
                  id="staffRole"
                  type="text"
                  value={staffForm.role}
                  onChange={(e) =>
                    setStaffForm({ ...staffForm, role: e.target.value })
                  }
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground dark:border-zinc-700 dark:bg-zinc-900"
                  placeholder="e.g. Senior IT Support"
                />
              </div>
              {staffFormError && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">{staffFormError}</p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsStaffFormOpen(false);
                    setEditingStaff(null);
                    setStaffForm({ name: "", email: "", role: "" });
                  }}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveStaff}
                  className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-sm transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2"
                >
                  {editingStaff ? "Save Changes" : "Add Staff"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isStaffModalOpen && (
        <StaffModal
          isOpen={isStaffModalOpen}
          onClose={() => setIsStaffModalOpen(false)}
          staffList={staffList}
          selectedStaff={selectedStaff}
          onSelectStaff={setSelectedStaff}
          onAddStaff={openAddStaff}
          onEditStaff={openEditStaff}
          onToggleStaffStatus={toggleStaffStatus}
          onDeleteStaff={deleteStaff}
          getStaffWorkload={getStaffWorkload}
          getAvatarColor={getAvatarColor}
        />
      )}
    </div>
  );
}
