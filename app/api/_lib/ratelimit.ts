import { NextRequest } from "next/server";

const RATE_LIMIT_REQUESTS = 5;
const RATE_LIMIT_WINDOW = 60_000;
const MAX_MEMORY_ENTRIES = 1000;

const memoryStore = new Map<string, { count: number; resetAt: number }>();

export function getClientIdentifier(request: NextRequest, fallbackUserId?: string): string {
  if (fallbackUserId) return fallbackUserId;

  // Only trust x-forwarded-for when an explicit trusted proxy is configured.
  // Without an explicit TRUSTED_PROXY_HOPS setting, client-supplied forwarding
  // headers are ignored to prevent IP spoofing and rate-limit bypass.
  const rawHops = process.env.TRUSTED_PROXY_HOPS;
  const parsedHops = rawHops !== undefined ? Number(rawHops) : NaN;
  const trustedHops = Number.isInteger(parsedHops) && parsedHops > 0 ? parsedHops : 0;

  let clientIp: string | undefined;
  if (trustedHops > 0) {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",").map((v) => v.trim()) ?? [];
    clientIp = forwarded.length >= trustedHops ? forwarded[forwarded.length - trustedHops] : undefined;
  }

  return clientIp || request.headers.get("cf-connecting-ip") || "anonymous";
}

export async function checkRateLimit(identifier: string, namespace = "default") {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (process.env.NODE_ENV === "production" && !(redisUrl && redisToken)) {
    throw new Error("Rate limit backend not configured");
  }

  if (redisUrl && redisToken) {
    const { Ratelimit } = await import("@upstash/ratelimit");
    const { Redis } = await import("@upstash/redis");

    const redis = new Redis({ url: redisUrl, token: redisToken });
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(RATE_LIMIT_REQUESTS, "1 m"),
      analytics: true,
    });

    const { success, remaining } = await ratelimit.limit(`${namespace}:${identifier}`);
    return { success, remaining };
  }

  const now = Date.now();
  const key = `${namespace}:${identifier}`;

  if (memoryStore.size >= MAX_MEMORY_ENTRIES) {
    let oldestKey: string | undefined;
    let oldestReset = Infinity;
    for (const [k, entry] of memoryStore.entries()) {
      if (now > entry.resetAt) {
        memoryStore.delete(k);
      } else if (entry.resetAt < oldestReset) {
        oldestReset = entry.resetAt;
        oldestKey = k;
      }
    }
    if (memoryStore.size >= MAX_MEMORY_ENTRIES && oldestKey) {
      memoryStore.delete(oldestKey);
    }
  }

  const entry = memoryStore.get(key);

  if (entry && now > entry.resetAt) {
    memoryStore.delete(key);
  }

  const current = memoryStore.get(key);

  if (!current) {
    memoryStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { success: true, remaining: RATE_LIMIT_REQUESTS - 1 };
  }

  if (current.count >= RATE_LIMIT_REQUESTS) {
    return { success: false, remaining: 0 };
  }

  current.count++;
  return { success: true, remaining: RATE_LIMIT_REQUESTS - current.count };
}
