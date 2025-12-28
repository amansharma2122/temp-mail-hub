-- Migration: 002_add_installation_lock
-- Description: Add installation status tracking
-- Version: 1.0.1
-- Date: 2024-01-02

-- Add installation_completed to app_settings if not exists
INSERT INTO `app_settings` (`id`, `key`, `value`, `value_type`, `category`, `is_public`, `created_at`, `updated_at`)
SELECT UUID(), 'installation_completed', '"false"', 'boolean', 'system', 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `app_settings` WHERE `key` = 'installation_completed');

INSERT INTO `app_settings` (`id`, `key`, `value`, `value_type`, `category`, `is_public`, `created_at`, `updated_at`)
SELECT UUID(), 'installation_date', CONCAT('"', NOW(), '"'), 'string', 'system', 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `app_settings` WHERE `key` = 'installation_date');

INSERT INTO `app_settings` (`id`, `key`, `value`, `value_type`, `category`, `is_public`, `created_at`, `updated_at`)
SELECT UUID(), 'schema_version', '"1.0.1"', 'string', 'system', 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `app_settings` WHERE `key` = 'schema_version');
