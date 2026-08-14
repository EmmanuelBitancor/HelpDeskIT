# HelpDeskIT

IT help desk application built with Next.js and Supabase.

## Prerequisites

- Node.js >= 18
- npm, pnpm, or yarn
- A Supabase project

## Environment Variables

Create a `.env` file from `.env.example` and fill in your Supabase project credentials.

```bash
cp .env.example .env
```

Required variables (sources: `lib/supabase/client.ts`, `lib/supabase/server.ts`):

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (Project Settings → API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key (Project Settings → API) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL for rate limiting (optional, falls back to in-memory) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token for rate limiting (optional) |

## Database Setup

1. Open your Supabase project dashboard.
2. Go to **SQL Editor**.
3. Run the migration:

```sql
-- Paste contents of supabase/migrations/0001_init.sql
```

This creates the tables, indexes, RLS policies, and the auto-profile trigger for new sign-ups.

4. Seed demo application data:

```sql
-- Paste contents of supabase/seed/seed_demo_data.sql
```

5. Create auth users in the Supabase Dashboard:

- Go to **Authentication → Users → Add user**
- Create each account with a unique password and toggle **Auto Confirm User** ON
- These demo accounts are for local development only; do not reuse these passwords in production

| Email | Role | Notes |
|---|---|---|
| `user@company.com` | user | Local demo account |
| `sarah.chen@company.com` | support | Local demo account |
| `marcus.j@company.com` | support | Local demo account |
| `emily.r@company.com` | support | Local demo account |
| `david.kim@company.com` | support | Local demo account |
| `admin@company.com` | admin | Local demo account |
| `superadmin@company.com` | superadmin | Local demo account |

New sign-ups automatically create an `accounts` row via the `handle_new_user` trigger, using `user_metadata.role` (defaults to `user`).

## Install and Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
