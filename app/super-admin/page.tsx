"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import SignOutButton from "@/components/SignOutButton";
import { SuperAdminSkeleton, Skeleton } from "@/components/skeleton";
import ForbiddenAccessModal from "@/components/ForbiddenAccessModal";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity";
import { useNotifications } from "@/app/hooks/useNotifications";
import { getCachedData, setCachedData } from "@/lib/cache";
import { usePagination, Pagination } from "@/components/Pagination";
import { statusStyles, roleStyles, ticketStatusStyles, priorityStyles, logLevelStyles } from "@/lib/styles";
import { formatDate, formatTimestamp } from "@/lib/utils";
import { toTicket, toSystemLog, toSystemHealth } from "./helpers";
import ProfileSettingsModal from "../settings/components/ProfileSettingsModal";
import ChatPanel from "../chat/components/ChatPanel";
import UserDashboard from "../dashboard/page";
import AdminDashboard from "../admin/page";
import SupportDashboard from "../support/page";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import { Pie, Bar } from "react-chartjs-2";
import type { TicketStatus, TicketPriority } from "../types/ticket";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const supabase = createClient();

// ─── Types ───────────────────────────────────────────────────────────────────

type UserRole = "user" | "support" | "admin" | "superadmin";
type UserStatus = "active" | "suspended" | "pending";
type LogLevel = "info" | "warn" | "error" | "debug";
type NavSection =
  | "overview"
  | "users"
  | "tickets"
  | "activity"
  | "sessions"
  | "system"
  | "logs"
  | "settings";

interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastLogin: string;
  ticketCount: number;
}

interface Ticket {
  id: string;
  subject: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  description: string;
  assignedTo?: string;
  assignedAgent: string;
  submittedBy?: string;
}

interface SystemLog {
  id: string;
  level: LogLevel;
  message: string;
  source: string;
  timestamp: string;
  meta?: string;
}

interface ActivityLog {
  id: string;
  actor_id: string;
  actor_name: string;
  actor_role: string;
  action: string;
  target_type?: string;
  target_id?: string;
  details?: string;
  ip_address?: string;
  created_at: string;
}

interface SystemHealth {
  cpu: number;
  memory: number;
  dbLatency: number;
  apiResponseTime: number;
  uptime: string;
  activeConnections: number;
  errorRate: number;
  queueDepth: number;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricBar({
  value,
  warning = 70,
  danger = 90,
}: {
  value: number;
  warning?: number;
  danger?: number;
}) {
  const color =
    value >= danger
      ? "bg-red-500"
      : value >= warning
        ? "bg-amber-400"
        : "bg-emerald-500";
  return (
    <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-700">
      <div
        className={`h-1.5 rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-semibold ${accent ?? "text-foreground"}`}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{sub}</p>
      )}
    </div>
  );
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function OverviewSection({
  health,
  users,
  tickets,
  activities,
}: {
  health: SystemHealth;
  users: SystemUser[];
  tickets: Ticket[];
  activities: ActivityLog[];
}) {
  const ticketsByStatus = {
    open: tickets.filter((t) => t.status === "open").length,
    in_progress: tickets.filter((t) => t.status === "in_progress").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
    closed: tickets.filter((t) => t.status === "closed").length,
  };
  const criticalTickets = tickets.filter(
    (t) => t.priority === "critical" && t.status !== "resolved"
  ).length;

  const usersByRole = {
    user: users.filter((u) => u.role === "user").length,
    support: users.filter((u) => u.role === "support").length,
    admin: users.filter((u) => u.role === "admin").length,
    superadmin: users.filter((u) => u.role === "superadmin").length,
  };

  const pieData = {
    labels: ["Open", "In Progress", "Resolved", "Closed"],
    datasets: [
      {
        data: [
          ticketsByStatus.open,
          ticketsByStatus.in_progress,
          ticketsByStatus.resolved,
          ticketsByStatus.closed,
        ],
        backgroundColor: [
          "rgba(59, 130, 246, 0.8)",
          "rgba(245, 158, 11, 0.8)",
          "rgba(16, 185, 129, 0.8)",
          "rgba(107, 114, 128, 0.8)",
        ],
        borderColor: [
          "rgba(59, 130, 246, 1)",
          "rgba(245, 158, 11, 1)",
          "rgba(16, 185, 129, 1)",
          "rgba(107, 114, 128, 1)",
        ],
        borderWidth: 1,
      },
    ],
  };

  const barData = {
    labels: ["Users", "Support", "Admins", "Superadmins"],
    datasets: [
      {
        label: "Users by Role",
        data: [usersByRole.user, usersByRole.support, usersByRole.admin, usersByRole.superadmin],
        backgroundColor: [
          "rgba(59, 130, 246, 0.8)",
          "rgba(16, 185, 129, 0.8)",
          "rgba(245, 158, 11, 0.8)",
          "rgba(139, 92, 246, 0.8)",
        ],
        borderRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          padding: 20,
          usePointStyle: true,
        },
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total Users"
          value={users.length}
          sub="across all roles"
        />
        <StatCard
          label="Open Tickets"
          value={ticketsByStatus.open + ticketsByStatus.in_progress}
          sub={`${criticalTickets} critical`}
          accent={criticalTickets > 0 ? "text-red-600" : undefined}
        />
        <StatCard
          label="System Uptime"
          value={health.uptime}
          sub="since last restart"
          accent="text-emerald-600"
        />
        <StatCard
          label="Error Rate"
          value={`${health.errorRate}%`}
          sub="last 24 hours"
          accent={health.errorRate > 2 ? "text-red-600" : "text-emerald-600"}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Ticket Status Distribution</h3>
          <div className="h-64">
            <Pie data={pieData} options={chartOptions} />
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Users by Role</h3>
          <div className="h-64">
            <Bar data={barData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* Recent Critical Activity */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-foreground">
            Recent Activity
          </h2>
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {activities.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-zinc-400">
              No activity recorded yet. Actions will appear here as users interact with the system.
            </div>
          ) : (
            activities.slice(0, 8).map((act) => (
              <div key={act.id} className="flex items-start gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{act.actor_name}</span>
                    {" "}{act.action.replace(/_/g, " ")}
                    {act.target_type && <span className="text-zinc-500"> on {act.target_type}</span>}
                  </p>
                  {act.details && (
                    <p className="truncate text-xs text-zinc-400">{act.details}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-zinc-400">
                  {new Date(act.created_at).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function UsersSection({
  users,
  onApproveUser,
  onToggleStatus,
  onEditRole,
}: {
  users: SystemUser[];
  onApproveUser: (id: string) => void;
  onToggleStatus: (id: string) => void;
  onEditRole: (id: string, role: UserRole) => void;
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<UserRole>("user");

  const filtered = users.filter((u) => {
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.role === "superadmin" && b.role !== "superadmin") return -1;
      if (b.role === "superadmin" && a.role !== "superadmin") return 1;
      return 0;
    });
  }, [filtered]);

  const { paginatedItems: paginatedUsers, page: usersPage, totalPages: usersTotalPages, setPage: setUsersPage } = usePagination(sorted);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
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
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-4 text-sm text-foreground placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div className="flex items-center gap-2">
          {(["all", "superadmin", "admin", "support", "user"] as const).map(
            (r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
                  roleFilter === r
                    ? "bg-foreground text-background"
                    : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                {r}
              </button>
            )
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50">
                {["User", "Role", "Status", "Last Login", "Tickets", "Actions"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {paginatedUsers.map((u) => (
                <tr
                  key={u.id}
                  className={`transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40 ${
                    u.role === "superadmin" ? "bg-violet-50/50 dark:bg-violet-900/10" : ""
                  }`}
                >
                  <td className="px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {u.name}
                      </p>
                      <p className="text-xs text-zinc-400">{u.email}</p>
                      <p className="font-mono text-xs text-zinc-300 dark:text-zinc-600">
                        {u.id}
                      </p>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${roleStyles[u.role]}`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusStyles[u.status]}`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                    {formatDate(u.lastLogin)}
                  </td>
                  <td className="px-5 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                    {u.ticketCount}
                  </td>
                  <td className="px-5 py-3">
                    {u.role !== "superadmin" && (
                      <div className="flex items-center gap-2">
                        {u.status === "pending" && (
                          <button
                            onClick={() => onApproveUser(u.id)}
                            className="rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300"
                          >
                            Approve
                          </button>
                        )}
                        {u.status !== "pending" && (
                          <button
                            onClick={() => onToggleStatus(u.id)}
                            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                              u.status === "active"
                                ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
                                : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300"
                            }`}
                          >
                            {u.status === "active" ? "Suspend" : "Reinstate"}
                          </button>
                        )}
                        {editingUserId === u.id ? (
                          <select
                            value={editingRole}
                            onChange={(e) => setEditingRole(e.target.value as UserRole)}
                            onBlur={() => {
                              if (editingUserId) {
                                onEditRole(editingUserId, editingRole);
                                setEditingUserId(null);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                if (editingUserId) {
                                  onEditRole(editingUserId, editingRole);
                                  setEditingUserId(null);
                                }
                              }
                              if (e.key === "Escape") {
                                setEditingUserId(null);
                              }
                            }}
                            autoFocus
                            className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-foreground outline-none focus:border-foreground focus:ring-1 focus:ring-foreground dark:border-zinc-700 dark:bg-zinc-800"
                          >
                            <option value="user">User</option>
                            <option value="support">Support</option>
                            <option value="admin">Admin</option>
                            <option value="superadmin">Superadmin</option>
                          </select>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingUserId(u.id);
                              setEditingRole(u.role);
                            }}
                            className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                          >
                            Edit Role
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={usersPage} totalPages={usersTotalPages} onPageChange={setUsersPage} />
        </div>
        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
            <p className="text-sm">No users match your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TicketsSection({ tickets, staffList, onViewTicket, onReassign }: {
  tickets: Ticket[];
  staffList: Array<{ id: string; name: string; email: string; role: string; avatar: string; active: boolean }>;
  onViewTicket: (ticket: Ticket) => void;
  onReassign: (ticketId: string, staffId: string) => void;
}) {
  const [filter, setFilter] = useState<TicketStatus | "all">("all");

  const filtered =
    filter === "all"
      ? tickets
      : tickets.filter((t) => t.status === filter);

  const { paginatedItems: paginatedTickets, page: ticketsPage, totalPages: ticketsTotalPages, setPage: setTicketsPage } = usePagination(filtered);

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
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
          )
        )}
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

function ReassignButton({ ticket, staffList, onReassign }: {
  ticket: Ticket;
  staffList: Array<{ id: string; name: string; email: string; role: string; avatar: string; active: boolean }>;
  onReassign: (ticketId: string, staffId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeStaff = staffList.filter((s) => s.active);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        Reassign
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[55]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-[60] mt-1 w-56 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            <div className="px-3 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
              Assign to
            </div>
            <div className="max-h-48 overflow-y-auto py-1">
              <button
                onClick={() => {
                  onReassign(ticket.id, "");
                  setOpen(false);
                }}
                className="flex w-full items-center px-3 py-2 text-left text-xs text-zinc-600 transition-colors hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Unassigned
              </button>
              {activeStaff.map((staff) => (
                <button
                  key={staff.id}
                  onClick={() => {
                    onReassign(ticket.id, staff.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                    ticket.assignedTo === staff.id
                      ? "text-foreground font-medium"
                      : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white ${
                      staff.avatar ? "bg-zinc-400" : "bg-zinc-500"
                    }`}
                  >
                    {staff.name.charAt(0)}
                  </span>
                  {staff.name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ActivitySection({ activities }: { activities: ActivityLog[] }) {
  const [filter, setFilter] = useState<string>("all");

  const filtered =
    filter === "all" ? activities : activities.filter((a) => a.action === filter);

  const { paginatedItems: paginatedActivities, page: activitiesPage, totalPages: activitiesTotalPages, setPage: setActivitiesPage } = usePagination(filtered);

  const ALLOWED_ACTIONS = new Set([
    "login",
    "login_failed",
    "logout",
    "user_approved",
    "user_status_changed",
    "user_role_changed",
    "user_created",
    "staff_created",
    "staff_updated",
    "staff_status_changed",
    "staff_deleted",
    "ticket_created",
    "ticket_updated",
    "ticket_assigned",
  ]);

  const uniqueActions = Array.from(
    new Set(
      activities
        .map((a) => a.action)
        .filter((action) => ALLOWED_ACTIONS.has(action))
    )
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
            filter === "all"
              ? "bg-foreground text-background"
              : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          All
        </button>
        {uniqueActions.map((action) => (
          <button
            key={action}
            onClick={() => setFilter(action)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              filter === action
                ? "bg-foreground text-background"
                : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {action.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {paginatedActivities.map((log) => (
            <div key={log.id} className="flex flex-wrap items-start gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {log.actor_name}
                  </span>
                  <span className="text-xs text-zinc-400">
                    ({log.actor_role})
                  </span>
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {log.action.replace(/_/g, " ")}
                  </span>
                  {log.target_type && (
                    <span className="inline-flex items-center rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {log.target_type}
                    </span>
                  )}
                </div>
                {log.details && (
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {log.details}
                  </p>
                )}
                <p className="mt-1 text-xs text-zinc-400">
                  {new Date(log.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
        <Pagination page={activitiesPage} totalPages={activitiesTotalPages} onPageChange={setActivitiesPage} />
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
            <p className="text-sm">No activity logs yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SessionsSection() {
  const [sessions, setSessions] = useState<
    Array<{
      id: string;
      user_id: string;
      user_email: string;
      user_name: string;
      user_role: string;
      device?: string;
      last_active: string;
      created_at: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { paginatedItems: paginatedSessions, page: sessionsPage, totalPages: sessionsTotalPages, setPage: setSessionsPage } = usePagination(sessions);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/sessions");
        const data = await res.json();
           if (!res.ok) {
          if (active) setError(data.error || "We couldn't load the active sessions. Please check your connection and try again.");
          return;
        }
        if (active && data.sessions) setSessions(data.sessions);
      } catch {
        // ignore
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const revokeSession = async (sessionId: string) => {
    setRevoking(sessionId);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to revoke session");
        setRevoking(null);
        return;
      }
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch {
      // ignore
    } finally {
      setRevoking(null);
    }
  };

  const revokeAllUserSessions = async (userId: string) => {
    setRevokingAll(userId);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to revoke sessions");
        return;
      }
      setSessions((prev) => prev.filter((s) => s.user_id !== userId));
    } catch {
      // ignore
    } finally {
      setRevokingAll(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-foreground">
            Active Sessions
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Sessions stay active until the user logs out. You can revoke any session below.
          </p>
        </div>
        {error && (
          <div role="alert" className="px-5 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {loading ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="space-y-2 px-5 py-3">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-64" />
                  <Skeleton className="h-3 w-48" />
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-zinc-400">
              No active sessions found.
            </div>
          ) : (
            paginatedSessions.map((session) => (
              <div
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {session.user_name}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {session.user_email} · {session.user_role}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {session.device || "Unknown device"} · Last active{" "}
                    {new Date(session.last_active).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => revokeSession(session.id)}
                    disabled={revoking === session.id}
                    className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20 disabled:opacity-50"
                  >
                    {revoking === session.id ? "Revoking..." : "Revoke"}
                  </button>
                    <button
                      onClick={() => revokeAllUserSessions(session.user_id)}
                      disabled={revokingAll === session.user_id}
                      className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-50"
                    >
                      {revokingAll === session.user_id ? "Revoking..." : "Revoke All"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <Pagination page={sessionsPage} totalPages={sessionsTotalPages} onPageChange={setSessionsPage} />
      </div>
    </div>
  );
}

function SystemSection({ health }: { health: SystemHealth }) {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [autoAssign, setAutoAssign] = useState(true);

  return (
    <div className="space-y-6">
      {/* Health Deep Dive */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-foreground">
            Infrastructure Status
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-2">
          {[
            { label: "CPU Usage", value: health.cpu, unit: "%" },
            { label: "Memory Usage", value: health.memory, unit: "%" },
          ].map(({ label, value, unit }) => (
            <div key={label} className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  {label}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {value}
                  {unit}
                </span>
              </div>
              <MetricBar value={value} />
            </div>
          ))}
          {[
            { label: "DB Latency", value: `${health.dbLatency} ms` },
            { label: "API Response Time", value: `${health.apiResponseTime} ms` },
            { label: "Active Connections", value: `${health.activeConnections}` },
            { label: "Queue Depth", value: `${health.queueDepth} jobs` },
            { label: "Error Rate (24h)", value: `${health.errorRate}%` },
            { label: "System Uptime", value: health.uptime },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-lg bg-zinc-50 px-4 py-3 dark:bg-zinc-800/50"
            >
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {label}
              </span>
              <span className="text-sm font-semibold text-foreground">
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* System Controls */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-foreground">
            System Controls
          </h2>
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {[
            {
              label: "Maintenance Mode",
              description:
                "Disable the app for all users except superadmins.",
              value: maintenanceMode,
              toggle: () => setMaintenanceMode((v) => !v),
              danger: true,
            },
            {
              label: "Email Notifications",
              description: "Send automated emails on ticket events.",
              value: emailNotifs,
              toggle: () => setEmailNotifs((v) => !v),
              danger: false,
            },
            {
              label: "Auto-Assign Tickets",
              description:
                "Automatically assign new tickets to available support staff.",
              value: autoAssign,
              toggle: () => setAutoAssign((v) => !v),
              danger: false,
            },
          ].map(({ label, description, value, toggle, danger }) => (
            <div
              key={label}
              className="flex items-center justify-between gap-4 px-5 py-4"
            >
              <div>
                <p
                  className={`text-sm font-medium ${danger && value ? "text-red-600" : "text-foreground"}`}
                >
                  {label}
                  {danger && value && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                      Active
                    </span>
                  )}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {description}
                </p>
              </div>
              <button
                onClick={toggle}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                  value
                    ? danger
                      ? "bg-red-500"
                      : "bg-emerald-500"
                    : "bg-zinc-300 dark:bg-zinc-600"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                    value ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <button
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            disabled
            title="Coming soon"
          >
            Clear Cache
          </button>
          <button
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            disabled
            title="Coming soon"
          >
            Flush Queue
          </button>
          <button
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20"
            disabled
            title="Coming soon"
          >
            Restart Workers
          </button>
        </div>
      </div>
    </div>
  );
}

function LogsSection({ logs }: { logs: SystemLog[] }) {
  const [levelFilter, setLevelFilter] = useState<LogLevel | "all">("all");
  const filtered =
    levelFilter === "all"
      ? logs
      : logs.filter((l) => l.level === levelFilter);

  const { paginatedItems: paginatedLogs, page: logsPage, totalPages: logsTotalPages, setPage: setLogsPage } = usePagination(filtered);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["all", "error", "warn", "info", "debug"] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLevelFilter(l)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition-colors ${
              levelFilter === l
                ? "bg-foreground text-background"
                : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {paginatedLogs.map((log) => (
            <div key={log.id} className="px-5 py-3">
              <div className="flex flex-wrap items-start gap-3">
                <span
                  className={`mt-0.5 inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide ${logLevelStyles[log.level]}`}
                >
                  {log.level}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {log.message}
                  </p>
                  {log.meta && (
                    <p className="mt-1 rounded bg-zinc-50 px-2 py-1 font-mono text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      {log.meta}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-zinc-400">
                    {formatTimestamp(log.timestamp)}
                  </p>
                  <p className="text-xs text-zinc-300 dark:text-zinc-600">
                    {log.source}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <Pagination page={logsPage} totalPages={logsTotalPages} onPageChange={setLogsPage} />
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
            <p className="text-sm">No logs for this level.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsSection({ user, onOpenProfile }: { user: { name: string; email: string }; onOpenProfile: () => void }) {
  const [siteName, setSiteName] = useState("HelpDeskIT");
  const [maxTickets, setMaxTickets] = useState("10");
  const [sessionTimeout, setSessionTimeout] = useState("60");

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-foreground">
            Profile Settings
          </h2>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
            <div>
              <p className="text-sm font-medium text-foreground">{user.name}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{user.email}</p>
            </div>
            <button
              onClick={onOpenProfile}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Edit Profile
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-foreground">
            General Settings
          </h2>
        </div>
        <div className="space-y-5 p-5">
          {[
            {
              label: "Site Name",
              value: siteName,
              setter: setSiteName,
              type: "text",
            },
            {
              label: "Max Tickets per User",
              value: maxTickets,
              setter: setMaxTickets,
              type: "number",
            },
            {
              label: "Session Timeout (minutes)",
              value: sessionTimeout,
              setter: setSessionTimeout,
              type: "number",
            },
          ].map(({ label, value, setter, type }) => (
            <div key={label} className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {label}
              </label>
              <input
                type={type}
                value={value}
                onChange={(e) => setter(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          ))}
          <button className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:opacity-90">
            Save Changes
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-xl border border-red-200 bg-white dark:border-red-900/50 dark:bg-zinc-900">
        <div className="border-b border-red-200 px-5 py-4 dark:border-red-900/50">
          <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">
            Danger Zone
          </h2>
        </div>
        <div className="space-y-4 p-5">
          {[
            {
              label: "Purge All Closed Tickets",
              desc: "Permanently delete all tickets with status 'closed'. This cannot be undone.",
            },
            {
              label: "Reset All User Passwords",
              desc: "Force all users to reset their passwords on next login.",
            },
            {
              label: "Wipe Knowledge Base",
              desc: "Delete all knowledge base articles. This cannot be undone.",
            },
          ].map(({ label, desc }) => (
            <div
              key={label}
              className="flex flex-col gap-3 rounded-lg border border-red-100 p-4 dark:border-red-900/30 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{desc}</p>
              </div>
              <button
                className="shrink-0 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                disabled
                title="Coming soon"
              >
                {label.split(" ").slice(0, 2).join(" ")}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SuperAdminDashboard() {
  const [viewingAs, setViewingAs] = useState<"superadmin" | "admin" | "support" | "user">("superadmin");
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<NavSection>(() => {
    if (typeof window === "undefined") return "overview";
    const saved = localStorage.getItem("superadmin_active_section");
    if (saved && ["overview", "users", "tickets", "activity", "sessions", "system", "logs", "settings"].includes(saved)) {
      return saved as NavSection;
    }
    return "overview";
  });
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });
  const [health, setHealth] = useState<SystemHealth>({
    cpu: 0,
    memory: 0,
    dbLatency: 0,
    apiResponseTime: 0,
    uptime: "—",
    activeConnections: 0,
    errorRate: 0,
    queueDepth: 0,
  });
  const [users, setUsers] = useState<SystemUser[]>(() => {
    const cached = getCachedData<SystemUser[]>("superadmin_users");
    return cached?.data || [];
  });
  const [tickets, setTickets] = useState<Ticket[]>(() => {
    const cached = getCachedData<Ticket[]>("superadmin_tickets");
    return cached?.data || [];
  });
  const [staffList, setStaffList] = useState<
    Array<{ id: string; name: string; email: string; role: string; avatar: string; active: boolean }>
  >([]);
  const [logs, setLogs] = useState<SystemLog[]>(() => {
    const cached = getCachedData<SystemLog[]>("superadmin_logs");
    return cached?.data || [];
  });
  const [activities, setActivities] = useState<ActivityLog[]>(() => {
    const cached = getCachedData<ActivityLog[]>("superadmin_activities");
    return cached?.data || [];
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const { unreadMessages } = useNotifications();

  const { user, loading, signingOut } = useAuth();

  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.classList.toggle("dark", theme === "dark");
      localStorage.setItem("theme", theme);
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("superadmin_active_section", activeSection);
    }
  }, [activeSection]);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ticketDialogRef = useRef<HTMLDivElement>(null);

  const getFocusableElements = useCallback((root: HTMLElement | null) => {
    if (!root) return [];
    return Array.from(
      root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute("disabled"));
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== "superadmin") {
      fetch("/api/unauthorized-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "/super-admin",
          reason: user ? `Insufficient role: ${user.role}` : "Not authenticated",
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        }),
      }).catch(() => {});
    }
  }, [user, loading]);

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
    const handleClickOutside = (e: MouseEvent) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target as Node)) {
        setShowRoleMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user || user.role !== "superadmin") return;
    let mounted = true;

    const refresh = async () => {
      try {
        setLoadError(null);
        const [healthRes, usersRes, ticketsRes, staffRes, logsRes, activityRes] = await Promise.all([
          supabase
            .from("system_health")
            .select("*")
            .order("recorded_at", { ascending: false })
            .limit(1),
          fetch("/api/users").then(async (res) => {
            if (!res.ok) {
              const text = await res.text();
              throw new Error(text || `Users fetch failed: ${res.status}`);
            }
            return res.json();
          }),
          supabase
            .from("tickets")
            .select("*, support_staff!left(name)")
            .order("created_at", { ascending: false }),
          supabase
            .from("support_staff")
            .select("*")
            .order("name"),
          supabase
            .from("system_logs")
            .select("*")
            .order("timestamp", { ascending: false })
            .limit(200),
          supabase
            .from("activity_logs")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(100),
        ]);

        if (!mounted) return;
        const firstError =
          healthRes.error ??
          (usersRes.error && usersRes.error) ??
          ticketsRes.error ??
          staffRes.error ??
          logsRes.error ??
          activityRes.error;
        if (firstError) {
          setLoadError(
            typeof firstError === "string" ? firstError : firstError.message || "Failed to load"
          );
          return;
        }
        if (healthRes.data?.length) {
          const health = toSystemHealth(healthRes.data[0]);
          setHealth(health);
          setCachedData("superadmin_health", health, 30_000);
        }
        if (usersRes.users) {
          setUsers(usersRes.users);
          setCachedData("superadmin_users", usersRes.users, 60_000);
        } else if (Array.isArray(usersRes)) {
          setUsers(usersRes);
          setCachedData("superadmin_users", usersRes, 60_000);
        }
        if (ticketsRes.data) {
          const tickets = ticketsRes.data.map(toTicket);
          setTickets(tickets);
          setCachedData("superadmin_tickets", tickets, 30_000);
        }
        if (staffRes.data) {
          const staff = staffRes.data.map((row: Record<string, unknown>) => ({
            id: String(row.id),
            name: String(row.name ?? ""),
            email: String(row.email ?? ""),
            role: String(row.role ?? ""),
            avatar: String(row.avatar ?? ""),
            active: Boolean(row.active),
          }));
          setStaffList(staff);
        }
        if (logsRes.data) {
          const logs = logsRes.data.map(toSystemLog);
          setLogs(logs);
          setCachedData("superadmin_logs", logs, 60_000);
        }
        if (activityRes.data) {
          setActivities(activityRes.data);
          setCachedData("superadmin_activities", activityRes.data, 30_000);
        }
      } catch (err) {
        if (mounted) {
          setLoadError(err instanceof Error ? err.message : "Failed to load data");
        }
      }
    };

    refresh();

     const scheduleRefresh = () => {
       if (debounceTimer.current) clearTimeout(debounceTimer.current);
       debounceTimer.current = setTimeout(() => {
         refresh();
         debounceTimer.current = null;
       }, 300);
     };

     const channels = [
       supabase.channel("realtime-accounts").on(
         "postgres_changes",
         { event: "*", schema: "public", table: "accounts" },
         scheduleRefresh
       ),
       supabase.channel("realtime-tickets").on(
         "postgres_changes",
         { event: "*", schema: "public", table: "tickets" },
         scheduleRefresh
       ),
       supabase.channel("realtime-activity").on(
         "postgres_changes",
         { event: "*", schema: "public", table: "activity_logs" },
         scheduleRefresh
       ),
       supabase.channel("realtime-logs").on(
         "postgres_changes",
         { event: "*", schema: "public", table: "system_logs" },
         scheduleRefresh
       ),
       supabase.channel("realtime-health").on(
         "postgres_changes",
         { event: "*", schema: "public", table: "system_health" },
         scheduleRefresh
       ),
     ];

     channels.forEach((channel) => channel.subscribe());

     return () => {
       mounted = false;
       if (debounceTimer.current) clearTimeout(debounceTimer.current);
       channels.forEach((channel) => supabase.removeChannel(channel));
     };
  }, [user]);

  const handleApproveUser = async (id: string) => {
    setActionError(null);
    const { error } = await supabase
      .from("accounts")
      .update({ status: "active" })
      .eq("id", id);
    if (error) {
      setActionError(error.message);
      return;
    }
    const { data: verify } = await supabase
      .from("accounts")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    if (verify?.status !== "active") {
      setActionError("Failed to approve user");
      return;
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, status: "active" } : u))
    );
    await logActivity({
      action: "user_approved",
      target_type: "user",
      target_id: id,
      details: "Approved pending user",
    });
  };

  const handleToggleStatus = async (id: string) => {
    setActionError(null);
    const current = users.find((u) => u.id === id);
    if (!current) return;
    const next = current.status === "active" ? "suspended" : "active";
    const { error } = await supabase
      .from("accounts")
      .update({ status: next })
      .eq("id", id);
    if (error) {
      setActionError(error.message);
      return;
    }
    const { data: verify } = await supabase
      .from("accounts")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    if (verify?.status !== next) {
      setActionError("Failed to update user status");
      return;
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, status: next } : u))
    );
    await logActivity({
      action: "user_status_changed",
      target_type: "user",
      target_id: id,
      details: `Set user ${current.email} to ${next}`,
    });
  };

  const handleEditRole = async (id: string, role: UserRole) => {
    setActionError(null);
    const current = users.find((u) => u.id === id);
    if (!current || current.role === role) {
      return;
    }

    const { error } = await supabase
      .from("accounts")
      .update({ role })
      .eq("id", id);

    if (error) {
      setActionError(error.message);
      return;
    }

    const { data: verify } = await supabase
      .from("accounts")
      .select("role")
      .eq("id", id)
      .maybeSingle();

    if (verify?.role !== role) {
      setActionError("Failed to update user role");
      return;
    }

    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, role } : u))
    );
    await logActivity({
      action: "user_role_changed",
      target_type: "user",
      target_id: id,
      details: `Changed ${current.email} role from ${current.role} to ${role}`,
    });
  };

  const assignTicket = async (ticketId: string, staffId: string) => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("tickets")
      .update({ assigned_to: staffId || null, updated_at: now })
      .eq("id", ticketId);
    if (error) {
      setActionError(error.message);
      return;
    }
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? { ...t, assignedTo: staffId || undefined, assignedAgent: staffId ? (staffList.find((s) => s.id === staffId)?.name ?? "Unassigned") : "Unassigned", updatedAt: now }
          : t,
      ),
    );
    setSelectedTicket((prev) =>
      prev && prev.id === ticketId
        ? { ...prev, assignedTo: staffId || undefined, assignedAgent: staffId ? (staffList.find((s) => s.id === staffId)?.name ?? "Unassigned") : "Unassigned", updatedAt: now }
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

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      localStorage.setItem("theme", next);
      return next;
    });
  };

  const navItems: { key: NavSection; label: string; icon: React.ReactNode }[] =
    [
      {
        key: "overview",
        label: "Overview",
        icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
        ),
      },
      {
        key: "users",
        label: "Users",
        icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
        ),
      },
      {
        key: "tickets",
        label: "All Tickets",
        icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v8.25A2.25 2.25 0 006 16.5h.75m3 3h.75m-3 3v.75m0 0h.75m-3 0h.75" />
          </svg>
        ),
      },
      {
        key: "activity",
        label: "Activity",
        icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        key: "sessions",
        label: "Sessions",
        icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.25h15a1.5 1.5 0 001.5-1.5V19a5.25 5.25 0 00-10.5 0v.75a1.5 1.5 0 01-1.5 1.5H4.5z" />
          </svg>
        ),
      },
      {
        key: "system",
        label: "System",
        icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
          </svg>
        ),
      },
      {
        key: "logs",
        label: "Logs",
        icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        ),
      },
      {
        key: "settings",
        label: "Settings",
        icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217-.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
    ];

  const errorCount = logs.filter((l) => l.level === "error").length;
  const pendingUsers = users.filter((u) => u.status === "pending").length;

  const sectionTitles: Record<NavSection, string> = {
    overview: "System Overview",
    users: "User Management",
    tickets: "All Tickets",
    activity: "Activity Feed",
    sessions: "Active Sessions",
    system: "System Monitor",
    logs: "System Logs",
    settings: "System Settings",
  };

if (loading || signingOut) return <SuperAdminSkeleton />;
  if (!user || user.role !== "superadmin") {
    return (
      <>
        <SuperAdminSkeleton />
        <ForbiddenAccessModal
          isOpen
          onClose={() => {}}
          attemptedPath="/super-admin"
        />
      </>
    );
  }

  return (
    <div className="dashboard-shell">
      <style>{`
        @media (max-width: 768px) {
          .dashboard-header .flex.min-h-16 {
            flex-wrap: wrap !important;
            min-height: auto !important;
            gap: 0.5rem !important;
            padding: 0.5rem 0 !important;
          }
          .dashboard-header-inner {
            padding: 0.25rem 0.75rem !important;
          }
          .dashboard-brand-copy {
            display: none !important;
          }
          .dashboard-action-button {
            padding: 0.4rem 0.6rem !important;
            font-size: 0.7rem !important;
          }
          .dashboard-actions {
            width: 100% !important;
            justify-content: flex-start !important;
            gap: 0.4rem !important;
            flex-wrap: wrap !important;
          }
          .dashboard-actions .relative:first-of-type {
            order: -1;
          }
          .dashboard-shell .h-64 {
            height: 10rem !important;
          }
          .dashboard-shell .gap-8 {
            gap: 1rem !important;
          }
          .dashboard-shell .pt-8 {
            padding-top: 1rem !important;
          }
          .dashboard-shell table {
            font-size: 0.7rem !important;
          }
          .dashboard-shell th,
          .dashboard-shell td {
            padding: 0.4rem 0.3rem !important;
          }
          .dashboard-stat-card {
            padding: 0.5rem !important;
          }
          .dashboard-stat-card .value {
            font-size: 1rem !important;
          }
          .dashboard-shell main h2 {
            font-size: 1rem !important;
            margin-bottom: 0.75rem !important;
          }
          .dashboard-shell .p-5 {
            padding: 0.75rem !important;
          }
          .dashboard-shell .mb-4 > .flex {
            gap: 0.3rem !important;
          }
          .dashboard-shell .mb-4 .shrink-0 {
            padding: 0.25rem 0.5rem !important;
            font-size: 0.7rem !important;
          }
          .dashboard-shell .px-5 {
            padding-left: 0.75rem !important;
            padding-right: 0.75rem !important;
          }
          .dashboard-shell .py-4 {
            padding-top: 0.5rem !important;
            padding-bottom: 0.5rem !important;
          }
          .dashboard-shell .space-y-6 > :not([hidden]) ~ :not([hidden]) {
            margin-top: 1rem !important;
          }
          .dashboard-shell .space-y-4 > :not([hidden]) ~ :not([hidden]) {
            margin-top: 0.75rem !important;
          }
          .dashboard-shell .text-2xl {
            font-size: 1.1rem !important;
          }
          .dashboard-shell .text-xl {
            font-size: 1rem !important;
          }
          .dashboard-shell .text-sm {
            font-size: 0.75rem !important;
          }
          .dashboard-shell .text-xs {
            font-size: 0.65rem !important;
          }
          .dashboard-shell .gap-4 {
            gap: 0.5rem !important;
          }
          .dashboard-shell .gap-6 {
            gap: 1rem !important;
          }
          .dashboard-shell .my-6,
          .dashboard-shell .mb-6 {
            margin-bottom: 1rem !important;
          }
          .dashboard-shell .mt-4 {
            margin-top: 0.5rem !important;
          }
        }
      `}</style>
      {/* Header */}
      <header className="dashboard-header">
        <div className="dashboard-header-inner">
          <div className="flex min-h-16 flex-nowrap items-center justify-between gap-2 py-2">
            <div className="dashboard-brand">
              <div className="dashboard-brand-mark">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v8.25A2.25 2.25 0 006 16.5h.75m3 3h.75m-3 3v.75m0 0h.75m-3 0h.75" />
                </svg>
              </div>
              <div className="dashboard-brand-copy">
                <h1>HelpDeskIT</h1>
                <p>Superadmin Console</p>
              </div>
            </div>
            <div className="dashboard-actions">
              {/* Alerts */}
              {errorCount > 0 && (
                <button
                  onClick={() => setActiveSection("logs")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                  </span>
                  {errorCount}
                  <span className="hidden sm:inline">
                    {" "}
                    error{errorCount > 1 ? "s" : ""}
                  </span>
                </button>
              )}
              {pendingUsers > 0 && (
                <button
                  onClick={() => setActiveSection("users")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-400"
                >
                  {pendingUsers}
                  <span className="hidden sm:inline"> pending</span>
                </button>
              )}
              {/* Role Switcher */}
              <div className="relative" ref={roleMenuRef}>
                <button
                  onClick={() => setShowRoleMenu(!showRoleMenu)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewingAs !== "superadmin"
                      ? "border-violet-400 bg-violet-100 text-violet-800 dark:border-violet-700 dark:bg-violet-900/40 dark:text-violet-200"
                      : "border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-900/30 dark:text-violet-300"
                  }`}
                  title="Switch dashboard view"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                  </svg>
                  <span className="hidden sm:inline">Switch View</span>
                  <span className="sm:hidden">View</span>
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                {viewingAs !== "superadmin" && (
                  <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
                    <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-violet-500 text-[8px] font-bold text-white">
                      !
                    </span>
                  </span>
                )}
                {showRoleMenu && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                    <div className="border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Switch Dashboard View</p>
                    </div>
                    <div className="py-1">
                      {([
                        { role: "superadmin" as const, label: "Superadmin", icon: "👑", desc: "Full system access" },
                        { role: "admin" as const, label: "Admin", icon: "🛡️", desc: "Staff management" },
                        { role: "support" as const, label: "Support", icon: "🎧", desc: "Ticket support" },
                        { role: "user" as const, label: "User", icon: "👤", desc: "Client portal" },
                      ]).map(({ role, label, icon, desc }) => (
                        <button
                          key={role}
                          onClick={() => {
                            setViewingAs(role);
                            setShowRoleMenu(false);
                          }}
                          className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                            viewingAs === role ? "bg-violet-50 dark:bg-violet-900/20" : ""
                          }`}
                        >
                          <span className="text-base">{icon}</span>
                          <div className="flex-1">
                            <p className={`text-sm font-medium ${viewingAs === role ? "text-violet-700 dark:text-violet-300" : "text-foreground"}`}>
                              {label}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">{desc}</p>
                          </div>
                          {viewingAs === role && (
                            <svg className="h-4 w-4 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={toggleTheme}
                className="dashboard-action-button"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 15.002A9 9 0 1112 2.25a.75.75 0 01.696 1.03 7.5 7.5 0 008.024 10.026.75.75 0 01.03 1.696z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1.5m0 15V21m9-9h-1.5m-15 0H3m15.364 6.364l-1.06-1.06M6.697 6.697l-1.06-1.06m12.728 0l-1.06 1.06M6.697 17.303l-1.06 1.06M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => setIsChatOpen(true)}
                className="dashboard-action-button relative"
              >
                {unreadMessages > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
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
              <div className="hidden items-center gap-2 sm:flex">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                  {(user?.name || "S").charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col leading-tight text-left">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-200">
                    {user?.name || "Super Admin"}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {user?.email || "admin@company.com"}
                  </span>
                </div>
              </div>
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      {loadError && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
            {loadError}
          </div>
        </div>
      )}

      {actionError && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
            {actionError}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 pt-4 lg:flex-row lg:gap-8 lg:pt-8 items-start">
          {/* Sidebar Nav */}
          <aside className="hidden w-48 shrink-0 lg:block sticky top-20 h-[calc(100vh-5rem)] overflow-y-auto">
            <nav className="space-y-1">
              {navItems.map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveSection(key)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    activeSection === key
                      ? "bg-zinc-100 text-foreground dark:bg-zinc-800"
                      : "text-zinc-500 hover:bg-zinc-50 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200"
                  }`}
                >
                  {icon}
                  {label}
                  {key === "logs" && errorCount > 0 && (
                    <span className="ml-auto inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
                      {errorCount}
                    </span>
                  )}
                  {key === "users" && pendingUsers > 0 && (
                    <span className="ml-auto inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-xs font-medium text-white">
                      {pendingUsers}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </aside>

          {/* Mobile Nav */}
          <div className="w-full overflow-x-auto lg:hidden">
            <div className="flex gap-2 pb-2">
              {navItems.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveSection(key)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeSection === key
                      ? "bg-foreground text-background"
                      : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          {viewingAs === "superadmin" ? (
            <main className="min-w-0 flex-1 pb-8 w-full">
              <h2 className="mb-6 text-xl font-semibold text-foreground">
                {sectionTitles[activeSection]}
              </h2>
              {activeSection === "overview" && (
                <OverviewSection
                  health={health}
                  users={users}
                  tickets={tickets}
                  activities={activities}
                />
              )}
              {activeSection === "users" && (
                <UsersSection
                  users={users}
                  onApproveUser={handleApproveUser}
                  onToggleStatus={handleToggleStatus}
                  onEditRole={handleEditRole}
                />
              )}
              {activeSection === "tickets" && (
                <TicketsSection
                  tickets={tickets}
                  staffList={staffList}
                  onViewTicket={setSelectedTicket}
                  onReassign={assignTicket}
                />
              )}
              {activeSection === "activity" && <ActivitySection activities={activities} />}
              {activeSection === "sessions" && <SessionsSection />}
              {activeSection === "system" && <SystemSection health={health} />}
              {activeSection === "logs" && <LogsSection logs={logs} />}
              {activeSection === "settings" && (
                <SettingsSection
                  user={{ name: user.name, email: user.email }}
                  onOpenProfile={() => setIsProfileOpen(true)}
                />
              )}
            </main>
          ) : (
            <main className="min-w-0 flex-1 pb-8 w-full">
              {/* Role View Banner */}
              <div className="mb-4 flex items-center justify-between rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 dark:border-violet-800 dark:bg-violet-900/20">
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
                    Viewing as <span className="font-semibold capitalize">{viewingAs}</span>
                  </span>
                </div>
                <button
                  onClick={() => setViewingAs("superadmin")}
                  className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-700"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                  </svg>
                  Return to Superadmin
                </button>
              </div>
              {viewingAs === "admin" && <AdminDashboard embedded />}
              {viewingAs === "support" && <SupportDashboard embedded />}
              {viewingAs === "user" && <UserDashboard embedded />}
            </main>
          )}
        </div>
      </div>
      {isProfileOpen && (
        <ProfileSettingsModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          initialName={user.name}
          initialEmail={user.email}
        />
      )}
      {isChatOpen && (
        <ChatPanel
          currentUser={{
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          }}
          getRecipients={async () => {
            const { data: admins } = await supabase
              .from("accounts")
              .select("id, name, email, role")
              .eq("role", "admin");
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
            const mappedStaff = (staff || [])
              .filter((s) => staffAccountMap.has(s.email))
              .map((s) => ({
                id: staffAccountMap.get(s.email)!,
                name: s.name,
                email: s.email,
                role: s.role,
              }));
            const recipientMap = new Map<string, { id: string; name: string; email: string; role: string }>();
            for (const admin of admins || []) {
              recipientMap.set(admin.id, admin);
            }
            for (const staffMember of mappedStaff) {
              recipientMap.set(staffMember.id, staffMember);
            }
            return Array.from(recipientMap.values());
          }}
          title="Messages"
          onClose={() => setIsChatOpen(false)}
        />
      )}
      {selectedTicket && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4 safe-top safe-bottom sm:items-center"
          onClick={() => setSelectedTicket(null)}
        >
          <div
            ref={ticketDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="superAdminTicketDetailTitle"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="my-4 w-full max-w-lg rounded-2xl bg-white shadow-xl dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <h3 id="superAdminTicketDetailTitle" className="text-lg font-semibold text-foreground">
                Ticket {selectedTicket.id}
              </h3>
              <button
                onClick={() => setSelectedTicket(null)}
                className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto space-y-4 p-6">
              <div>
                <h4 className="text-sm font-semibold text-foreground">{selectedTicket.subject}</h4>
                <p className="mt-2 whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-400">
                  {selectedTicket.description.replace(/\s*\|\s*/g, '\n')}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Category</p>
                  <p className="mt-1 text-sm text-foreground">{selectedTicket.category}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Priority</p>
                  <p className={`mt-1 text-sm font-medium ${priorityStyles[selectedTicket.priority]}`}>
                    {selectedTicket.priority}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Status</p>
                  <span className={`mt-1 inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium ${ticketStatusStyles[selectedTicket.status]}`}>
                    {selectedTicket.status.replace("_", " ")}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Assigned To</p>
                  <p className="mt-1 text-sm text-foreground">{selectedTicket.assignedAgent}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Submitted By</p>
                  <p className="mt-1 text-sm text-foreground">{selectedTicket.submittedBy}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Created</p>
                  <p className="mt-1 text-sm text-foreground">{formatDate(selectedTicket.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Updated</p>
                  <p className="mt-1 text-sm text-foreground">{formatDate(selectedTicket.updatedAt)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
