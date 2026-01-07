-- Migration: Allow NULL for scheduledTime in posts table
-- SQLite doesn't support simple ALTER TABLE column constraints, so we use the recreation pattern

BEGIN TRANSACTION;

CREATE TABLE posts_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    tenantId TEXT,
    content TEXT NOT NULL,
    mediaUrls TEXT,
    scheduledTime DATETIME,
    status VARCHAR(255) DEFAULT 'DRAFT',
    linkedinPostId VARCHAR(255),
    twitterPostId VARCHAR(255),
    error TEXT,
    platforms TEXT DEFAULT '["LINKEDIN"]',
    authorUrn VARCHAR(255),
    authorName VARCHAR(255),
    createdAt DATETIME NOT NULL,
    updatedAt DATETIME NOT NULL,
    likesCount INTEGER DEFAULT 0,
    commentsCount INTEGER DEFAULT 0,
    repostsCount INTEGER DEFAULT 0,
    impressionsCount INTEGER DEFAULT 0,
    lastStatsSyncedAt DATE
);

INSERT INTO posts_new SELECT id, userId, tenantId, content, mediaUrls, scheduledTime, status, linkedinPostId, twitterPostId, error, platforms, authorUrn, authorName, createdAt, updatedAt, likesCount, commentsCount, repostsCount, impressionsCount, lastStatsSyncedAt FROM posts;

DROP TABLE posts;

ALTER TABLE posts_new RENAME TO posts;

COMMIT;
