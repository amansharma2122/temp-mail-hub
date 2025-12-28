-- Migration: 004_add_webhook_settings  
-- Description: Add webhook configuration to app_settings
-- Version: 1.0.3
-- Date: 2024-01-04

-- Add Webhook settings to app_settings
INSERT INTO `app_settings` (`id`, `key`, `value`, `value_type`, `category`, `is_public`, `created_at`, `updated_at`)
SELECT UUID(), 'webhook_enabled', 'true', 'boolean', 'webhook', 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `app_settings` WHERE `key` = 'webhook_enabled');

INSERT INTO `app_settings` (`id`, `key`, `value`, `value_type`, `category`, `is_public`, `created_at`, `updated_at`)
SELECT UUID(), 'webhook_secret', '""', 'string', 'webhook', 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `app_settings` WHERE `key` = 'webhook_secret');

INSERT INTO `app_settings` (`id`, `key`, `value`, `value_type`, `category`, `is_public`, `created_at`, `updated_at`)
SELECT UUID(), 'webhook_provider', '""', 'string', 'webhook', 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `app_settings` WHERE `key` = 'webhook_provider');

INSERT INTO `app_settings` (`id`, `key`, `value`, `value_type`, `category`, `is_public`, `created_at`, `updated_at`)
SELECT UUID(), 'webhook_last_received', 'null', 'string', 'webhook', 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `app_settings` WHERE `key` = 'webhook_last_received');

-- Add email delivery mode setting
INSERT INTO `app_settings` (`id`, `key`, `value`, `value_type`, `category`, `is_public`, `created_at`, `updated_at`)
SELECT UUID(), 'email_delivery_mode', '"webhook"', 'string', 'email', 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `app_settings` WHERE `key` = 'email_delivery_mode');
