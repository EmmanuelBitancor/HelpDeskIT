"use client";

import { useState } from "react";
import { usePagination, Pagination } from "@/components/Pagination";
import { logLevelStyles } from "@/lib/styles";
import { formatTimestamp } from "@/lib/utils";
import type { SystemLog, LogLevel } from "../types";

interface LogsSectionProps {
  logs: SystemLog[];
}

export default function LogsSection({ logs }: LogsSectionProps) {
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
