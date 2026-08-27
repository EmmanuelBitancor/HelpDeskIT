import type { Ticket, TicketStatus, TicketPriority, SystemLog, LogLevel, SystemHealth } from "./types";

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
