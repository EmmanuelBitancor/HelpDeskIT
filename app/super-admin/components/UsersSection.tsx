"use client";

import { useState, useMemo } from "react";
import { usePagination, Pagination } from "@/components/Pagination";
import { statusStyles, roleStyles } from "@/lib/styles";
import { formatDate } from "@/lib/utils";
import type { SystemUser, UserRole } from "../types";

interface UsersSectionProps {
  users: SystemUser[];
  onApproveUser: (id: string) => void;
  onToggleStatus: (id: string) => void;
  onEditRole: (id: string, role: UserRole) => void;
}

export default function UsersSection({ users, onApproveUser, onToggleStatus, onEditRole }: UsersSectionProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<UserRole>("user");

  const filtered = users.filter((u) => {
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.role === "superadmin" && b.role !== "superadmin") return -1;
      if (b.role === "superadmin" && a.role !== "superadmin") return 1;
      return 0;
    });
  }, [filtered]);

  const { paginatedItems: paginatedUsers, page: usersPage, totalPages: usersTotalPages, setPage: setUsersPage } = usePagination(sorted);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-4 text-sm text-foreground placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div className="flex items-center gap-2">
          {(["all", "superadmin", "admin", "support", "user"] as const).map(
            (r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
                  roleFilter === r
                    ? "bg-foreground text-background"
                    : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                {r}
              </button>
            )
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50">
                {["User", "Role", "Status", "Last Login", "Tickets", "Actions"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {paginatedUsers.map((u) => (
                <tr
                  key={u.id}
                  className={`transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40 ${
                    u.role === "superadmin" ? "bg-violet-50/50 dark:bg-violet-900/10" : ""
                  }`}
                >
                  <td className="px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {u.name}
                      </p>
                      <p className="text-xs text-zinc-400">{u.email}</p>
                      <p className="font-mono text-xs text-zinc-300 dark:text-zinc-600">
                        {u.id}
                      </p>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${roleStyles[u.role]}`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusStyles[u.status]}`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                    {formatDate(u.lastLogin)}
                  </td>
                  <td className="px-5 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                    {u.ticketCount}
                  </td>
                  <td className="px-5 py-3">
                    {u.role !== "superadmin" && (
                      <div className="flex items-center gap-2">
                        {u.status === "pending" && (
                          <button
                            onClick={() => onApproveUser(u.id)}
                            className="rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300"
                          >
                            Approve
                          </button>
                        )}
                        {u.status !== "pending" && (
                          <button
                            onClick={() => onToggleStatus(u.id)}
                            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                              u.status === "active"
                                ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
                                : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300"
                            }`}
                          >
                            {u.status === "active" ? "Suspend" : "Reinstate"}
                          </button>
                        )}
                        {editingUserId === u.id ? (
                          <select
                            value={editingRole}
                            onChange={(e) => setEditingRole(e.target.value as UserRole)}
                            onBlur={() => {
                              if (editingUserId) {
                                onEditRole(editingUserId, editingRole);
                                setEditingUserId(null);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                if (editingUserId) {
                                  onEditRole(editingUserId, editingRole);
                                  setEditingUserId(null);
                                }
                              }
                              if (e.key === "Escape") {
                                setEditingUserId(null);
                              }
                            }}
                            autoFocus
                            className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-foreground outline-none focus:border-foreground focus:ring-1 focus:ring-foreground dark:border-zinc-700 dark:bg-zinc-800"
                          >
                            <option value="user">User</option>
                            <option value="support">Support</option>
                            <option value="admin">Admin</option>
                            <option value="superadmin">Superadmin</option>
                          </select>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingUserId(u.id);
                              setEditingRole(u.role);
                            }}
                            className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                          >
                            Edit Role
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={usersPage} totalPages={usersTotalPages} onPageChange={setUsersPage} />
        </div>
        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
            <p className="text-sm">No users match your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
