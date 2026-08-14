-- HelpDeskIT (Supabase / PostgreSQL) — Managed users
-- Mirrors app/super-admin/page.tsx → MOCK_USERS

CREATE TABLE IF NOT EXISTS users (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  email        text NOT NULL UNIQUE,
  role         text NOT NULL CHECK (role IN ('user','agent','admin','superadmin')),
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','pending')),
  created_at   date NOT NULL,
  last_login   text,
  ticket_count integer NOT NULL DEFAULT 0
);

INSERT INTO users (id, name, email, role, status, created_at, last_login, ticket_count) VALUES
  ('USR-001', 'Maria Santos',   'maria.santos@company.com',  'admin',     'active',   '2024-01-15', '2026-08-13', 0),
  ('USR-002', 'Jose Reyes',     'jose.reyes@company.com',    'agent',     'active',   '2024-03-20', '2026-08-12', 42),
  ('USR-003', 'Ana Cruz',       'ana.cruz@company.com',       'user',      'active',   '2024-06-01', '2026-08-10', 7),
  ('USR-004', 'Luis Gomez',     'luis.gomez@company.com',     'agent',     'suspended','2024-02-10', '2026-07-28', 18),
  ('USR-005', 'Elena Torres',   'elena.torres@company.com',   'user',      'pending',  '2026-08-12', '—',          0),
  ('USR-006', 'Carlos Ramos',   'carlos.ramos@company.com',   'user',      'active',   '2025-01-05', '2026-08-13', 3);
