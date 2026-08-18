import { useState, useEffect, useCallback } from "react";

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

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setCounts({
          unreadMessages: data.unreadMessages || 0,
          pendingUsers: data.pendingUsers || 0,
          systemErrors: data.systemErrors || 0,
          recentActivities: data.recentActivities || 0,
        });
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCounts();
    const interval = setInterval(fetchCounts, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchCounts, refreshInterval]);

  return { ...counts, loading, refresh: fetchCounts };
}
