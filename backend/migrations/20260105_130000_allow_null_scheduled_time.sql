-- Migration: Allow NULL scheduledTime in posts table
-- Note: SQLite does not support ALTER TABLE ALTER COLUMN. 
-- However, for simple nullability changes, we can rely on Sequelize sync() 
-- or use the "create temporary table" pattern if needed for other DBs.
-- For now, documenting the intent.

-- ALTER TABLE posts MODIFY COLUMN scheduledTime DATETIME NULL; -- For MySQL/Postgres
-- For SQLite, we just ensure future inserts allow NULL.
