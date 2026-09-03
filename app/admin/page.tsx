"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import StaffModal from "./components/StaffModal";
import { useNotifications } from "@/app/hooks/useNotifications";
import { useAuth } from "@/context/AuthContext";
import SignOutButton from "@/components/SignOutButton";
import AccountSwitcher from "@/components/AccountSwitcher";
import { AdminSkeleton } from "@/components/skeleton";
import ForbiddenAccessModal from "@/components/ForbiddenAccessModal";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity";
import { getCachedData, setCachedData } from "@/lib/cache";
import { usePagination, Pagination } from "@/components/Pagination";
import { ticketStatusStyles, priorityStyles } from "@/lib/styles";
import { formatDate, getAvatarColor, priorityLabels } from "@/lib/utils";
import ChatPanel from "../chat/components/ChatPanel";
import WeeklyReportButton from "@/components/WeeklyReportButton";
import type { Ticket, SupportStaff, TicketStatus } from "../types/ticket";
import { toAdminTicket, toStaff } from "../types/mappers";
import DeleteStaffConfirmModal from "@/components/DeleteStaffConfirmModal";
import StaffSaveFeedbackModal from "@/components/StaffSaveFeedbackModal";

const supabase = createClient();

export default function AdminDashboard({ embedded = false }: { embedded?: boolean }) {
  const VALID_STAFF_ROLES = [
    "IT Support Specialist",
    "Senior IT Support",
    "Network Administrator",
    "Hardware Support",
    "Software Support",
    "System Administrator",
    "Help Desk Technician",
    "Field Technician",
  ];

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [staffList, setStaffList] = useState<SupportStaff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
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
    customRole: "",
    password: "",
  });
  const [staffFormError, setStaffFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { unreadMessages } = useNotifications();
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });
  const [deleteStaffModalOpen, setDeleteStaffModalOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isSavingStaff, setIsSavingStaff] = useState(false);
  const [staffSaveResult, setStaffSaveResult] = useState<{ success: boolean; message: string; staffName?: string } | null>(null);
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
        setStaffForm({ name: "", email: "", role: "", customRole: "", password: "" });
        setShowPassword(false);
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

  const { user, loading, signingOut } = useAuth();

  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.classList.toggle("dark", theme === "dark");
      localStorage.setItem("theme", theme);
    }
  }, [theme]);

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      try {
        const [ticketsRes, staffRes, accountsRes] = await Promise.all([
          supabase.from("tickets").select("*").order("created_at", { ascending: false }),
          supabase.from("support_staff").select("*").order("name"),
          supabase
            .from("accounts")
            .select("id, name, email, role, avatar, status")
            .eq("role", "support"),
        ]);

        if (!mounted) return;

        // Handle errors for each request individually
        const ticketError = ticketsRes.error;
        const staffError = staffRes.error;
        const accountError = accountsRes.error;

        // Set page error if either request failed
        if (ticketError || staffError || accountError) {
          const message = ticketError?.message || staffError?.message || accountError?.message || "Unable to load dashboard data. Please check your connection and try again.";
          console.error("Admin data load error:", ticketError || staffError || accountError);
          setPageError(message);
          // Don't return early - still try to process successful data
        } else {
          setPageError(null);
        }

        // Process tickets data if available
        if (ticketsRes.data) {
          const tickets = ticketsRes.data.map((r) => toAdminTicket(r));
          setTickets(tickets);
          setCachedData("admin_tickets", tickets, 30_000);
        }

        // Process staff data if available
        if (staffRes.data) {
          const staff = staffRes.data.map((r) => toStaff(r));
          const staffEmails = new Set(staff.map((member) => member.email.toLowerCase()));
          const missingSupportStaff = (accountsRes.data ?? [])
            .filter(
              (account) =>
                account.status !== "suspended" &&
                !staffEmails.has(String(account.email).toLowerCase()),
            )
            .map((account) => ({
              id: `staff-${account.id}`,
              name: String(account.name ?? ""),
              email: String(account.email ?? ""),
              role: "Support",
              avatar: String(account.avatar ?? ""),
              active: true,
            }));

          if (missingSupportStaff.length) {
            const { error: syncError } = await supabase
              .from("support_staff")
              .upsert(missingSupportStaff, { onConflict: "email" });
            if (syncError) {
              console.error("Failed to sync support accounts:", syncError);
            }
          }

          const allStaff = [...staff, ...missingSupportStaff];
          setStaffList(allStaff);
          setCachedData("admin_staff", allStaff, 60_000);
        }

        // Set loading to false after fetch completes (success or failure)
        if (mounted) {
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Admin data load rejected:", err);
        if (mounted) {
          setPageError(err instanceof Error ? err.message : "Unable to load dashboard data. Please check your connection and try again.");
          setIsLoading(false);
        }
      }
    };

    const cachedTickets = getCachedData<Ticket[]>("admin_tickets");
    const cachedStaff = getCachedData<SupportStaff[]>("admin_staff");
    if (cachedTickets?.data) {
      setTickets(cachedTickets.data);
    }
    if (cachedStaff?.data) {
      setStaffList(cachedStaff.data);
    }
    // Only set loading to false if we have cached data for both
    // Otherwise, let the refresh() call handle the loading state
    if (cachedTickets?.data && cachedStaff?.data) {
      setIsLoading(false);
    }
    refresh();

    const channels = [
      supabase.channel("realtime-admin-tickets").on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        () => {
          refresh();
        }
      ),
      supabase.channel("realtime-admin-staff").on(
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

  const { paginatedItems: paginatedTickets, page: ticketsPage, totalPages: ticketsTotalPages, setPage: setTicketsPage } = usePagination(filteredTickets);

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
    const staff = staffList.find((s) => s.id === staffId);
    await logActivity({
      action: "ticket_assigned",
      target_type: "ticket",
      target_id: ticketId,
      details: staff
        ? `Assigned to ${staff.name}`
        : "Unassigned from staff",
    });
  };

  const openAddStaff = () => {
    setEditingStaff(null);
    setStaffForm({ name: "", email: "", role: "", customRole: "", password: "" });
    setShowPassword(false);
    setIsStaffFormOpen(true);
    setIsStaffModalOpen(false);
  };

  const openEditStaff = (staff: SupportStaff) => {
    setEditingStaff(staff);
    const isCustomRole = !VALID_STAFF_ROLES.includes(staff.role);
    setStaffForm({
      name: staff.name,
      email: staff.email,
      role: isCustomRole ? "__other__" : staff.role,
      customRole: isCustomRole ? staff.role : "",
      password: "",
    });
    setShowPassword(false);
    setIsStaffFormOpen(true);
    setIsStaffModalOpen(false);
  };

    const handleSaveStaff = async () => {
    setStaffFormError(null);
    const isOtherRole = staffForm.role === "__other__";
    const isEditing = !!editingStaff;

    if (
      !staffForm.name.trim() ||
      !staffForm.email.trim() ||
      (!isOtherRole && !staffForm.role.trim()) ||
      (isOtherRole && !staffForm.customRole.trim())
    ) {
      setStaffFormError("Please fill in the name, email, and role fields.");
      return;
    }

    // Server enforces password requirements; generatePassword flag controls the behavior.
    const name = staffForm.name.trim();
    const email = staffForm.email.trim();
    const roleTitle = isOtherRole
      ? staffForm.customRole.trim()
      : staffForm.role.trim();

    setIsSavingStaff(true);

    try {
      if (isEditing) {
        const res = await fetch(`/api/staff/${editingStaff.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            role: roleTitle,
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          setStaffFormError(data.error || "We couldn't update this staff member. Please try again.");
          return;
        }

        setStaffList((prev) =>
          prev.map((s) => (s.id === editingStaff.id ? { ...s, ...data.staff } : s)),
        );
        await logActivity({
          action: "staff_updated",
          target_type: "staff",
          target_id: editingStaff.id,
          details: `Updated staff: ${name} (${email})`,
        });

        setStaffSaveResult({ success: true, message: "Staff member updated successfully!", staffName: name });
      } else {
        const res = await fetch("/api/staff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            password: staffForm.password,
            generatePassword: !staffForm.password.trim(),
            role: roleTitle,
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          setStaffFormError(data.error || "We couldn't create this staff member. Please try again.");
          return;
        }

        setStaffList((prev) => [...prev, data.staff]);
        await logActivity({
          action: "staff_created",
          target_type: "staff",
          target_id: data.staff.id,
          details: `Created staff: ${name} (${email})`,
        });

        setStaffSaveResult({ success: true, message: "Staff member added successfully!", staffName: name });
      }
    } catch {
      setStaffFormError("Something went wrong. Please try again.");
      return;
    } finally {
      setIsSavingStaff(false);
    }

    setIsStaffFormOpen(false);
    setStaffForm({ name: "", email: "", role: "", customRole: "", password: "" });
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
    await logActivity({
      action: "staff_status_changed",
      target_type: "staff",
      target_id: staffId,
      details: `Set ${target.name} to ${next ? "active" : "inactive"}`,
    });
  };

  const deleteStaff = async (staffId: string) => {
    const target = staffList.find((s) => s.id === staffId);
    const { error } = await supabase.rpc("delete_staff", {
      staff_id: staffId,
    });
    if (error) {
      console.error("Failed to delete staff", error);
      return;
    }
    if (target?.email) {
      const { error: accountError } = await supabase
        .from("accounts")
        .update({ status: "suspended" })
        .eq("email", target.email)
        .eq("role", "support");
      if (accountError) {
        console.error("Failed to suspend removed staff account", accountError);
      }
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
    if (target) {
      await logActivity({
        action: "staff_deleted",
        target_type: "staff",
        target_id: staffId,
        details: `Deleted staff: ${target.name} (${target.email})`,
      });
    }
  };

  const handleRequestDeleteStaff = (staff: SupportStaff) => {
    setStaffToDelete({ id: staff.id, name: staff.name });
    setDeleteStaffModalOpen(true);
  };

  const handleConfirmDeleteStaff = async () => {
    if (!staffToDelete) return;
    await deleteStaff(staffToDelete.id);
    setDeleteStaffModalOpen(false);
    setStaffToDelete(null);
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
    if (!embedded && (!user || user.role !== "admin")) {
      fetch("/api/unauthorized-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "/admin",
          reason: user ? `Insufficient role: ${user.role}` : "Not authenticated",
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        }),
      }).catch(() => {});
    }
  }, [user, loading, embedded]);

  if (loading || signingOut) return <AdminSkeleton />;
  if (!embedded && (!user || user.role !== "admin")) {
    return (
      <>
        <AdminSkeleton />
        <ForbiddenAccessModal
          isOpen
          onClose={() => {}}
          attemptedPath="/admin"
        />
      </>
    );
  }

  if (isLoading) return <AdminSkeleton />;

  return (
    <div className="dashboard-shell">
      {!embedded && (
        <header className="dashboard-header">
          <div className="dashboard-header-inner">
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-2 py-2">
            <div className="dashboard-brand">
              <div className="dashboard-brand-mark bg-red-600">
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
              <div className="dashboard-brand-copy">
                <h1>HelpDeskIT Admin</h1>
                <p>Support Team Management</p>
              </div>
            </div>
            <div className="dashboard-actions">
              <div className="hidden items-center gap-2 sm:flex">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                  {(user?.name || "A").charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col leading-tight text-left">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-200">
                    {user?.name || "Admin"}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {user?.email ?? "admin@company.com"}
                  </span>
                </div>
              </div>
              <button
                onClick={openAddStaff}
                className="dashboard-action-button"
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
                onClick={() => setIsChatOpen(true)}
                aria-label={
                  unreadMessages > 0
                    ? `Chat, ${unreadMessages} unread messages`
                    : "Chat"
                }
                className="dashboard-action-button relative"
              >
                {unreadMessages > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white"
                  >
                    {unreadMessages > 9 ? "9+" : unreadMessages}
                  </span>
                )}
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
                    d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 013 21V12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                  />
                </svg>
                <span className="hidden sm:inline">Chat</span>
              </button>
              <button
                onClick={toggleTheme}
                className="dashboard-action-button"
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
              <AccountSwitcher />
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>
      )}
 
      <main className="dashboard-body">
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
            <WeeklyReportButton tickets={tickets} userRole="admin" />
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
                Back to All Tickets
              </button>
            )}
          </div>
        </div>

        {pageError && (
          <div role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
            {pageError}
          </div>
        )}

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
              No support staff members found yet
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Add support staff to begin assigning and managing tickets
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
                  placeholder="Search tickets by ID, subject, or description..."
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
                       No tickets match your current filters. Try adjusting your search or status filter.
                    </td>
                  </tr>
                ) : (
                  paginatedTickets.map((ticket) => {
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
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${ticketStatusStyles[ticket.status]}`}
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
                               Awaiting Assignment
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
                             View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            <Pagination page={ticketsPage} totalPages={ticketsTotalPages} onPageChange={setTicketsPage} />
          </div>
        </div>
      </main>

      {selectedTicket && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4 safe-top safe-bottom sm:items-center"
        >
          <div
            ref={ticketDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="adminTicketDetailTitle"
            tabIndex={-1}
            className="my-4 w-full max-w-2xl rounded-2xl bg-white shadow-xl dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <h3 id="adminTicketDetailTitle" className="text-lg font-semibold text-foreground">
                Ticket {selectedTicket.id}
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
                <p className="mt-2 whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-400">
                  {typeof selectedTicket.description === 'string' ? selectedTicket.description.replace(/\s*\|\s*/g, '\n') : selectedTicket.description}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                    className={`mt-1 inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium ${ticketStatusStyles[selectedTicket.status]}`}
                  >
                    {selectedTicket.status.replace("_", " ")}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Assigned To
                  </p>
                  <select
                    value={selectedTicket.assignedTo || ""}
                    onChange={(e) =>
                      assignTicket(selectedTicket.id, e.target.value)
                    }
                    className="mt-1 block w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm text-foreground outline-none focus:border-foreground focus:ring-1 focus:ring-foreground dark:border-zinc-700 dark:bg-zinc-800"
                  >
                     <option value="">Awaiting Assignment</option>
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
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4 safe-top safe-bottom sm:items-center"
        >
          <div
            ref={staffDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="adminStaffFormTitle"
            tabIndex={-1}
            className="my-4 w-full max-w-md rounded-2xl bg-white shadow-xl dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <h3 id="adminStaffFormTitle" className="text-lg font-semibold text-foreground">
                {editingStaff ? "Edit Support Staff Member" : "Add Support Staff Member"}
              </h3>
              <button
                onClick={() => {
                  setIsStaffFormOpen(false);
                  setEditingStaff(null);
                  setStaffForm({ name: "", email: "", role: "", customRole: "", password: "" });
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
                   placeholder="Enter the staff member's full name"
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
                   placeholder="Enter the staff member's work email"
                />
              </div>
               <div>
                  <label
                    htmlFor="staffRole"
                    className="block text-sm font-medium text-foreground"
                  >
                    Role / Job Title
                  </label>
                <select
                  id="staffRole"
                  value={staffForm.role}
                  onChange={(e) =>
                    setStaffForm({ ...staffForm, role: e.target.value, customRole: "" })
                  }
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="">Select a role from the list</option>
                  {VALID_STAFF_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                  <option value="__other__">Other</option>
                </select>
                {staffForm.role === "__other__" && (
                  <input
                    id="staffCustomRole"
                    type="text"
                    value={staffForm.customRole}
                    onChange={(e) =>
                      setStaffForm({ ...staffForm, customRole: e.target.value })
                    }
                    className="mt-2 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground dark:border-zinc-700 dark:bg-zinc-900"
                     placeholder="Enter a custom role title"
                  />
                )}
               </div>
                {!editingStaff && (
                  <div>
                   <label
                     htmlFor="staffPassword"
                     className="block text-sm font-medium text-foreground"
                   >
                     Initial Password
                   </label>
                   <div className="relative mt-1">
                     <input
                       id="staffPassword"
                       type={showPassword ? "text" : "password"}
                       required
                       value={staffForm.password}
                       onChange={(e) =>
                         setStaffForm({ ...staffForm, password: e.target.value })
                       }
                       className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 pr-10 text-sm text-foreground shadow-sm transition-colors focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground dark:border-zinc-700 dark:bg-zinc-900"
                       placeholder="Set the staff member's initial password"
                     />
                     <button
                       type="button"
                       aria-label={showPassword ? "Hide password" : "Show password"}
                       onClick={() => setShowPassword((v) => !v)}
                       className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-zinc-500 hover:text-foreground dark:text-zinc-400 dark:hover:text-zinc-200 focus:outline-none"
                     >
                       {showPassword ? (
                         <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7z" />
                           <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                         </svg>
                       ) : (
                         <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7z" />
                           <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                           <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                         </svg>
                       )}
                     </button>
                   </div>
                  </div>
                )}
               {staffFormError && (
                 <p role="alert" className="text-sm text-red-600 dark:text-red-400">{staffFormError}</p>
               )}
               <div className="flex justify-end gap-3 pt-2">
                 <button
                   type="button"
                   onClick={() => {
                     setIsStaffFormOpen(false);
                     setEditingStaff(null);
                     setStaffForm({ name: "", email: "", role: "", customRole: "", password: "" });
                   }}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveStaff}
                  disabled={isSavingStaff}
                  className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-sm transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2 disabled:opacity-50"
                >
                  {isSavingStaff && (
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  )}
                  {isSavingStaff ? "Saving..." : editingStaff ? "Save Changes" : "Add Staff Member"}
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
          onRequestDeleteStaff={handleRequestDeleteStaff}
          getStaffWorkload={getStaffWorkload}
          getAvatarColor={getAvatarColor}
        />
      )}
      {deleteStaffModalOpen && staffToDelete && (
        <DeleteStaffConfirmModal
          isOpen={deleteStaffModalOpen}
          onClose={() => {
            setDeleteStaffModalOpen(false);
            setStaffToDelete(null);
          }}
          onConfirm={handleConfirmDeleteStaff}
          staffName={staffToDelete.name}
        />
      )}
      {staffSaveResult && (
        <StaffSaveFeedbackModal
          isOpen={!!staffSaveResult}
          onClose={() => setStaffSaveResult(null)}
          success={staffSaveResult.success}
          message={staffSaveResult.message}
          staffName={staffSaveResult.staffName}
        />
      )}
      {isChatOpen && (
        <ChatPanel
          currentUser={{
            id: user?.id || "",
            name: user?.name || "",
            email: user?.email || "",
            role: user?.role || "admin",
          }}
          getRecipients={async () => {
            const { data: superadmin } = await supabase
              .from("accounts")
              .select("id, name, email, role")
              .eq("role", "superadmin");
            const { data: staff } = await supabase
              .from("support_staff")
              .select("id, name, email, role")
              .eq("active", true);
            const emails = (staff || []).map((s) => s.email);
            const { data: staffAccounts } = emails.length
              ? await supabase
                  .from("accounts")
                  .select("id, email")
                  .in("email", emails)
              : { data: [] as Array<{ id: string; email: string }> };
            const staffAccountMap = new Map((staffAccounts || []).map((a) => [a.email, a.id]));
            const mappedStaff = (staff || []).map((s) => ({
              id: staffAccountMap.get(s.email) || s.id,
              name: s.name,
              email: s.email,
              role: s.role,
            }));
            return [
              ...(superadmin || []),
              ...mappedStaff,
            ];
          }}
          title="Messages"
          onClose={() => setIsChatOpen(false)}
        />
      )}
    </div>
  );
}
