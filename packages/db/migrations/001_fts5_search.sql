-- FTS5 Full-Text Search Migration
-- This is an OPTIONAL migration to enable fast full-text search on messages
-- Run this migration manually if you want to enable FTS5 search capabilities
--
-- Note: FTS5 requires SQLite 3.9.0+ with the FTS5 extension compiled
-- Most modern SQLite distributions include FTS5 by default
--
-- Benefits of FTS5:
-- - Much faster text search on large datasets (100x+ improvement)
-- - Relevance ranking with BM25 algorithm
-- - Support for phrase queries and boolean operators
-- - Efficient incremental updates via triggers
--
-- To apply this migration:
--   sqlite3 your_database.db < 001_fts5_search.sql
--
-- To rollback:
--   DROP TABLE IF EXISTS messages_fts;
--   DROP TRIGGER IF EXISTS messages_ai;
--   DROP TRIGGER IF EXISTS messages_ad;
--   DROP TRIGGER IF EXISTS messages_au;

-- Create FTS5 virtual table for message content
-- Using external content to avoid data duplication
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  content,
  content='messages',
  content_rowid='rowid'
);

-- Populate FTS index with existing messages
INSERT INTO messages_fts(rowid, content)
SELECT rowid, content FROM messages WHERE deleted_at IS NULL;

-- Trigger to keep FTS index in sync on INSERT
CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages
WHEN NEW.deleted_at IS NULL
BEGIN
  INSERT INTO messages_fts(rowid, content) VALUES (NEW.rowid, NEW.content);
END;

-- Trigger to remove from FTS index on DELETE or soft-delete
CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES ('delete', OLD.rowid, OLD.content);
END;

-- Trigger to handle UPDATE (content change or soft-delete)
CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
  -- Remove old entry
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES ('delete', OLD.rowid, OLD.content);
  -- Add new entry only if not soft-deleted
  INSERT INTO messages_fts(rowid, content)
  SELECT NEW.rowid, NEW.content WHERE NEW.deleted_at IS NULL;
END;

-- Create index on messages.rowid for efficient joins
-- (rowid is implicit in SQLite but explicit index helps)
CREATE INDEX IF NOT EXISTS messages_rowid_idx ON messages(rowid);

-- Optimize the FTS index after initial population
INSERT INTO messages_fts(messages_fts) VALUES ('optimize');

-- Verify FTS5 is working (should return row count)
SELECT 'FTS5 migration complete. Total indexed messages: ' || count(*) FROM messages_fts;
