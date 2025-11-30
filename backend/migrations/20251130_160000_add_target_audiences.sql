-- Migration: Add targetAudiences to Settings
ALTER TABLE Settings ADD COLUMN targetAudiences TEXT;
