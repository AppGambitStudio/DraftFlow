-- Migration: Add maxHistoryItems to Settings
ALTER TABLE settings ADD COLUMN maxHistoryItems INTEGER DEFAULT 5;
