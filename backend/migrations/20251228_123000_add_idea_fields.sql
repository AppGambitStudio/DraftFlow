-- Migration: Add Fields to Ideas
-- Created at: 2025-12-28 12:30:00

ALTER TABLE ideas ADD COLUMN postShape TEXT;
ALTER TABLE ideas ADD COLUMN effortLevel TEXT;
ALTER TABLE ideas ADD COLUMN keyTakeaway TEXT;
