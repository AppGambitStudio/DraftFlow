-- Migration: Add Idea Table
-- Date: 2025-11-28
-- Description: Creates the Idea table for the Idea Board feature.

CREATE TABLE IF NOT EXISTS ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    tags TEXT DEFAULT '[]', -- JSON string
    status TEXT DEFAULT 'NEW', -- NEW, DRAFTED, ARCHIVED
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
