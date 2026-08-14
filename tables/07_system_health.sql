-- HelpDeskIT — System health snapshot
-- Mirrors app/super-admin/page.tsx → MOCK_HEALTH

CREATE TABLE IF NOT EXISTS `system_health` (
  `id`                 INT          NOT NULL AUTO_INCREMENT,
  `cpu`                INT          NOT NULL,
  `memory`             INT          NOT NULL,
  `db_latency`         INT          NOT NULL COMMENT 'ms',
  `api_response_time`  INT          NOT NULL COMMENT 'ms',
  `uptime`             VARCHAR(50)  NOT NULL,
  `active_connections` INT          NOT NULL,
  `error_rate`         DECIMAL(5,2) NOT NULL,
  `queue_depth`        INT          NOT NULL,
  `recorded_at`        DATETIME     NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `system_health` (`cpu`, `memory`, `db_latency`, `api_response_time`, `uptime`, `active_connections`, `error_rate`, `queue_depth`, `recorded_at`) VALUES
  (34, 61, 48, 142, '14d 6h 22m', 27, 0.80, 3, '2026-08-13 10:45:00');
