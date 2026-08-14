-- HelpDeskIT — Login accounts (auth)
-- Mirrors context/AuthContext.tsx → ACCOUNTS

CREATE TABLE IF NOT EXISTS `accounts` (
  `id`       VARCHAR(20)  NOT NULL,
  `name`     VARCHAR(100) NOT NULL,
  `email`    VARCHAR(150) NOT NULL,
  `role`     ENUM('user','support','admin','superadmin') NOT NULL,
  `avatar`   VARCHAR(10)  NOT NULL,
  `password` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_accounts_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `accounts` (`id`, `name`, `email`, `role`, `avatar`, `password`) VALUES
  ('u-1',  'Alex Johnson',   'user@company.com',        'user',      'AJ', 'password'),
  ('s-1',  'Sarah Chen',     'sarah.chen@company.com',  'support',   'SC', 'password'),
  ('s-2',  'Marcus Johnson', 'marcus.j@company.com',    'support',   'MJ', 'password'),
  ('s-3',  'Emily Rodriguez','emily.r@company.com',     'support',   'ER', 'password'),
  ('s-4',  'David Kim',      'david.kim@company.com',   'support',   'DK', 'password'),
  ('a-1',  'Admin User',     'admin@company.com',       'admin',     'AU', 'password'),
  ('sa-1', 'Super Admin',    'superadmin@company.com',  'superadmin','SA', 'password');
