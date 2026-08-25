import { useState, useEffect, useCallback, useRef } from "react";
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

  const fetchRef = useRef(fetchFn);
  const requestIdRef = useRef(0);

  useEffect(() => {
    fetchRef.current = fetchFn;
  }, [fetchFn]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchRef.current();
      if (requestId !== requestIdRef.current) return;
      setData(result);
      setCachedData(key, result, ttl);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      const message = err instanceof Error ? err.message : "Failed to load data";
      setError(message);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [key, ttl, enabled]);

  useEffect(() => () => {
    requestIdRef.current++;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const cached = getCachedData<T>(key);
    if (cached?.data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate cache on mount
      setData(cached.data);
    }
    refresh();
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
