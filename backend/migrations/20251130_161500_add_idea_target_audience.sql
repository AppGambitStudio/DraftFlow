-- Migration: Add targetAudience to Ideas
ALTER TABLE ideas ADD COLUMN targetAudience TEXT;
