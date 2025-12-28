-- Migration: Add Indexes for Performance
-- Created at: 2025-12-28 13:05:00

-- Settings: Frequent lookup by userId
CREATE INDEX IF NOT EXISTS idx_settings_userid ON settings(userId);

-- Posts: Filter by user, status/time for scheduler, and sorting
CREATE INDEX IF NOT EXISTS idx_posts_userid ON posts(userId);
CREATE INDEX IF NOT EXISTS idx_posts_status_scheduled ON posts(status, scheduledTime);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(createdAt);

-- Ideas: Filter by user, finding recurring ideas, and sorting
CREATE INDEX IF NOT EXISTS idx_ideas_userid ON ideas(userId);
CREATE INDEX IF NOT EXISTS idx_ideas_recurring ON ideas(isRecurring);
CREATE INDEX IF NOT EXISTS idx_ideas_created_at ON ideas(createdAt);
