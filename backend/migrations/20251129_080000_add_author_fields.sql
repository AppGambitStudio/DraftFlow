-- Migration: Add author fields to posts and ideas tables
ALTER TABLE posts ADD COLUMN authorUrn TEXT;
ALTER TABLE posts ADD COLUMN authorName TEXT;
ALTER TABLE ideas ADD COLUMN authorUrn TEXT;
ALTER TABLE ideas ADD COLUMN authorName TEXT;
