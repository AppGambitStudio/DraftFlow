-- Migration: Add LinkedIn Organizations to Settings
ALTER TABLE settings ADD COLUMN linkedinOrganizations TEXT DEFAULT '[]';
