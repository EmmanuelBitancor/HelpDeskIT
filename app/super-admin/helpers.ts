import type { Ticket, TicketStatus, TicketPriority, SystemLog, LogLevel, SystemHealth, SystemUser } from "./types";

export function toTicket(row: Record<string, unknown>): Ticket {
  const staff = row.support_staff as { name?: string } | null | undefined;
  return {
    id: String(row.id),
    subject: String(row.subject ?? ""),
    category: String(row.category ?? ""),
    priority: (row.priority as TicketPriority) ?? "low",
    status: (row.status as TicketStatus) ?? "open",
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    description: String(row.description ?? ""),
    assignedTo: row.assigned_to ? String(row.assigned_to) : undefined,
    assignedAgent: staff?.name ? String(staff.name) : "Unassigned",
    submittedBy: row.submitted_by ? String(row.submitted_by) : "—",
  };
}

export function toSystemLog(row: Record<string, unknown>): SystemLog {
  return {
    id: String(row.id),
    level: (row.level as LogLevel) ?? "info",
    message: String(row.message ?? ""),
    source: String(row.source ?? ""),
    timestamp: String(row.timestamp ?? ""),
    meta: row.meta ? String(row.meta) : undefined,
  };
}

export function toSystemHealth(row: Record<string, unknown>): SystemHealth {
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

export function formatDate(dateString: string) {
  if (dateString === "—") return "—";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTimestamp(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export const statusStyles: Record<string, string> = {
  active:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  suspended: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  pending:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

export const roleStyles: Record<string, string> = {
  superadmin: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  admin: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  support: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  user: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export const ticketStatusStyles: Record<TicketStatus, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  in_progress:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  resolved:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  closed: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export const priorityStyles: Record<TicketPriority, string> = {
  low: "text-zinc-500",
  medium: "text-amber-600",
  high: "text-orange-600",
  critical: "text-red-600 font-semibold",
};

export const logLevelStyles: Record<LogLevel, string> = {
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  warn: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  debug: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};
