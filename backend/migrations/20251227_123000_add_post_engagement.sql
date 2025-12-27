-- Migration: Add engagement fields to Posts
ALTER TABLE posts ADD COLUMN likesCount INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN commentsCount INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN repostsCount INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN impressionsCount INTEGER DEFAULT 0;
