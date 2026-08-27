import { useMemo } from "react";
import { Pie, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import StatCard from "./StatCard";
import { Pagination } from "@/components/Pagination";
import type { SystemHealth, SystemUser, Ticket, ActivityLog } from "../types";
import {
  ticketStatusStyles,
  priorityStyles,
  roleStyles,
  statusStyles,
  formatDate,
} from "../helpers";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

interface OverviewSectionProps {
  health: SystemHealth;
  users: SystemUser[];
  tickets: Ticket[];
  activities: ActivityLog[];
}

export default function OverviewSection({ health, users, tickets, activities }: OverviewSectionProps) {
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
