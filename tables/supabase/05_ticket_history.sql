-- HelpDeskIT (Supabase / PostgreSQL) — Ticket activity history
-- Mirrors the `history` arrays inside tickets TK-1002 and TK-1007

CREATE TABLE IF NOT EXISTS ticket_history (
  id         text PRIMARY KEY,
  ticket_id  text NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  status     text NOT NULL CHECK (status IN ('open','in_progress','resolved','closed')),
  note       text,
  by         text REFERENCES support_staff(id),
  at         timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_history_ticket_id ON ticket_history(ticket_id);

INSERT INTO ticket_history (id, ticket_id, status, note, by, at) VALUES
  ('h-1', 'TK-1002', 'in_progress', 'Verified license availability and began procurement.', 'staff-1', '2026-08-12 11:00:00'),
  ('h-2', 'TK-1007', 'in_progress', 'Escalated to directory services for ACL review.',     'staff-2', '2026-08-12 09:00:00');
