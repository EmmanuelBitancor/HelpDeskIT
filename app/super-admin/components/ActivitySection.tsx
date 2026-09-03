"use client";

import { useState } from "react";
import { usePagination, Pagination } from "@/components/Pagination";
import type { ActivityLog } from "../types";
import WeeklyReportButton from "@/components/WeeklyReportButton";

interface ActivitySectionProps {
  activities: ActivityLog[];
}

export default function ActivitySection({ activities }: ActivitySectionProps) {
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
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        <WeeklyReportButton activities={activities} userRole="superadmin" />
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
