-- HelpDeskIT — Support staff (admin & support consoles)
-- Mirrors app/admin/page.tsx & app/support/page.tsx → initialSupportStaff

CREATE TABLE IF NOT EXISTS `support_staff` (
  `id`     VARCHAR(20)  NOT NULL,
  `name`   VARCHAR(100) NOT NULL,
  `email`  VARCHAR(150) NOT NULL,
  `role`   VARCHAR(100) NOT NULL,
  `avatar` VARCHAR(10)  NOT NULL,
  `active` TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_support_staff_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `support_staff` (`id`, `name`, `email`, `role`, `avatar`, `active`) VALUES
  ('staff-1', 'Sarah Chen',     'sarah.chen@company.com', 'Senior IT Support',        'SC', 1),
  ('staff-2', 'Marcus Johnson', 'marcus.j@company.com',   'IT Support Specialist',    'MJ', 1),
  ('staff-3', 'Emily Rodriguez','emily.r@company.com',    'Network Administrator',    'ER', 1),
  ('staff-4', 'David Kim',      'david.kim@company.com',  'Hardware Support',         'DK', 1);
