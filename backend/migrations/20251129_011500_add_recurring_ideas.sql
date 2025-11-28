-- Migration: Add recurring fields to ideas table
ALTER TABLE ideas ADD COLUMN isRecurring BOOLEAN DEFAULT 0;
ALTER TABLE ideas ADD COLUMN frequency TEXT;
ALTER TABLE ideas ADD COLUMN lastGeneratedAt DATETIME;
