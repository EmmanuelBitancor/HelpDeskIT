import { NextRequest } from "next/server";

const RATE_LIMIT_REQUESTS = 5;
const RATE_LIMIT_WINDOW = 60_000;
export const memoryStore = new Map<string, { count: number; resetAt: number }>();

export function getClientIdentifier(request: NextRequest, fallbackUserId?: string): string {
  if (fallbackUserId) return fallbackUserId;
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("cf-connecting-ip") ||
    "anonymous"
  );
}

export async function checkRateLimit(identifier: string) {
  const now = Date.now();

  for (const [key, value] of memoryStore) {
    if (now > value.resetAt) memoryStore.delete(key);
  }

  const entry = memoryStore.get(identifier);

  if (entry && now > entry.resetAt) {
    memoryStore.delete(identifier);
  }

  const current = memoryStore.get(identifier);

  if (!current) {
    memoryStore.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { success: true, remaining: RATE_LIMIT_REQUESTS - 1 };
  }

  if (current.count >= RATE_LIMIT_REQUESTS) {
    return { success: false, remaining: 0 };
  }

  current.count++;
  return { success: true, remaining: RATE_LIMIT_REQUESTS - current.count };
}
