-- HelpDeskIT (Supabase / PostgreSQL) — System health snapshot
-- Mirrors app/super-admin/page.tsx → MOCK_HEALTH

CREATE TABLE IF NOT EXISTS system_health (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cpu                integer NOT NULL,
  memory             integer NOT NULL,
  db_latency         integer NOT NULL,
  api_response_time  integer NOT NULL,
  uptime             text NOT NULL,
  active_connections integer NOT NULL,
  error_rate         numeric(5,2) NOT NULL,
  queue_depth        integer NOT NULL,
  recorded_at        timestamptz NOT NULL
);

INSERT INTO system_health (cpu, memory, db_latency, api_response_time, uptime, active_connections, error_rate, queue_depth, recorded_at) VALUES
  (34, 61, 48, 142, '14d 6h 22m', 27, 0.80, 3, '2026-08-13 10:45:00');
