-- Migration: Add case_studies table for client success stories
CREATE TABLE IF NOT EXISTS case_studies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenantId TEXT NOT NULL,
    title TEXT NOT NULL,
    clientName TEXT NOT NULL,
    industry TEXT,
    challenge TEXT NOT NULL,
    solution TEXT NOT NULL,
    results TEXT NOT NULL,
    testimonial TEXT,
    tags TEXT DEFAULT '[]',
    status TEXT DEFAULT 'draft',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenantId) REFERENCES tenants(id)
);

CREATE INDEX IF NOT EXISTS idx_case_studies_tenantId ON case_studies(tenantId);
CREATE INDEX IF NOT EXISTS idx_case_studies_status ON case_studies(status);
CREATE INDEX IF NOT EXISTS idx_case_studies_industry ON case_studies(industry);
CREATE INDEX IF NOT EXISTS idx_case_studies_createdAt ON case_studies(createdAt);
