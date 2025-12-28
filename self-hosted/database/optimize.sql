-- =====================================================
-- DATABASE OPTIMIZATION - Run after initial setup
-- Adds performance indexes, webhook support tables, and optimizations
-- =====================================================

-- =====================================================
-- WEBHOOK SUPPORT TABLES
-- =====================================================

-- Webhook logs for debugging and rate limiting
CREATE TABLE IF NOT EXISTS `webhook_logs` (
  `id` CHAR(36) NOT NULL,
  `ip_address` VARCHAR(45) NOT NULL,
  `provider` VARCHAR(50) NOT NULL DEFAULT 'unknown',
  `status` ENUM('success', 'rejected', 'error') NOT NULL,
  `error_message` TEXT NULL,
  `email_id` CHAR(36) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `webhook_logs_ip_created_idx` (`ip_address`, `created_at`),
  KEY `webhook_logs_provider_idx` (`provider`),
  KEY `webhook_logs_status_idx` (`status`),
  KEY `webhook_logs_created_at_idx` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Real-time email notifications
CREATE TABLE IF NOT EXISTS `email_notifications` (
  `id` CHAR(36) NOT NULL,
  `temp_email_id` CHAR(36) NOT NULL,
  `email_id` CHAR(36) NOT NULL,
  `subject` VARCHAR(255) NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `email_notifications_temp_email_idx` (`temp_email_id`, `created_at`),
  KEY `email_notifications_created_at_idx` (`created_at`),
  CONSTRAINT `email_notifications_temp_email_fk` FOREIGN KEY (`temp_email_id`) 
    REFERENCES `temp_emails` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- PERFORMANCE INDEXES
-- =====================================================

-- Optimize temp_emails queries
CREATE INDEX IF NOT EXISTS `temp_emails_active_expires_idx` 
ON `temp_emails` (`is_active`, `expires_at`);

CREATE INDEX IF NOT EXISTS `temp_emails_email_active_idx` 
ON `temp_emails` (`email_address`, `is_active`);

CREATE INDEX IF NOT EXISTS `temp_emails_user_active_idx` 
ON `temp_emails` (`user_id`, `is_active`, `expires_at`);

-- Optimize received_emails queries
CREATE INDEX IF NOT EXISTS `received_emails_inbox_idx` 
ON `received_emails` (`temp_email_id`, `deleted_at`, `received_at` DESC);

CREATE INDEX IF NOT EXISTS `received_emails_unread_idx` 
ON `received_emails` (`temp_email_id`, `is_read`, `received_at` DESC);

CREATE INDEX IF NOT EXISTS `received_emails_starred_idx` 
ON `received_emails` (`temp_email_id`, `is_starred`, `received_at` DESC);

-- Composite index for filtered inbox queries
CREATE INDEX IF NOT EXISTS `received_emails_filter_idx` 
ON `received_emails` (`temp_email_id`, `is_read`, `is_starred`, `deleted_at`, `received_at` DESC);

-- Optimize sessions cleanup
CREATE INDEX IF NOT EXISTS `sessions_cleanup_idx` 
ON `sessions` (`expires_at`, `user_id`);

-- Optimize email stats
CREATE INDEX IF NOT EXISTS `email_stats_date_idx` 
ON `email_stats` (`date` DESC);

-- Optimize user lookups
CREATE INDEX IF NOT EXISTS `users_email_verified_idx` 
ON `users` (`email`, `email_verified`);

-- Optimize domains
CREATE INDEX IF NOT EXISTS `domains_active_premium_idx` 
ON `domains` (`is_active`, `is_premium`);

-- =====================================================
-- QUERY OPTIMIZATIONS - STORED PROCEDURES
-- =====================================================

-- Fast inbox fetch with pagination
DROP PROCEDURE IF EXISTS `get_inbox_fast`;
DELIMITER //
CREATE PROCEDURE `get_inbox_fast`(
  IN p_temp_email_id CHAR(36),
  IN p_limit INT,
  IN p_offset INT,
  IN p_filter VARCHAR(20)
)
BEGIN
  SELECT SQL_CALC_FOUND_ROWS
    id, temp_email_id, message_id,
    from_address, from_name, to_address, subject,
    has_attachments, attachment_count,
    is_read, is_starred, is_spam,
    received_at, read_at
  FROM received_emails
  WHERE temp_email_id = p_temp_email_id
    AND deleted_at IS NULL
    AND (
      p_filter = 'all' 
      OR (p_filter = 'unread' AND is_read = 0)
      OR (p_filter = 'starred' AND is_starred = 1)
    )
  ORDER BY received_at DESC
  LIMIT p_limit OFFSET p_offset;
  
  SELECT FOUND_ROWS() as total_count;
END //
DELIMITER ;

-- Fast email count
DROP PROCEDURE IF EXISTS `get_email_counts`;
DELIMITER //
CREATE PROCEDURE `get_email_counts`(
  IN p_temp_email_id CHAR(36)
)
BEGIN
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread,
    SUM(CASE WHEN is_starred = 1 THEN 1 ELSE 0 END) as starred
  FROM received_emails
  WHERE temp_email_id = p_temp_email_id
    AND deleted_at IS NULL;
END //
DELIMITER ;

-- Check for new emails since timestamp
DROP PROCEDURE IF EXISTS `check_new_emails`;
DELIMITER //
CREATE PROCEDURE `check_new_emails`(
  IN p_temp_email_id CHAR(36),
  IN p_since DATETIME
)
BEGIN
  SELECT 
    id, from_address, from_name, subject, received_at
  FROM received_emails
  WHERE temp_email_id = p_temp_email_id
    AND received_at > p_since
    AND deleted_at IS NULL
  ORDER BY received_at ASC;
END //
DELIMITER ;

-- =====================================================
-- TABLE OPTIMIZATIONS
-- =====================================================

-- Add covering columns for inbox list (avoids table lookups)
ALTER TABLE `received_emails` 
ADD COLUMN IF NOT EXISTS `preview_text` VARCHAR(200) NULL AFTER `subject`;

-- Trigger to auto-generate preview text
DROP TRIGGER IF EXISTS `received_emails_preview`;
DELIMITER //
CREATE TRIGGER `received_emails_preview`
BEFORE INSERT ON `received_emails`
FOR EACH ROW
BEGIN
  IF NEW.body_text IS NOT NULL AND NEW.preview_text IS NULL THEN
    SET NEW.preview_text = LEFT(REGEXP_REPLACE(NEW.body_text, '[\r\n\t]+', ' '), 200);
  END IF;
END //
DELIMITER ;

-- =====================================================
-- CLEANUP OPTIMIZATIONS
-- =====================================================

-- Efficient cleanup of old data
DROP PROCEDURE IF EXISTS `cleanup_old_data`;
DELIMITER //
CREATE PROCEDURE `cleanup_old_data`(
  IN p_days_emails INT,
  IN p_days_sessions INT,
  IN p_days_logs INT
)
BEGIN
  DECLARE deleted_emails INT DEFAULT 0;
  DECLARE deleted_sessions INT DEFAULT 0;
  DECLARE deleted_logs INT DEFAULT 0;
  
  -- Delete old emails (in batches to avoid locks)
  REPEAT
    DELETE FROM received_emails 
    WHERE (expires_at IS NOT NULL AND expires_at < NOW())
       OR (received_at < DATE_SUB(NOW(), INTERVAL p_days_emails DAY))
    LIMIT 1000;
    SET deleted_emails = deleted_emails + ROW_COUNT();
  UNTIL ROW_COUNT() = 0 END REPEAT;
  
  -- Delete expired sessions
  DELETE FROM sessions WHERE expires_at < NOW();
  SET deleted_sessions = ROW_COUNT();
  
  -- Delete old webhook logs
  DELETE FROM webhook_logs 
  WHERE created_at < DATE_SUB(NOW(), INTERVAL p_days_logs DAY);
  SET deleted_logs = ROW_COUNT();
  
  -- Delete old notifications
  DELETE FROM email_notifications 
  WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR);
  
  -- Delete expired temp emails
  DELETE FROM temp_emails 
  WHERE expires_at IS NOT NULL 
    AND expires_at < DATE_SUB(NOW(), INTERVAL 1 DAY);
    
  -- Optimize tables (run during low traffic)
  -- OPTIMIZE TABLE received_emails, temp_emails, sessions;
  
  SELECT deleted_emails as emails_deleted, 
         deleted_sessions as sessions_deleted,
         deleted_logs as logs_deleted;
END //
DELIMITER ;

-- =====================================================
-- ANALYTICS OPTIMIZATIONS
-- =====================================================

-- Summary stats view
CREATE OR REPLACE VIEW `v_email_stats_summary` AS
SELECT 
  COALESCE(SUM(emails_received), 0) as total_received,
  COALESCE(SUM(emails_sent), 0) as total_sent,
  COALESCE(SUM(emails_forwarded), 0) as total_forwarded,
  COALESCE(SUM(CASE WHEN date >= CURDATE() THEN emails_received ELSE 0 END), 0) as today_received,
  COALESCE(SUM(CASE WHEN date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN emails_received ELSE 0 END), 0) as week_received,
  COALESCE(SUM(CASE WHEN date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN emails_received ELSE 0 END), 0) as month_received
FROM email_stats;

-- Active users view
CREATE OR REPLACE VIEW `v_active_users` AS
SELECT 
  COUNT(DISTINCT CASE WHEN last_accessed_at >= DATE_SUB(NOW(), INTERVAL 1 DAY) THEN id END) as daily_active,
  COUNT(DISTINCT CASE WHEN last_accessed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN id END) as weekly_active,
  COUNT(DISTINCT CASE WHEN last_accessed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN id END) as monthly_active,
  COUNT(*) as total_emails
FROM temp_emails
WHERE is_active = 1;

-- =====================================================
-- PARTITIONING (for very large deployments)
-- =====================================================

-- Note: Uncomment and modify if you have millions of emails
-- This requires MySQL 8.0+ and table recreation

/*
ALTER TABLE received_emails
PARTITION BY RANGE (TO_DAYS(received_at)) (
  PARTITION p_old VALUES LESS THAN (TO_DAYS('2024-01-01')),
  PARTITION p_2024_q1 VALUES LESS THAN (TO_DAYS('2024-04-01')),
  PARTITION p_2024_q2 VALUES LESS THAN (TO_DAYS('2024-07-01')),
  PARTITION p_2024_q3 VALUES LESS THAN (TO_DAYS('2024-10-01')),
  PARTITION p_2024_q4 VALUES LESS THAN (TO_DAYS('2025-01-01')),
  PARTITION p_2025_q1 VALUES LESS THAN (TO_DAYS('2025-04-01')),
  PARTITION p_future VALUES LESS THAN MAXVALUE
);
*/

-- =====================================================
-- MAINTENANCE EVENT (auto cleanup)
-- =====================================================

-- Enable event scheduler if not already enabled
-- SET GLOBAL event_scheduler = ON;

DROP EVENT IF EXISTS `cleanup_event`;
DELIMITER //
CREATE EVENT `cleanup_event`
ON SCHEDULE EVERY 1 HOUR
DO
BEGIN
  -- Clean old notifications
  DELETE FROM email_notifications 
  WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR);
  
  -- Clean old webhook logs (keep 7 days)
  DELETE FROM webhook_logs 
  WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
  LIMIT 10000;
END //
DELIMITER ;

-- =====================================================
-- GRANT PERMISSIONS (if using limited user)
-- =====================================================

-- GRANT EXECUTE ON PROCEDURE temp_email.get_inbox_fast TO 'webapp'@'%';
-- GRANT EXECUTE ON PROCEDURE temp_email.get_email_counts TO 'webapp'@'%';
-- GRANT EXECUTE ON PROCEDURE temp_email.check_new_emails TO 'webapp'@'%';
-- GRANT EXECUTE ON PROCEDURE temp_email.cleanup_old_data TO 'webapp'@'%';

-- =====================================================
-- FINAL OPTIMIZATIONS
-- =====================================================

-- Update table stats for query optimizer
ANALYZE TABLE temp_emails, received_emails, users, sessions, domains;

SELECT 'Database optimization complete!' as status;
