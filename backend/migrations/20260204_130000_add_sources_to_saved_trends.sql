-- Migration: Add sources column to saved_trends table
-- This stores reference URLs for trending topics

ALTER TABLE saved_trends ADD COLUMN sources TEXT DEFAULT '[]';
