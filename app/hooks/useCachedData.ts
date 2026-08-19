import { useState, useEffect, useCallback } from "react";
import { getCachedData, setCachedData, invalidateCache } from "@/lib/cache";

const DEFAULT_TTL = 5 * 60 * 1000;

export function useCachedData<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: { ttl?: number; enabled?: boolean } = {}
) {
  const { ttl = DEFAULT_TTL, enabled = true } = options;

  const [data, setData] = useState<T | null>(() => {
    if (!enabled || typeof window === "undefined") return null;
    const cached = getCachedData<T>(key);
    return cached?.data ?? null;
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      setData(result);
      setCachedData(key, result, ttl);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load data";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [fetchFn, key, ttl, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const cached = getCachedData<T>(key);
    if (cached?.data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate cache on mount
      setData(cached.data);
      refresh();
    } else {
      refresh();
    }
  }, [key, ttl, enabled, refresh]);

  return {
    data,
    loading,
    error,
    refresh,
    invalidate: () => {
      invalidateCache(key);
      refresh();
    },
  };
}
