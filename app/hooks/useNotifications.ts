import { useState, useEffect, useCallback, useRef } from "react";

export interface NotificationCounts {
  unreadMessages: number;
  pendingUsers: number;
  systemErrors: number;
  recentActivities: number;
}

export function useNotifications(refreshInterval = 30000) {
  const [counts, setCounts] = useState<NotificationCounts>({
    unreadMessages: 0,
    pendingUsers: 0,
    systemErrors: 0,
    recentActivities: 0,
  });
  const [loading, setLoading] = useState(true);

  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const fetchCounts = useCallback(async () => {
    // Cancel any in-flight request so its response cannot overwrite newer data.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;

    try {
      const res = await fetch("/api/notifications", { signal: controller.signal });
      if (res.ok) {
        const data = await res.json();
        // Stale-response guard: ignore responses from superseded requests.
        if (requestId !== requestIdRef.current) return;
        setCounts({
          unreadMessages: data.unreadMessages || 0,
          pendingUsers: data.pendingUsers || 0,
          systemErrors: data.systemErrors || 0,
          recentActivities: data.recentActivities || 0,
        });
      }
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      // ignore
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCounts();
    const interval = setInterval(fetchCounts, refreshInterval);
    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
      // Bump the request id on unmount so any in-flight response is discarded.
      requestIdRef.current++;
    };
  }, [fetchCounts, refreshInterval]);

  return { ...counts, loading, refresh: fetchCounts };
}
