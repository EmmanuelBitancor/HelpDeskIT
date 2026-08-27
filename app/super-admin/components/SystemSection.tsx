"use client";

import { useState } from "react";
import MetricBar from "./MetricBar";
import type { SystemHealth } from "../types";

interface SystemSectionProps {
  health: SystemHealth;
}

export default function SystemSection({ health }: SystemSectionProps) {
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
                "Automatically assign new tickets to available support staff.",
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
