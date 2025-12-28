-- Migration: Add Anti-Goals to Ideas
-- Created at: 2025-12-28 12:52:00

ALTER TABLE ideas ADD COLUMN antiGoals TEXT;
