-- Migration: Add business profile fields to settings
ALTER TABLE settings ADD COLUMN companyName TEXT;
ALTER TABLE settings ADD COLUMN industry TEXT;
ALTER TABLE settings ADD COLUMN companyDescription TEXT;
ALTER TABLE settings ADD COLUMN expertiseAreas TEXT DEFAULT '[]';
ALTER TABLE settings ADD COLUMN contentPillars TEXT DEFAULT '[]';
