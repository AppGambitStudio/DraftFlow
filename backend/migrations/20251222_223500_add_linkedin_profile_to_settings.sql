-- Migration: Add linkedinProfile column to Settings table
ALTER TABLE settings ADD COLUMN linkedinProfile TEXT DEFAULT '{}';
