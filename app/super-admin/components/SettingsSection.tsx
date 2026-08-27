"use client";

import { useState } from "react";

interface SettingsSectionProps {
  user: { name: string; email: string };
  onOpenProfile: () => void;
}

export default function SettingsSection({ user, onOpenProfile }: SettingsSectionProps) {
  const [siteName, setSiteName] = useState("HelpDeskIT");
  const [maxTickets, setMaxTickets] = useState("10");
  const [sessionTimeout, setSessionTimeout] = useState("60");

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-foreground">
            Profile Settings
          </h2>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
            <div>
              <p className="text-sm font-medium text-foreground">{user.name}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{user.email}</p>
            </div>
            <button
              onClick={onOpenProfile}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Edit Profile
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-foreground">
            General Settings
          </h2>
        </div>
        <div className="space-y-5 p-5">
          {[
            {
              label: "Site Name",
              value: siteName,
              setter: setSiteName,
              type: "text",
            },
            {
              label: "Max Tickets per User",
              value: maxTickets,
              setter: setMaxTickets,
              type: "number",
            },
            {
              label: "Session Timeout (minutes)",
              value: sessionTimeout,
              setter: setSessionTimeout,
              type: "number",
            },
          ].map(({ label, value, setter, type }) => (
            <div key={label} className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {label}
              </label>
              <input
                type={type}
                value={value}
                onChange={(e) => setter(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          ))}
          <button className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:opacity-90">
            Save Changes
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-xl border border-red-200 bg-white dark:border-red-900/50 dark:bg-zinc-900">
        <div className="border-b border-red-200 px-5 py-4 dark:border-red-900/50">
          <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">
            Danger Zone
          </h2>
        </div>
        <div className="space-y-4 p-5">
          {[
            {
              label: "Purge All Closed Tickets",
              desc: "Permanently delete all tickets with status 'closed'. This cannot be undone.",
            },
            {
              label: "Reset All User Passwords",
              desc: "Force all users to reset their passwords on next login.",
            },
            {
              label: "Wipe Knowledge Base",
              desc: "Delete all knowledge base articles. This cannot be undone.",
            },
          ].map(({ label, desc }) => (
            <div
              key={label}
              className="flex flex-col gap-3 rounded-lg border border-red-100 p-4 dark:border-red-900/30 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{desc}</p>
              </div>
              <button
                className="shrink-0 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                disabled
                title="Coming soon"
              >
                {label.split(" ").slice(0, 2).join(" ")}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
