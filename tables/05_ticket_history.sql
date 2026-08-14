-- HelpDeskIT — Ticket activity history
-- Mirrors the `history` arrays inside tickets TK-1002 and TK-1007 (app/support/page.tsx)

CREATE TABLE IF NOT EXISTS `ticket_history` (
  `id`         VARCHAR(30)  NOT NULL,
  `ticket_id`  VARCHAR(20)  NOT NULL,
  `status`     ENUM('open','in_progress','resolved','closed') NOT NULL,
  `note`       TEXT,
  `by`         VARCHAR(20)  DEFAULT NULL,
  `at`         DATETIME     NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ticket_history_ticket_id` (`ticket_id`),
  CONSTRAINT `fk_ticket_history_ticket`
    FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `ticket_history` (`id`, `ticket_id`, `status`, `note`, `by`, `at`) VALUES
  ('h-1', 'TK-1002', 'in_progress', 'Verified license availability and began procurement.', 'staff-1', '2026-08-12 11:00:00'),
  ('h-2', 'TK-1007', 'in_progress', 'Escalated to directory services for ACL review.',    'staff-2', '2026-08-12 09:00:00');
