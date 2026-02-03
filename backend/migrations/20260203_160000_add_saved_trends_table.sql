-- Migration: Add saved_trends table for persisting trending topics
CREATE TABLE IF NOT EXISTS saved_trends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenantId TEXT NOT NULL,
    topic TEXT NOT NULL,
    description TEXT NOT NULL,
    relevance TEXT NOT NULL,
    suggestedAngles TEXT DEFAULT '[]',
    trendType TEXT NOT NULL,
    industry TEXT,
    fetchedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_saved_trends_tenantId ON saved_trends(tenantId);
CREATE INDEX IF NOT EXISTS idx_saved_trends_fetchedAt ON saved_trends(fetchedAt);
