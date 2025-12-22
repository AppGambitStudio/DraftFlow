-- Migration: Add Recurring Schedule Fields to Ideas
ALTER TABLE ideas ADD COLUMN scheduleTime TEXT;
ALTER TABLE ideas ADD COLUMN scheduleDayOfWeek INTEGER;
ALTER TABLE ideas ADD COLUMN scheduleDayOfMonth INTEGER;
