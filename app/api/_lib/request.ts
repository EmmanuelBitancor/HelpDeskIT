import { NextRequest } from "next/server";

/**
 * Safely parse a JSON request body.
 * Returns { ok, data, error } so callers can handle malformed JSON
 * without wrapping every route in try/catch just for parsing.
 */
export async function parseJsonBody<T = unknown>(
  request: NextRequest,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const data = (await request.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Invalid JSON body" };
  }
}

/**
 * Extract the client IP from trusted headers.
 * Falls back to cf-connecting-ip, then "anonymous".
 * Does NOT trust x-forwarded-for unless TRUSTED_PROXY_HOPS is set,
 * to prevent IP spoofing.
 */
export function getClientIp(request: NextRequest): string {
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

/**
 * Extract and sanitize a string query parameter.
 * Returns null if missing or not a string.
 */
export function getQueryParam(
  searchParams: URLSearchParams,
  name: string,
  maxLength = 500,
): string | null {
  const value = searchParams.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > maxLength) return null;
  return trimmed;
}

/**
 * Validate an email string. Returns the normalized email or null.
 */
export function validateEmail(email: unknown, maxLength = 254): string | null {
  if (typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.length > maxLength) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Clamp a string value to a max length, returning null if invalid.
 */
export function boundedString(value: unknown, maxLength = 500): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, maxLength);
}
