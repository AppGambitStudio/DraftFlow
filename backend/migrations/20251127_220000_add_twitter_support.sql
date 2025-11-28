-- Migration: Add Twitter Support
-- Date: 2025-11-27
-- Description: Adds columns to Settings and Posts tables for Twitter integration.

-- Add Twitter credentials to Settings table
ALTER TABLE Settings ADD COLUMN twitterClientId TEXT;
ALTER TABLE Settings ADD COLUMN twitterClientSecret TEXT;
ALTER TABLE Settings ADD COLUMN twitterAccessToken TEXT;
ALTER TABLE Settings ADD COLUMN twitterRefreshToken TEXT;
ALTER TABLE Settings ADD COLUMN twitterExpiresAt DATETIME;

-- Add multi-platform support to Posts table
ALTER TABLE posts ADD COLUMN platforms TEXT DEFAULT '["LINKEDIN"]';
ALTER TABLE posts ADD COLUMN twitterPostId TEXT;
