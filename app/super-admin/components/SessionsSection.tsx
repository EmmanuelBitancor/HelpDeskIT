"use client";

import { useState, useEffect } from "react";
import { usePagination, Pagination } from "@/components/Pagination";
import { Skeleton } from "@/components/skeleton";
import WeeklyReportButton from "@/components/WeeklyReportButton";

interface Session {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  user_role: string;
  device?: string;
  last_active: string;
  created_at: string;
}

export default function SessionsSection() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { paginatedItems: paginatedSessions, page: sessionsPage, totalPages: sessionsTotalPages, setPage: setSessionsPage } = usePagination(sessions);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/sessions");
        const data = await res.json();
        if (!res.ok) {
          if (active) setError(data.error || "We couldn't load the active sessions. Please check your connection and try again.");
          return;
        }
        if (active && data.sessions) setSessions(data.sessions);
      } catch {
        // ignore
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const revokeSession = async (sessionId: string) => {
    setRevoking(sessionId);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to revoke session");
        setRevoking(null);
        return;
      }
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch {
      // ignore
    } finally {
      setRevoking(null);
    }
  };

  const revokeAllUserSessions = async (userId: string) => {
    setRevokingAll(userId);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to revoke sessions");
        return;
      }
      setSessions((prev) => prev.filter((s) => s.user_id !== userId));
    } catch {
      // ignore
    } finally {
      setRevokingAll(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <WeeklyReportButton sessions={sessions} userRole="superadmin" />
      </div>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-foreground">
            Active Sessions
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Sessions stay active until the user logs out. You can revoke any session below.
          </p>
        </div>
        {error && (
          <div role="alert" className="px-5 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {loading ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="space-y-2 px-5 py-3">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-64" />
                  <Skeleton className="h-3 w-48" />
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-zinc-400">
              No active sessions found.
            </div>
          ) : (
            paginatedSessions.map((session) => (
              <div
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {session.user_name}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {session.user_email} · {session.user_role}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {session.device || "Unknown device"} · Last active{" "}
                    {new Date(session.last_active).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => revokeSession(session.id)}
                    disabled={revoking === session.id}
                    className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20 disabled:opacity-50"
                  >
                    {revoking === session.id ? "Revoking..." : "Revoke"}
                  </button>
                    <button
                      onClick={() => revokeAllUserSessions(session.user_id)}
                      disabled={revokingAll === session.user_id}
                      className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-50"
                    >
                      {revokingAll === session.user_id ? "Revoking..." : "Revoke All"}
                    </button>
                </div>
              </div>
            ))
          )}
        </div>
        <Pagination page={sessionsPage} totalPages={sessionsTotalPages} onPageChange={setSessionsPage} />
      </div>
    </div>
  );
}
