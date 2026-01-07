-- Migration: Add Webhook Secret
ALTER TABLE settings ADD COLUMN webhookSecret TEXT;
