-- Migration 004: Credential Vault
-- Created: 10 februari 2026
-- Feature: PAS-15 - Credential Vault
-- Encrypted storage for API keys and tokens (AES-256-GCM)

CREATE TABLE IF NOT EXISTS credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value_encrypted BLOB NOT NULL,
    iv BLOB NOT NULL,
    auth_tag BLOB NOT NULL,
    category TEXT DEFAULT 'api_key',
    description TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_credentials_key ON credentials(key);
CREATE INDEX IF NOT EXISTS idx_credentials_category ON credentials(category);
