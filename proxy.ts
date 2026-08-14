import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ------------------------------------------------------------------------------
// Rate limiting
// ------------------------------------------------------------------------------
// Production: distributed via Upstash Redis (works across all serverless
// instances). Configure these env vars in your hosting environment:
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN
//
// Local / fallback: in-memory sliding window so rate limiting still works
// without an external service.
// ------------------------------------------------------------------------------

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 100;

// In-memory fallback (local dev)
type MemoryEntry = { timestamps: number[] };
const memoryStore = new Map<string, MemoryEntry>();

function memoryCleanup() {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [ip, entry] of memoryStore) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) memoryStore.delete(ip);
  }
}

function memoryIsRateLimited(ip: string): boolean {
  memoryCleanup();
  const entry = memoryStore.get(ip);
  if (!entry) return false;
  return entry.timestamps.length >= MAX_REQUESTS;
}

function memoryRecordRequest(ip: string) {
  const entry = memoryStore.get(ip);
  if (!entry) {
    memoryStore.set(ip, { timestamps: [Date.now()] });
  } else {
    entry.timestamps.push(Date.now());
  }
}

// Distributed limiter (Upstash Redis) � only initialized if env vars exist
let ratelimit: Ratelimit | null = null;

function getRatelimit(): Ratelimit | null {
  if (ratelimit) return ratelimit;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  try {
    ratelimit = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(MAX_REQUESTS, `${WINDOW_MS / 1000} s`),
      prefix: "helpdeskit:ratelimit",
    });
    return ratelimit;
  } catch {
    return null;
  }
}

async function checkRateLimit(ip: string): Promise<boolean> {
  const limiter = getRatelimit();
  if (limiter) {
    try {
      const result = await limiter.limit(ip);
      return result.success;
    } catch (error) {
      console.error("Upstash rate limit check failed:", error);
      if (process.env.NODE_ENV !== "production") {
        if (memoryIsRateLimited(ip)) return false;
        memoryRecordRequest(ip);
        return true;
      }
      return true;
    }
  }

  if (process.env.NODE_ENV !== "production") {
    if (memoryIsRateLimited(ip)) return false;
    memoryRecordRequest(ip);
    return true;
  }

  console.error(
    "Rate limiting is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in production."
  );
  return true;
}

export async function proxy(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const allowed = await checkRateLimit(ip);
  if (!allowed) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": Math.ceil(WINDOW_MS / 1000).toString(),
      },
    });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh the auth session so Server Components see an up-to-date user.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Run on everything except static assets and image optimization.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
