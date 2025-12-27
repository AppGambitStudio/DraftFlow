-- Migration: Add tone instructions to Settings
ALTER TABLE settings ADD COLUMN globalTone TEXT;
ALTER TABLE settings ADD COLUMN accountTones TEXT DEFAULT '{}';
