-- Migration: Add Attachments to Ideas
ALTER TABLE ideas ADD COLUMN attachments TEXT DEFAULT '[]';
