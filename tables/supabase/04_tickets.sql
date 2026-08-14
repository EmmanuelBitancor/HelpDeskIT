-- HelpDeskIT (Supabase / PostgreSQL) — Tickets
-- Mirrors app/support/page.tsx → initialTickets

CREATE TABLE IF NOT EXISTS tickets (
  id            text PRIMARY KEY,
  subject       text NOT NULL,
  category      text NOT NULL,
  priority      text NOT NULL CHECK (priority IN ('low','medium','high','critical')),
  status        text NOT NULL CHECK (status IN ('open','in_progress','resolved','closed')),
  description   text,
  submitted_by  text,
  assigned_to   text REFERENCES support_staff(id),
  created_at    timestamptz NOT NULL,
  updated_at    timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);

INSERT INTO tickets (id, subject, category, priority, status, description, submitted_by, assigned_to, created_at, updated_at) VALUES
  ('TK-1001', 'VPN connection dropping intermittently', 'Network', 'high',     'open',         'VPN drops every 15-20 minutes when working remotely.',                        'user@company.com',      'staff-3', '2026-08-12 09:30:00', '2026-08-13 08:15:00'),
  ('TK-1002', 'Request for Adobe Creative Cloud license', 'Software', 'medium', 'in_progress', 'Need Adobe CC for the design team.',                                         'design.team@company.com','staff-1', '2026-08-10 14:20:00', '2026-08-12 11:00:00'),
  ('TK-1003', 'Laptop screen flickering after update',    'Hardware', 'critical', 'open',      'Screen flickers on boot after Windows update.',                             'user@company.com',      'staff-4', '2026-08-13 07:45:00', '2026-08-13 07:45:00'),
  ('TK-1006', 'New employee onboarding - equipment request', 'Hardware', 'high', 'open',      'Need laptop, monitor, and keyboard for new hire starting next Monday.',    'hr@company.com',        'staff-1', '2026-08-13 10:00:00', '2026-08-13 10:00:00'),
  ('TK-1007', 'Shared drive access permission error',      'Access',   'medium', 'in_progress', 'Unable to access the Marketing shared drive folder.',                      'marketing@company.com', 'staff-2', '2026-08-11 13:20:00', '2026-08-12 09:00:00'),
  ('TK-1008', 'Firewall blocking internal application',    'Network',  'critical', 'open',      'New firewall rules are blocking the internal inventory system.',           'warehouse@company.com', 'staff-3', '2026-08-13 11:30:00', '2026-08-13 11:30:00');
