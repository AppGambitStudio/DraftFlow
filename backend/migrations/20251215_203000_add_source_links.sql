-- Migration: Add sourceLinks to ideas
ALTER TABLE ideas ADD COLUMN sourceLinks TEXT DEFAULT '[]';
