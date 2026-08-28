type CacheEntry<T> = {
  data: T;
  timestamp: number;
  ttl: number;
};

const CACHE_PREFIX = "helpdesk_cache_";

export function getCachedData<T>(key: string): CacheEntry<T> | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;

    const entry = JSON.parse(raw) as CacheEntry<T>;
    const age = Date.now() - entry.timestamp;

    if (age > entry.ttl) {
      localStorage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }

    return entry;
  } catch {
    return null;
  }
}

export function setCachedData<T>(key: string, data: T, ttlMs: number): void {
  if (typeof window === "undefined") return;

  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    };
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
  } catch {
    // ignore storage errors
  }
}

export function invalidateCache(key?: string): void {
  if (typeof window === "undefined") return;

  if (key) {
    localStorage.removeItem(`${CACHE_PREFIX}${key}`);
    return;
  }

  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const storageKey = localStorage.key(i);
    if (storageKey?.startsWith(CACHE_PREFIX)) {
      keysToRemove.push(storageKey);
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}
