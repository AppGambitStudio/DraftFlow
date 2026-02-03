-- Migration: Add agent_drafts table for AI agent generated content pending approval
CREATE TABLE IF NOT EXISTS agent_drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenantId TEXT NOT NULL,
    content TEXT NOT NULL,
    explanation TEXT,
    sources TEXT DEFAULT '[]',
    hooks TEXT DEFAULT '[]',
    hashtags TEXT DEFAULT '[]',
    status TEXT DEFAULT 'pending',
    platform TEXT DEFAULT 'LINKEDIN',
    scheduledFor DATETIME,
    postId INTEGER,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenantId) REFERENCES tenants(id),
    FOREIGN KEY (postId) REFERENCES posts(id)
);

CREATE INDEX IF NOT EXISTS idx_agent_drafts_tenantId ON agent_drafts(tenantId);
CREATE INDEX IF NOT EXISTS idx_agent_drafts_status ON agent_drafts(status);
CREATE INDEX IF NOT EXISTS idx_agent_drafts_createdAt ON agent_drafts(createdAt);
