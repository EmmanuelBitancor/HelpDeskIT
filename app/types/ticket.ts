export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "critical";

export interface TicketHistoryEntry {
  id: string;
  status: TicketStatus;
  note: string;
  by: string;
  at: string;
}

export interface Ticket {
  id: string;
  subject: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  description: string;
  submittedBy?: string;
  assignedTo?: string;
  resolutionNotes?: string;
  history?: TicketHistoryEntry[];
}

export interface SupportStaff {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
  active: boolean;
}
