"use client";

import { useState, useCallback } from "react";
import { downloadWorkbook, isWithinLastDays, formatDateTime } from "@/lib/export";
import type { Ticket, ActivityLog, SystemUser, SystemHealth } from "@/app/super-admin/types";

interface WeeklyReportProps {
  tickets?: Ticket[];
  activities?: ActivityLog[];
  users?: SystemUser[];
  health?: SystemHealth;
  sessions?: Array<{
    id: string;
    user_id: string;
    user_email: string;
    user_name: string;
    user_role: string;
    device?: string;
    last_active: string;
    created_at: string;
  }>;
  chartImages?: Array<{ title: string; dataUrl: string }>;
  captureCharts?: () => Array<{ title: string; dataUrl: string }>;
  userRole?: "superadmin" | "admin" | "support" | "user";
}

export default function WeeklyReportButton({ tickets, activities, users, health, sessions, chartImages, captureCharts, userRole }: WeeklyReportProps) {
  const [exporting, setExporting] = useState(false);
  const [showNoDataModal, setShowNoDataModal] = useState(false);

  // Check if today is Friday (0=Sunday, 5=Friday)
  const isFriday = () => {
    if (typeof window === 'undefined') return false;
    return new Date().getDay() === 5;
  };

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);

      const weeklyTickets = (tickets ?? []).filter((t) => new Date(t.createdAt) >= weekAgo);
      const weeklyActivities = (activities ?? []).filter((a) => new Date(a.created_at) >= weekAgo);
      const weeklyUsers = (users ?? []).filter((u) => new Date(u.createdAt) >= weekAgo || new Date(u.lastLogin) >= weekAgo);
      const weeklySessions = (sessions ?? []).filter((s) => new Date(s.last_active) >= weekAgo || new Date(s.created_at) >= weekAgo);

      const sheets: Array<{
        name: string;
        columns: { header: string; key: string }[];
        data: Record<string, unknown>[];
        images?: Array<{ base64: string; extension: "png" | "jpeg" | "gif"; width: number; height: number }>;
      }> = [];

      // Tickets sheet
      if (weeklyTickets.length > 0) {
        sheets.push({
          name: "Tickets",
          columns: [
            { header: "Ticket ID", key: "ticketId" },
            { header: "Subject", key: "subject" },
            { header: "Category", key: "category" },
            { header: "Priority", key: "priority" },
            { header: "Status", key: "status" },
            { header: "Assigned To", key: "assignedTo" },
            { header: "Submitted By", key: "submittedBy" },
            { header: "Description", key: "description" },
            { header: "Created", key: "created" },
            { header: "Updated", key: "updated" },
          ],
          data: weeklyTickets.map((t) => ({
            ticketId: t.id,
            subject: t.subject,
            category: t.category,
            priority: t.priority,
            status: t.status.replace(/_/g, " "),
            assignedTo: t.assignedAgent,
            submittedBy: t.submittedBy ?? "—",
            description: typeof t.description === "string" ? t.description.replace(/\s*\|\s*/g, "\n") : t.description,
            created: formatDateTime(t.createdAt),
            updated: formatDateTime(t.updatedAt),
          })),
        });
      }

      // Activities sheet
      if (weeklyActivities.length > 0) {
        sheets.push({
          name: "Activities",
          columns: [
            { header: "ID", key: "id" },
            { header: "Actor", key: "actor" },
            { header: "Role", key: "role" },
            { header: "Action", key: "action" },
            { header: "Details", key: "details" },
            { header: "IP Address", key: "ip" },
            { header: "Created At", key: "createdAt" },
          ],
          data: weeklyActivities.map((a) => ({
            id: a.id,
            actor: a.actor_name,
            role: a.actor_role,
            action: a.action.replace(/_/g, " "),
            details: a.details ?? "—",
            ip: a.ip_address ?? "—",
            createdAt: formatDateTime(a.created_at),
          })),
        });
      }

      // Users sheet
      if (weeklyUsers.length > 0) {
        sheets.push({
          name: "Users",
          columns: [
            { header: "ID", key: "id" },
            { header: "Name", key: "name" },
            { header: "Email", key: "email" },
            { header: "Role", key: "role" },
            { header: "Status", key: "status" },
            { header: "Created At", key: "createdAt" },
            { header: "Last Login", key: "lastLogin" },
            { header: "Ticket Count", key: "ticketCount" },
          ],
          data: weeklyUsers.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            status: u.status,
            createdAt: formatDateTime(u.createdAt),
            lastLogin: formatDateTime(u.lastLogin),
            ticketCount: u.ticketCount,
          })),
        });
      }

      // Sessions sheet
      if (weeklySessions.length > 0) {
        sheets.push({
          name: "Sessions",
          columns: [
            { header: "ID", key: "id" },
            { header: "User Name", key: "userName" },
            { header: "User Email", key: "userEmail" },
            { header: "User Role", key: "userRole" },
            { header: "Device", key: "device" },
            { header: "Last Active", key: "lastActive" },
            { header: "Created At", key: "createdAt" },
          ],
          data: weeklySessions.map((s) => ({
            id: s.id,
            userName: s.user_name,
            userEmail: s.user_email,
            userRole: s.user_role,
            device: s.device ?? "Unknown",
            lastActive: formatDateTime(s.last_active),
            createdAt: formatDateTime(s.created_at),
          })),
        });
      }

      // Charts sheet - capture at export time
      const charts = captureCharts ? captureCharts() : chartImages;
      if (charts && charts.length > 0) {
        const chartSheet = {
          name: "Charts",
          columns: [{ header: "Title", key: "title" }] as { header: string; key: string }[],
          data: [] as Record<string, unknown>[],
          images: [] as Array<{ base64: string; extension: "png" | "jpeg" | "gif"; width: number; height: number }>,
        };

        for (const chart of charts) {
          chartSheet.data.push({ title: chart.title });

          const base64 = chart.dataUrl.replace(/^data:image\/\w+;base64,/, "");
          const extension = (chart.dataUrl.split(";")[0].split("/")[1] || "png") as "png" | "jpeg" | "gif";

          chartSheet.images.push({
            base64,
            extension,
            width: 640,
            height: 360,
          });
        }

        sheets.push(chartSheet);
      }

      if (sheets.length === 0) {
        setShowNoDataModal(true);
        return;
      }

      await downloadWorkbook(sheets, "Weekly_Activity_Data_Report");
    } finally {
      setExporting(false);
    }
  }, [tickets, activities, users, sessions, chartImages, captureCharts]);

  return (
    <>
      <div className="relative inline-flex">
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          title="Export data from the past 7 days"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          {exporting ? "Exporting..." : "Weekly Activity Data Report"}
        </button>

        {/* Friday warning badge for superadmin/admin/support accounts */}
        {userRole && userRole !== "user" && isFriday() && (
          <span
            aria-label="Friday reminder: It's the end of the week. Remember to export your weekly activity data report."
            title="It's Friday! Remember to export this week's activity data report before the week ends."
            className="absolute -right-1 -top-1 flex h-4 w-4 cursor-help"
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
              !
            </span>
          </span>
        )}
      </div>

      {/* No Data Modal */}
      {showNoDataModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="noDataModalTitle"
            className="w-full max-w-md rounded-2xl bg-white shadow-xl dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <h3 id="noDataModalTitle" className="text-lg font-semibold text-foreground">
                No Data Available
              </h3>
              <button
                type="button"
                onClick={() => setShowNoDataModal(false)}
                className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                No data available for the past 7 days to export.
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                Try again later when there is activity data in the system.
              </p>
            </div>
            <div className="flex border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowNoDataModal(false)}
                className="w-full rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-sm transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
