-- HelpDeskIT (Supabase / PostgreSQL) — System logs
-- Mirrors app/super-admin/page.tsx → MOCK_LOGS

CREATE TABLE IF NOT EXISTS system_logs (
  id        text PRIMARY KEY,
  level     text NOT NULL CHECK (level IN ('info','warn','error','debug')),
  message   text NOT NULL,
  source    text NOT NULL,
  timestamp timestamptz NOT NULL,
  meta      text
);

INSERT INTO system_logs (id, level, message, source, timestamp, meta) VALUES
  ('LOG-001', 'error', 'Failed login attempt — invalid credentials', 'auth.service',         '2026-08-13 10:42:11', 'IP: 192.168.1.45 | user: unknown@attacker.com'),
  ('LOG-002', 'warn',  'DB query exceeded 500ms threshold',         'database.pool',        '2026-08-13 10:39:05', 'Query: SELECT * FROM tickets WHERE… | Duration: 712ms'),
  ('LOG-003', 'info',  'User USR-005 registered and pending approval', 'user.service',      '2026-08-13 10:35:22', NULL),
  ('LOG-004', 'info',  'Ticket TK-1003 escalated to critical',       'ticket.service',      '2026-08-13 10:28:00', NULL),
  ('LOG-005', 'error', 'Email notification delivery failed',         'notification.worker', '2026-08-13 10:15:44', 'SMTP error: Connection timed out | recipient: luis.gomez@company.com'),
  ('LOG-006', 'debug', 'Cache invalidated for ticket list view',     'cache.service',       '2026-08-13 10:10:01', NULL),
  ('LOG-007', 'info',  'Scheduled maintenance mode enabled',         'system.scheduler',    '2026-08-13 09:00:00', NULL);
