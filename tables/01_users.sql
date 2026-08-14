-- HelpDeskIT — Managed users (superadmin "Users" console)
-- Mirrors app/super-admin/page.tsx → MOCK_USERS

CREATE TABLE IF NOT EXISTS `users` (
  `id`           VARCHAR(20)   NOT NULL,
  `name`         VARCHAR(100)  NOT NULL,
  `email`        VARCHAR(150)  NOT NULL,
  `role`         ENUM('user','agent','admin','superadmin') NOT NULL,
  `status`       ENUM('active','suspended','pending') NOT NULL DEFAULT 'active',
  `created_at`   DATE          NOT NULL,
  `last_login`   VARCHAR(20)   DEFAULT NULL,
  `ticket_count` INT           NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `users` (`id`, `name`, `email`, `role`, `status`, `created_at`, `last_login`, `ticket_count`) VALUES
  ('USR-001', 'Maria Santos',   'maria.santos@company.com',  'admin',     'active',   '2024-01-15', '2026-08-13', 0),
  ('USR-002', 'Jose Reyes',     'jose.reyes@company.com',    'agent',     'active',   '2024-03-20', '2026-08-12', 42),
  ('USR-003', 'Ana Cruz',       'ana.cruz@company.com',       'user',      'active',   '2024-06-01', '2026-08-10', 7),
  ('USR-004', 'Luis Gomez',     'luis.gomez@company.com',     'agent',     'suspended','2024-02-10', '2026-07-28', 18),
  ('USR-005', 'Elena Torres',   'elena.torres@company.com',   'user',      'pending',  '2026-08-12', '—',          0),
  ('USR-006', 'Carlos Ramos',   'carlos.ramos@company.com',   'user',      'active',   '2025-01-05', '2026-08-13', 3);
