-- HelpDeskIT (Supabase / PostgreSQL) — Support staff
-- Mirrors app/admin/page.tsx & app/support/page.tsx → initialSupportStaff

CREATE TABLE IF NOT EXISTS support_staff (
  id     text PRIMARY KEY,
  name   text NOT NULL,
  email  text NOT NULL UNIQUE,
  role   text NOT NULL,
  avatar text NOT NULL,
  active boolean NOT NULL DEFAULT true
);

INSERT INTO support_staff (id, name, email, role, avatar, active) VALUES
  ('staff-1', 'Sarah Chen',     'sarah.chen@company.com', 'Senior IT Support',     'SC', true),
  ('staff-2', 'Marcus Johnson', 'marcus.j@company.com',   'IT Support Specialist', 'MJ', true),
  ('staff-3', 'Emily Rodriguez','emily.r@company.com',    'Network Administrator', 'ER', true),
  ('staff-4', 'David Kim',      'david.kim@company.com',  'Hardware Support',      'DK', true);
