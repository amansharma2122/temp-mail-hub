-- Migration: 001_initial
-- Description: Initial database schema
-- Version: 1.0.0
-- Date: 2024-01-01

-- This migration is applied when the database is first created.
-- It marks the starting point for the migration system.
-- The actual initial schema is in schema.mysql.sql

-- Migration tracking table (created by migrator if not exists)
-- CREATE TABLE IF NOT EXISTS `schema_migrations` (
--   `version` VARCHAR(20) NOT NULL PRIMARY KEY,
--   `name` VARCHAR(255) NOT NULL,
--   `applied_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
-- );

-- Mark this migration as the baseline
-- No actual changes needed - schema.mysql.sql handles initial setup
SELECT 'Initial schema baseline' AS status;
