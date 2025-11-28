-- Migration: Add source and contentHash to ideas table
ALTER TABLE ideas ADD COLUMN source TEXT;
ALTER TABLE ideas ADD COLUMN contentHash TEXT;
CREATE UNIQUE INDEX idx_ideas_contentHash ON ideas(contentHash);
