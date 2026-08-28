import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Current authenticated user from the session cookie.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
}

/**
 * Account profile row linked to the authenticated user.
 */
export interface Account {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  status?: string;
}

/**
 * Supabase client type (resolved from the async createClient).
 */
export type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Result of requiring an authenticated session.
 */
export interface AuthResult {
  supabase: SupabaseClient;
  user: AuthenticatedUser;
  account: Account;
}

/**
 * Require an authenticated user and their account profile.
 * Returns 401 if not signed in, 404 if no account row exists.
 */
export async function requireAuth(): Promise<AuthResult | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: account, error } = await supabase
    .from("accounts")
    .select("id, name, email, role, avatar, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return {
    supabase,
    user: { id: user.id, email: user.email },
    account: account as Account,
  };
}

/**
 * Require the user to have one of the specified roles.
 * Returns 403 if the user's role is not in the allowed set.
 */
export function requireRole(
  account: Account,
  allowedRoles: string[],
): NextResponse | null {
  if (!allowedRoles.includes(account.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/**
 * Convenience: require admin or superadmin.
 */
export function requireAdmin(account: Account): NextResponse | null {
  return requireRole(account, ["admin", "superadmin"]);
}

/**
 * Headers for Supabase REST calls using the service role key.
 * Only call this from server-side code after verifying the caller
 * has permission to perform the privileged action.
 */
export function serviceRoleHeaders() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return null;
  }

  return {
    url: supabaseUrl,
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: "return=representation",
    },
  };
}

/**
 * Check that service role credentials are configured.
 * Returns a 500 response if missing.
 */
export function requireServiceRole(): NextResponse | null {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }
  return null;
}
