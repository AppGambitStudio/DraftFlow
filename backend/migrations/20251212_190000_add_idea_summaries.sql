-- Migration: Add Generated Summaries to Ideas
ALTER TABLE ideas ADD COLUMN generatedSummaries TEXT DEFAULT '[]';
