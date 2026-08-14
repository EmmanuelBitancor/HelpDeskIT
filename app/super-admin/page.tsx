"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { FORBIDDEN_ROUTE } from "@/context/authTypes";
import SignOutButton from "@/components/SignOutButton";
import Loading from "@/components/Loading";
import { createClient } from "@/lib/supabase/client";
import type { TicketStatus, TicketPriority } from "../types/ticket";

const supabase = createClient();

function toSystemUser(row: Record<string, unknown>): SystemUser {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    role: (row.role as UserRole) ?? "user",
    status: (row.status as UserStatus) ?? "active",
    createdAt: String(row.created_at ?? ""),
    lastLogin: row.last_login ? String(row.last_login) : "—",
    ticketCount: Number(row.ticket_count ?? 0),
  };
}

function toTicket(row: Record<string, unknown>): Ticket {
  const staff = row.support_staff as { name?: string } | null | undefined;
  return {
    id: String(row.id),
    subject: String(row.subject ?? ""),
    category: String(row.category ?? ""),
    priority: (row.priority as TicketPriority) ?? "low",
    status: (row.status as TicketStatus) ?? "open",
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    assignedAgent: staff?.name ? String(staff.name) : "Unassigned",
    submittedBy: row.submitted_by ? String(row.submitted_by) : "—",
  };
}

function toSystemLog(row: Record<string, unknown>): SystemLog {
  return {
    id: String(row.id),
    level: (row.level as LogLevel) ?? "info",
    message: String(row.message ?? ""),
    source: String(row.source ?? ""),
    timestamp: String(row.timestamp ?? ""),
    meta: row.meta ? String(row.meta) : undefined,
  };
}

function toSystemHealth(row: Record<string, unknown>): SystemHealth {
  return {
    cpu: Number(row.cpu ?? 0),
    memory: Number(row.memory ?? 0),
    dbLatency: Number(row.db_latency ?? 0),
    apiResponseTime: Number(row.api_response_time ?? 0),
    uptime: String(row.uptime ?? "—"),
    activeConnections: Number(row.active_connections ?? 0),
    errorRate: Number(row.error_rate ?? 0),
    queueDepth: Number(row.queue_depth ?? 0),
  };
}

// ─── Types ───────────────────────────────────────────────────────────────────

type UserRole = "user" | "agent" | "admin" | "superadmin";
type UserStatus = "active" | "suspended" | "pending";
type LogLevel = "info" | "warn" | "error" | "debug";
type NavSection =
  | "overview"
  | "users"
  | "tickets"
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
  assignedAgent: string;
  submittedBy: string;
}

interface SystemLog {
  id: string;
  level: LogLevel;
  message: string;
  source: string;
  timestamp: string;
  meta?: string;
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const statusStyles: Record<UserStatus, string> = {
  active:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  suspended: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  pending:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

const roleStyles: Record<UserRole, string> = {
  superadmin: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  admin: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  agent: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  user: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const ticketStatusStyles: Record<TicketStatus, string> = {
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
  critical: "text-red-600 font-semibold",
};

const logLevelStyles: Record<LogLevel, string> = {
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  warn: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  debug: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateString: string) {
  if (dateString === "—") return "—";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimestamp(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
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
  logs,
}: {
  health: SystemHealth;
  users: SystemUser[];
  tickets: Ticket[];
  logs: SystemLog[];
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

      {/* System Health Panel */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <h2 className="text-sm font-semibold text-foreground">
              System Health
            </h2>
            <span className="ml-auto text-xs text-zinc-400">Live</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "CPU Usage", value: health.cpu, unit: "%" },
            { label: "Memory", value: health.memory, unit: "%" },
          ].map(({ label, value, unit }) => (
            <div key={label} className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
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
          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              DB Latency
            </p>
            <p className="text-xl font-semibold text-foreground">
              {health.dbLatency}
              <span className="text-xs font-normal text-zinc-400"> ms</span>
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              API Response
            </p>
            <p className="text-xl font-semibold text-foreground">
              {health.apiResponseTime}
              <span className="text-xs font-normal text-zinc-400"> ms</span>
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Active Connections
            </p>
            <p className="text-xl font-semibold text-foreground">
              {health.activeConnections}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Queue Depth
            </p>
            <p className="text-xl font-semibold text-foreground">
              {health.queueDepth}
              <span className="text-xs font-normal text-zinc-400"> jobs</span>
            </p>
          </div>
        </div>
      </div>

      {/* Recent Critical Activity */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-foreground">
            Recent Critical Activity
          </h2>
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {logs.filter((l) => l.level === "error" || l.level === "warn")
            .slice(0, 4)
            .map((log) => (
              <div key={log.id} className="flex items-start gap-3 px-5 py-3">
                <span
                  className={`mt-0.5 inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide ${logLevelStyles[log.level]}`}
                >
                  {log.level}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">
                    {log.message}
                  </p>
                  <p className="text-xs text-zinc-400">{log.source}</p>
                </div>
                <span className="shrink-0 text-xs text-zinc-400">
                  {formatTimestamp(log.timestamp)}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function UsersSection({
  users,
  onApproveUser,
  onToggleStatus,
}: {
  users: SystemUser[];
  onApproveUser: (id: string) => void;
  onToggleStatus: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");

  const filtered = users.filter((u) => {
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

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
          {(["all", "superadmin", "admin", "agent", "user"] as const).map(
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
              {filtered.map((u) => (
                <tr
                  key={u.id}
                  className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
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
                      <button
                        className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                        disabled
                        title="Coming soon"
                      >
                        Edit Role
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
            <p className="text-sm">No users match your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TicketsSection({ tickets }: { tickets: Ticket[] }) {
  const [filter, setFilter] = useState<TicketStatus | "all">("all");

  const filtered =
    filter === "all"
      ? tickets
      : tickets.filter((t) => t.status === filter);

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
        {filtered.map((ticket) => (
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
                <button
                  className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  disabled
                  title="Coming soon"
                >
                  Reassign
                </button>
                <button
                  className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  disabled
                  title="Coming soon"
                >
                  View
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

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
                "Automatically assign new tickets to available agents.",
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
          {filtered.map((log) => (
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
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
            <p className="text-sm">No logs for this level.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsSection() {
  const [siteName, setSiteName] = useState("HelpDeskIT");
  const [maxTickets, setMaxTickets] = useState("10");
  const [sessionTimeout, setSessionTimeout] = useState("60");

  return (
    <div className="space-y-6">
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
  const [activeSection, setActiveSection] = useState<NavSection>("overview");
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
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.classList.toggle("dark", theme === "dark");
      localStorage.setItem("theme", theme);
    }
  }, [theme]);

  useEffect(() => {
    if (!user || user.role !== "superadmin") return;
    let active = true;
    (async () => {
      setLoadError(null);
      const [healthRes, usersRes, ticketsRes, logsRes] = await Promise.all([
        supabase
          .from("system_health")
          .select("*")
          .order("recorded_at", { ascending: false })
          .limit(1),
        supabase
          .from("users")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("tickets")
          .select("*, support_staff!left(name)")
          .order("created_at", { ascending: false }),
        supabase
          .from("system_logs")
          .select("*")
          .order("timestamp", { ascending: false })
          .limit(200),
      ]);
      if (!active) return;
      const firstError =
        healthRes.error ?? usersRes.error ?? ticketsRes.error ?? logsRes.error;
      if (firstError) {
        setLoadError(firstError.message);
        return;
      }
      if (healthRes.data?.length) setHealth(toSystemHealth(healthRes.data[0]));
      if (usersRes.data) setUsers(usersRes.data.map(toSystemUser));
      if (ticketsRes.data) setTickets(ticketsRes.data.map(toTicket));
      if (logsRes.data) setLogs(logsRes.data.map(toSystemLog));
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const handleApproveUser = async (id: string) => {
    setActionError(null);
    const { error, count } = await supabase
      .from("users")
      .update({ status: "active" })
      .eq("id", id);
    if (error || count !== 1) {
      setActionError(error?.message ?? "Failed to approve user");
      return;
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, status: "active" } : u))
    );
  };

  const handleToggleStatus = async (id: string) => {
    setActionError(null);
    const current = users.find((u) => u.id === id);
    if (!current) return;
    const next = current.status === "active" ? "suspended" : "active";
    const { error, count } = await supabase
      .from("users")
      .update({ status: next })
      .eq("id", id);
    if (error || count !== 1) {
      setActionError(error?.message ?? "Failed to update user status");
      return;
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, status: next } : u))
    );
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
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
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
    system: "System Monitor",
    logs: "System Logs",
    settings: "System Settings",
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/");
    } else if (user.role !== "superadmin") {
      router.replace(FORBIDDEN_ROUTE);
    }
  }, [user, loading, router]);

  if (loading) return <Loading />;
  if (!user || user.role !== "superadmin") {
    return <Loading />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-2 py-2">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v8.25A2.25 2.25 0 006 16.5h.75m3 3h.75m-3 3v.75m0 0h.75m-3 0h.75" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">
                  HelpDeskIT
                </h1>
                <p className="text-xs text-zinc-400">Superadmin Console</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
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
              <button
                onClick={toggleTheme}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
        <div className="flex gap-8 py-8">
          {/* Sidebar Nav */}
          <aside className="hidden w-48 shrink-0 lg:block">
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
          <div className="mb-4 flex w-full overflow-x-auto lg:hidden">
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
          <main className="min-w-0 flex-1">
            <h2 className="mb-6 text-xl font-semibold text-foreground">
              {sectionTitles[activeSection]}
            </h2>
            {activeSection === "overview" && (
              <OverviewSection
                health={health}
                users={users}
                tickets={tickets}
                logs={logs}
              />
            )}
            {activeSection === "users" && (
              <UsersSection
                users={users}
                onApproveUser={handleApproveUser}
                onToggleStatus={handleToggleStatus}
              />
            )}
            {activeSection === "tickets" && <TicketsSection tickets={tickets} />}
            {activeSection === "system" && <SystemSection health={health} />}
            {activeSection === "logs" && <LogsSection logs={logs} />}
            {activeSection === "settings" && <SettingsSection />}
          </main>
        </div>
      </div>
    </div>
  );
}
