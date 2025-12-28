
-- Create Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create TenantMembers Table
CREATE TABLE IF NOT EXISTS tenant_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    tenantId TEXT NOT NULL,
    role TEXT DEFAULT 'OWNER',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(userId) REFERENCES users(id),
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
);

-- Create Invitations Table
CREATE TABLE IF NOT EXISTS invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    tenantId TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    role TEXT DEFAULT 'ADMIN',
    status TEXT DEFAULT 'PENDING',
    expiresAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
);

-- Add tenantId to existing tables
-- Note: SQLite does not support IF NOT EXISTS for column additions, 
-- so these might fail if run multiple times. We'll handle them one by one.

ALTER TABLE posts ADD COLUMN tenantId TEXT;
ALTER TABLE ideas ADD COLUMN tenantId TEXT;
ALTER TABLE settings ADD COLUMN tenantId TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_posts_tenantId ON posts(tenantId);
CREATE INDEX IF NOT EXISTS idx_ideas_tenantId ON ideas(tenantId);
CREATE INDEX IF NOT EXISTS idx_settings_tenantId ON settings(tenantId);
CREATE INDEX IF NOT EXISTS idx_tenant_members_userId ON tenant_members(userId);
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenantId ON tenant_members(tenantId);
