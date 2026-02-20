-- Migration: Add User Preferences to Settings
ALTER TABLE settings ADD COLUMN userPreferences TEXT DEFAULT '[]';
