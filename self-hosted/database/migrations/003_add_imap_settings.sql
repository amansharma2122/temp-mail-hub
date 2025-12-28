-- Migration: 003_add_imap_settings
-- Description: Add IMAP configuration to app_settings
-- Version: 1.0.2
-- Date: 2024-01-03

-- Add IMAP settings to app_settings
INSERT INTO `app_settings` (`id`, `key`, `value`, `value_type`, `category`, `is_public`, `created_at`, `updated_at`)
SELECT UUID(), 'imap_enabled', 'false', 'boolean', 'imap', 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `app_settings` WHERE `key` = 'imap_enabled');

INSERT INTO `app_settings` (`id`, `key`, `value`, `value_type`, `category`, `is_public`, `created_at`, `updated_at`)
SELECT UUID(), 'imap_host', '""', 'string', 'imap', 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `app_settings` WHERE `key` = 'imap_host');

INSERT INTO `app_settings` (`id`, `key`, `value`, `value_type`, `category`, `is_public`, `created_at`, `updated_at`)
SELECT UUID(), 'imap_port', '993', 'number', 'imap', 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `app_settings` WHERE `key` = 'imap_port');

INSERT INTO `app_settings` (`id`, `key`, `value`, `value_type`, `category`, `is_public`, `created_at`, `updated_at`)
SELECT UUID(), 'imap_username', '""', 'string', 'imap', 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `app_settings` WHERE `key` = 'imap_username');

INSERT INTO `app_settings` (`id`, `key`, `value`, `value_type`, `category`, `is_public`, `created_at`, `updated_at`)
SELECT UUID(), 'imap_encryption', '"ssl"', 'string', 'imap', 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `app_settings` WHERE `key` = 'imap_encryption');

INSERT INTO `app_settings` (`id`, `key`, `value`, `value_type`, `category`, `is_public`, `created_at`, `updated_at`)
SELECT UUID(), 'imap_poll_interval', '120', 'number', 'imap', 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `app_settings` WHERE `key` = 'imap_poll_interval');

INSERT INTO `app_settings` (`id`, `key`, `value`, `value_type`, `category`, `is_public`, `created_at`, `updated_at`)
SELECT UUID(), 'imap_last_poll', 'null', 'string', 'imap', 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `app_settings` WHERE `key` = 'imap_last_poll');

INSERT INTO `app_settings` (`id`, `key`, `value`, `value_type`, `category`, `is_public`, `created_at`, `updated_at`)
SELECT UUID(), 'imap_last_status', '""', 'string', 'imap', 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `app_settings` WHERE `key` = 'imap_last_status');
