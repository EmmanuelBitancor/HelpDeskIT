# ============================================================================
# VERCEL DEPLOYMENT GUIDE — HelpDeskIT
# ============================================================================

This document covers the steps to deploy HelpDeskIT to Vercel for **test/staging**.

## 1. Prerequisites
- Vercel account: https://vercel.com/signup
- A Supabase project (the test instance can use the project referenced in `.env.local`)
- A Gmail account with an App Password (for SMTP) — already configured locally
- A Google Gemini API key (already configured locally)

## 2. Required Environment Variables
Set these in **Vercel → Project Settings → Environment Variables** (add for
`Production`, `Preview`, and `Development`):

| Name | Value | Notes |
|------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` | Public anon-safe |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<anon-key>` | Public anon-safe |
| `SUPABASE_SERVICE_ROLE_KEY` | `<service-role-key>` | **Secret** — server-only |
| `NEXT_PUBLIC_SITE_URL` | `https://<your-app>.vercel.app` | Used in email links |
| `GEMINI_API_KEY_CHATBOT` | `<gemini-key>` | Server-only |
| `SMTP_HOST` | `smtp.gmail.com` | |
| `SMTP_PORT` | `587` | |
| `SMTP_USER` | `<gmail-address>` | |
| `SMTP_PASS` | `<gmail-app-password>` | **Secret** — use App Password, not account password |
| `SMTP_FROM` | `HelpDeskIT <noreply@yourdomain.com>` | Friendly sender |
| `TRUSTED_PROXY_HOPS` | `1` | **Required on Vercel** so rate limiting reads the real client IP from `x-forwarded-for` |

### Notes
- Do **not** commit `.env.local` to Git. Vercel reads the values you set in the
  dashboard, not from your repo.
- For a custom domain, also set `NEXT_PUBLIC_SITE_URL` to the production URL so
  password-reset and OTP emails point to the right host.
- Vercel provides `VERCEL_URL` automatically; `NEXT_PUBLIC_SITE_URL` overrides
  it for explicit control.

## 3. Deploy from the Vercel Dashboard
1. Push the branch you want to deploy (`dev` for the test environment).
2. In Vercel, click **Add New… → Project** and import the GitHub repository.
3. Vercel auto-detects Next.js 16. The build command is `npm run build`.
4. Confirm **Root Directory** is the repo root.
5. Paste all environment variables from the table above.
6. Click **Deploy**. The first build takes ~1–2 minutes.

## 4. Deploy via the Vercel CLI (optional)
```bash
# Install
npm i -g vercel

# Login
vercel login

# First-time setup (follow the prompts)
vercel

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

To set environment variables via CLI:
```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# …repeat for each variable
```

## 5. Supabase Configuration (one-time per environment)
After each deploy, in the Supabase dashboard:
- **Authentication → URL Configuration**
  - Site URL: `https://<your-app>.vercel.app`
  - Redirect URLs: add `https://<your-app>.vercel.app/**`
- **Database → SQL Editor** — run every migration file in
  `supabase/migrations/` in numerical order (`0001_init.sql` first, etc.).
- **Authentication → Providers** — keep Email enabled; disable anything you
  do not use.

## 6. What Was Changed for Vercel
- **`next.config.ts`**: replaced the legacy `webpack` config (incompatible with
  Next 16's Turbopack default) with an empty `turbopack: {}` entry. Kept
  `reactCompiler: true` for production minification.
- **`vercel.json`** *(new)*: adds baseline security headers, CORS headers for
  API routes, pins the deployment region to `iad1` (US East), and sets the
  image `remotePatterns` to an empty array for explicit allow-listing.
- **`app/api/chatbot/route.ts`**: adds `export const maxDuration = 30` so the
  Gemini AI fallback matrix (up to ~25s) completes before Vercel's default
  10s timeout.
- **`.env.example`**: documents all required variables including the new
  `TRUSTED_PROXY_HOPS` setting needed for correct rate-limiting on Vercel.

## 7. Caveats for a Test Environment
- The in-memory rate limiter in `proxy.ts` and `app/api/_lib/ratelimit.ts`
  does **not** share state across serverless instances. For a multi-instance
  production deployment, wire `@upstash/ratelimit` (already a dependency) to
  Upstash Redis. The README mentions the same caveat.
- The `proxy.ts` middleware runs on every request — keep the in-memory map
  bounded to avoid memory growth (already capped at 1000 entries in the
  API helper).
- The Gemini chatbot fallback matrix can run up to 25 seconds.
  `export const maxDuration = 30` in `app/api/chatbot/route.ts` prevents
  Vercel's 10s default timeout from cutting it off.
- **Anonymous forgot-password flow**: `app/api/forgot-password/route.ts` and
  `app/api/password-reset-request/route.ts` now query the `accounts` table
  using the Supabase service role key. The original code used the anon-key
  Supabase client, but RLS (enabled in migration 0001) only allows
  `authenticated` callers to read the table — anonymous requests on the
  public forgot-password endpoint would silently return "no account found",
  so the reset email was never sent.

## 8. Smoke Test After Deploy
1. Visit `/login` and sign in with a seeded account.
2. Open `/dashboard` and create a ticket.
3. Trigger an OTP signup to confirm the SMTP credentials work.
4. Hit `/api/chatbot` once to confirm the Gemini key is wired.
5. Check Vercel's **Runtime Logs** for any 4xx/5xx responses.
