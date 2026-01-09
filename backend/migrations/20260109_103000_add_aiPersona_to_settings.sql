-- Migration: Add aiPersona to settings
ALTER TABLE settings ADD COLUMN aiPersona TEXT;
