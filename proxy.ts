import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// ------------------------------------------------------------------------------
// Rate limiting
// ------------------------------------------------------------------------------
// Uses in-memory sliding window. Effective for single-instance deployments
// (Docker, VPS, etc.). For serverless platforms with multiple instances,
// consider adding a distributed backend like Upstash Redis.
// ------------------------------------------------------------------------------

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 100;

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

async function checkRateLimit(ip: string): Promise<boolean> {
  if (memoryIsRateLimited(ip)) return false;
  memoryRecordRequest(ip);
  return true;
}

async function updateSupabaseSession(request: NextRequest) {
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
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  await supabase.auth.getUser();
  return response;
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

  return updateSupabaseSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
