-- schema.sql
-- Applied once at startup by internal/database/database.go.
-- Every statement uses IF NOT EXISTS, so running it on every boot is safe
-- and idempotent — a tiny, dependency-free "migration" strategy.

PRAGMA foreign_keys = ON;

-- ─────────────────────────────────────────────────────────────────────────
-- users: one row per registered account.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,            -- UUIDv4 string, generated in Go
    email         TEXT NOT NULL UNIQUE,        -- login identity (case-insensitive in app code)
    password_hash TEXT NOT NULL,               -- bcrypt hash — we NEVER store plaintext
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- A UNIQUE column already gets an implicit index, but we declare one
-- explicitly to document the access pattern ("find user by email" on login)
-- and to keep it stable across future schema changes.
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ─────────────────────────────────────────────────────────────────────────
-- files: one row of METADATA per uploaded blob.
-- The bytes themselves live on disk at  <STORAGE_DIR>/<id>.
-- This table never stores file content — only what we need to locate,
-- secure, and describe each file.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS files (
    id            TEXT PRIMARY KEY,            -- UUIDv4 == the opaque on-disk filename
    user_id       TEXT NOT NULL,               -- owner; EVERY file query filters on this
    original_name TEXT NOT NULL,               -- e.g. "tax_return_2025.pdf" (display only)
    mime_type     TEXT NOT NULL DEFAULT 'application/octet-stream',
    size_bytes    INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- If a user is deleted, their file metadata rows go with them.
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- The most important index in the whole app: "show me MY files".
-- Without it, GET /files becomes a full-table scan that degrades as the
-- file count grows.
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);

-- Lets "my files, newest first" be served straight from the index with no
-- separate sort step.
CREATE INDEX IF NOT EXISTS idx_files_user_created ON files(user_id, created_at DESC);
