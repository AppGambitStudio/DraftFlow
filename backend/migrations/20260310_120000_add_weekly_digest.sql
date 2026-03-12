-- Add weekly_digests table
CREATE TABLE IF NOT EXISTS weekly_digests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenantId VARCHAR(255),
    content TEXT NOT NULL DEFAULT '',
    topics TEXT NOT NULL DEFAULT '[]',
    stories TEXT NOT NULL DEFAULT '[]',
    platform VARCHAR(255) DEFAULT 'linkedin',
    storyCount INTEGER DEFAULT 5,
    status VARCHAR(255) DEFAULT 'GENERATED',
    error TEXT,
    postId INTEGER,
    createdAt DATETIME,
    updatedAt DATETIME,
    FOREIGN KEY (tenantId) REFERENCES tenants(id),
    FOREIGN KEY (postId) REFERENCES posts(id)
);

CREATE INDEX IF NOT EXISTS idx_weekly_digests_tenantId ON weekly_digests(tenantId);
CREATE INDEX IF NOT EXISTS idx_weekly_digests_createdAt ON weekly_digests(createdAt);

-- Add digestConfig to settings
ALTER TABLE settings ADD COLUMN digestConfig TEXT;
