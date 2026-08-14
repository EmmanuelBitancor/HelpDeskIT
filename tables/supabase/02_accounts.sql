-- HelpDeskIT (Supabase / PostgreSQL) — Login accounts
-- Mirrors context/AuthContext.tsx → ACCOUNTS

CREATE TABLE IF NOT EXISTS accounts (
  id       text PRIMARY KEY,
  name     text NOT NULL,
  email    text NOT NULL UNIQUE,
  role     text NOT NULL CHECK (role IN ('user','support','admin','superadmin')),
  avatar   text NOT NULL,
  password text NOT NULL
);

INSERT INTO accounts (id, name, email, role, avatar, password) VALUES
  ('u-1',  'Alex Johnson',   'user@company.com',        'user',      'AJ', 'password'),
  ('s-1',  'Sarah Chen',     'sarah.chen@company.com',  'support',   'SC', 'password'),
  ('s-2',  'Marcus Johnson', 'marcus.j@company.com',    'support',   'MJ', 'password'),
  ('s-3',  'Emily Rodriguez','emily.r@company.com',     'support',   'ER', 'password'),
  ('s-4',  'David Kim',      'david.kim@company.com',   'support',   'DK', 'password'),
  ('a-1',  'Admin User',     'admin@company.com',       'admin',     'AU', 'password'),
  ('sa-1', 'Super Admin',    'superadmin@company.com',  'superadmin','SA', 'password');
