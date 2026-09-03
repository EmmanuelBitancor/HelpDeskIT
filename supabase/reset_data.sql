-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  HelpDeskIT — Full Database Reset                                  ║
-- ║  Run this in Supabase → SQL Editor to wipe ALL application data.   ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ─── Delete all data in safe order (child tables first) ────────────────
-- Using DELETE instead of TRUNCATE to avoid system trigger issues.

DELETE FROM public.messages;
DELETE FROM public.conversations;
DELETE FROM public.ticket_history;
DELETE FROM public.activity_logs;
DELETE FROM public.system_logs;
DELETE FROM public.system_health;
DELETE FROM public.tickets;
DELETE FROM public.support_staff;
DELETE FROM public.accounts;

-- ─── Reset sequences so new IDs start from 1 ───────────────────────────
ALTER SEQUENCE IF EXISTS public.accounts_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.tickets_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.support_staff_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.activity_logs_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.system_logs_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.system_health_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.ticket_history_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.conversations_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.messages_id_seq RESTART WITH 1;

-- ─── Done ───────────────────────────────────────────────────────────────
DO $$ BEGIN RAISE NOTICE 'All HelpDeskIT data has been wiped.'; END $$;
