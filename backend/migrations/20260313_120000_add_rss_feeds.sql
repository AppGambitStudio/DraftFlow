-- RSS Feeds table
CREATE TABLE IF NOT EXISTS rss_feeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenantId VARCHAR(255),
    url VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    description TEXT,
    siteUrl VARCHAR(255),
    imageUrl VARCHAR(255),
    status VARCHAR(255) DEFAULT 'ACTIVE',
    lastFetchedAt DATETIME,
    lastError TEXT,
    createdAt DATETIME,
    updatedAt DATETIME,
    FOREIGN KEY (tenantId) REFERENCES tenants(id)
);

CREATE INDEX IF NOT EXISTS idx_rss_feeds_tenantId ON rss_feeds(tenantId);

-- RSS Feed Items table
CREATE TABLE IF NOT EXISTS rss_feed_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenantId VARCHAR(255),
    feedId INTEGER NOT NULL,
    guid VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content TEXT,
    link VARCHAR(255),
    author VARCHAR(255),
    pubDate DATETIME,
    imageUrl VARCHAR(255),
    categories TEXT DEFAULT '[]',
    isBookmarked BOOLEAN DEFAULT 0,
    isRead BOOLEAN DEFAULT 0,
    isUsed BOOLEAN DEFAULT 0,
    usedForPostId INTEGER,
    createdAt DATETIME,
    updatedAt DATETIME,
    FOREIGN KEY (tenantId) REFERENCES tenants(id),
    FOREIGN KEY (feedId) REFERENCES rss_feeds(id)
);

CREATE INDEX IF NOT EXISTS idx_rss_feed_items_tenantId ON rss_feed_items(tenantId);
CREATE INDEX IF NOT EXISTS idx_rss_feed_items_feedId ON rss_feed_items(feedId);
CREATE INDEX IF NOT EXISTS idx_rss_feed_items_pubDate ON rss_feed_items(pubDate);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rss_feed_items_guid ON rss_feed_items(feedId, guid);
