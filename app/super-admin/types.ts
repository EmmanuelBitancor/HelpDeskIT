import type { TicketStatus, TicketPriority } from "../types/ticket";

export type { TicketStatus, TicketPriority };

export type UserRole = "user" | "support" | "admin" | "superadmin";
export type UserStatus = "active" | "suspended" | "pending";
export type LogLevel = "info" | "warn" | "error" | "debug";
export type NavSection =
  | "overview"
  | "users"
  | "tickets"
  | "activity"
  | "sessions"
  | "system"
  | "logs"
  | "settings";

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastLogin: string;
  ticketCount: number;
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
  assignedTo?: string;
  assignedAgent: string;
  submittedBy?: string;
}

export interface SystemLog {
  id: string;
  level: LogLevel;
  message: string;
  source: string;
  timestamp: string;
  meta?: string;
}

export interface ActivityLog {
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

export interface SystemHealth {
  cpu: number;
  memory: number;
  dbLatency: number;
  apiResponseTime: number;
  uptime: string;
  activeConnections: number;
  errorRate: number;
  queueDepth: number;
}
