-- Migration: Add openRouterModelId to settings table
ALTER TABLE settings ADD COLUMN openRouterModelId TEXT;
