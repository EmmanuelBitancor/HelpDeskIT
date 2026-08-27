import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/email-templates";
import { requireAuth } from "@/app/api/_lib/auth";
import { validateEmail } from "@/app/api/_lib/request";

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;

    const forbidden = requireAdmin(authResult.account);
    if (forbidden) return forbidden;

    const serviceRole = serviceRoleHeaders();
    if (!serviceRole) {
      console.error("Users misconfigured: missing service role");
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const accountsRes = await fetch(`${serviceRole.url}/rest/v1/accounts?select=*`, {
      method: "GET",
      headers: serviceRole.headers,
    });

    if (!accountsRes.ok) {
      const accountsError = await accountsRes.text();
      console.error("Supabase accounts error:", accountsError);
      return NextResponse.json(
        { error: "Failed to fetch account records" },
        { status: 500 },
      );
    }

    const accountsData = await accountsRes.json();

    const allUsers: Record<string, unknown>[] = [];
    let page = 1;
    const perPage = 100;
    const MAX_PAGES = 100;

    while (page <= MAX_PAGES) {
      const authRes = await fetch(
        `${serviceRole.url}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
        {
          method: "GET",
          headers: serviceRole.headers,
        },
      );

      if (!authRes.ok) {
        const authError = await authRes.text();
        console.error("Supabase auth error:", authError);
        return NextResponse.json(
          { error: "Failed to fetch users from authentication" },
          { status: 500 },
        );
      }

      const authData = await authRes.json();
      const usersOnPage = authData.users || [];

      if (usersOnPage.length === 0) break;

      allUsers.push(...usersOnPage);

      if (usersOnPage.length < perPage) break;

      page++;
    }

    if (page > MAX_PAGES) {
      console.error("User fetch exceeded max pages");
      return NextResponse.json(
        { error: "Too many users to fetch" },
        { status: 500 },
      );
    }

    const accountsByEmail = new Map(
      (accountsData || [])
        .filter((acc: Record<string, unknown>) => acc.email != null)
        .map((acc: Record<string, unknown>) => [
          String(acc.email).toLowerCase(),
          acc,
        ]),
    );

    const users = (allUsers || []).map((authUser: Record<string, unknown>) => {
      const email = String(authUser.email || "").toLowerCase();
      const account = accountsByEmail.get(email) as Record<string, unknown> | undefined;
      const metadata = (authUser.user_metadata as Record<string, unknown>) || {};

      return {
        id: String(authUser.id),
        email,
        name: String((account?.name as string) || (metadata.name as string) || authUser.email || ""),
        role: String((account?.role as string) || (metadata.role as string) || "user"),
        status: String((account?.status as string) || "active"),
        avatar: String((account?.avatar as string) || (metadata.avatar as string) || "?"),
        createdAt: String(authUser.created_at || ""),
        lastLogin: authUser.last_sign_in_at ? String(authUser.last_sign_in_at) : "—",
        ticketCount: 0,
      };
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("List users error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;

    const forbidden = requireAdmin(authResult.account);
    if (forbidden) return forbidden;

    const serviceRole = serviceRoleHeaders();
    if (!serviceRole) {
      console.error("Users misconfigured: missing service role");
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const bodyResult = await parseJsonBody<{ name: unknown; email: unknown; password: unknown }>(request);
    if (!bodyResult.ok) return NextResponse.json({ error: bodyResult.error }, { status: 400 });

    const { name, email, password } = bodyResult.data;

    if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { error: "Name, email, and password must be strings" },
        { status: 400 },
      );
    }

    const trimmedName = name.trim();
    const trimmedEmail = validateEmail(email);
    if (!trimmedName || !trimmedEmail) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 },
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const authRes = await fetch(`${serviceRole.url}/auth/v1/admin/users`, {
      method: "POST",
      headers: serviceRole.headers,
      body: JSON.stringify({
        email: trimmedEmail,
        password,
        email_confirm: true,
        user_metadata: { name: trimmedName, role: "user" },
      }),
    });

    const authData = await authRes.json();

    if (!authRes.ok) {
      console.error("Supabase auth error:", authData);
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 },
      );
    }

    const userId = authData.id || authData.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Failed to create user: missing user id" },
        { status: 500 },
      );
    }

    const initials = trimmedName
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    const dbRes = await fetch(`${serviceRole.url}/rest/v1/accounts`, {
      method: "POST",
      headers: serviceRole.headers,
      body: JSON.stringify({
        id: crypto.randomUUID(),
        user_id: userId,
        name: trimmedName,
        email: trimmedEmail,
        role: "user",
        status: "active",
        avatar: initials || "U",
      }),
    });

    if (!dbRes.ok) {
      const dbError = await dbRes.text();
      console.error("Failed to create account:", dbError);

      const { error: deleteError } = await fetch(
        `${serviceRole.url}/auth/v1/admin/users/${userId}`,
        {
          method: "DELETE",
          headers: serviceRole.headers,
        },
      ).then((res) => {
        if (!res.ok) {
          return res.text().then((text) => ({ error: new Error(text) }));
        }
        return { error: null as Error | null };
      });

      if (deleteError) {
        console.error("Failed to cleanup auth user after account creation failure:", deleteError);
      }

      return NextResponse.json(
        { error: "Failed to create user account" },
        { status: 400 },
      );
    }

    const templates = welcomeEmail({ name: trimmedName, email: trimmedEmail });
    sendEmail({
      to: trimmedEmail,
      subject: templates.subject,
      html: templates.html,
      text: templates.text,
    }).catch((err) => console.error("User welcome email failed:", err));

    return NextResponse.json({
      success: true,
      user: { id: userId, name: trimmedName, email: trimmedEmail, role: "user" },
    });
  } catch (error) {
    console.error("Add user error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function requireAdmin(account: { role: string }): NextResponse | null {
  if (account.role !== "admin" && account.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

function serviceRoleHeaders() {
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

async function parseJsonBody<T = unknown>(
  request: NextRequest,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const data = (await request.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Invalid JSON body" };
  }
}
