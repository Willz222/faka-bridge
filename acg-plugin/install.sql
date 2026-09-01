-- 将 acg_ 替换为你的异次元数据库表前缀（默认通常是 acg_）。
CREATE TABLE IF NOT EXISTS `acg_next_bridge_event` (
  `event_id` varchar(96) NOT NULL,
  `nonce` varchar(96) NOT NULL,
  `order_id` int unsigned NOT NULL,
  `body_hash` char(64) NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`event_id`),
  UNIQUE KEY `next_bridge_nonce_unique` (`nonce`),
  KEY `next_bridge_order_idx` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
