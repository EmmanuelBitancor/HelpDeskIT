import type { Ticket, TicketHistoryEntry, SupportStaff } from "./ticket";

export function toStaff(row: Record<string, unknown>): SupportStaff {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    role: String(row.role ?? ""),
    avatar: String(row.avatar ?? ""),
    active: Boolean(row.active),
  };
}

export function toHistoryEntry(row: Record<string, unknown>): TicketHistoryEntry {
  return {
    id: String(row.id),
    status: (row.status as TicketHistoryEntry["status"]) ?? "open",
    note: String(row.note ?? ""),
    by: row.by ? String(row.by) : "",
    at: String(row.at),
  };
}

export function toSupportTicket(
  row: Record<string, unknown>,
  history: TicketHistoryEntry[] = [],
): Ticket {
  return {
    id: String(row.id),
    subject: String(row.subject ?? ""),
    category: String(row.category ?? ""),
    priority: (row.priority as Ticket["priority"]) ?? "low",
    status: (row.status as Ticket["status"]) ?? "open",
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
    description: String(row.description ?? ""),
    submittedBy: row.submitted_by ? String(row.submitted_by) : undefined,
    assignedTo: row.assigned_to ? String(row.assigned_to) : undefined,
    assignedAgent: "Unassigned",
    resolutionNotes: row.resolution_notes ? String(row.resolution_notes) : undefined,
    history,
  };
}

export function toAdminTicket(row: Record<string, unknown>): Ticket {
  return {
    id: String(row.id),
    subject: String(row.subject ?? ""),
    category: String(row.category ?? ""),
    priority: (row.priority as Ticket["priority"]) ?? "low",
    status: (row.status as Ticket["status"]) ?? "open",
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
    description: String(row.description ?? ""),
    submittedBy: row.submitted_by ? String(row.submitted_by) : undefined,
    assignedTo: row.assigned_to ? String(row.assigned_to) : undefined,
    assignedAgent: "Unassigned",
  };
}
