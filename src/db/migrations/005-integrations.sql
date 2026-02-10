-- Migration 005: Integration Registry
-- Created: 10 februari 2026
-- Feature: PAS-45 - Unified Integration Registry
-- All external services as DB-driven integrations with auth_type per service

CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    category TEXT NOT NULL,
    auth_type TEXT NOT NULL DEFAULT 'api_key',  -- oauth, api_key, token, credentials
    provider TEXT NOT NULL DEFAULT 'custom',     -- nango, custom
    auth_config TEXT,                            -- JSON: extra config (credential_key, nango_integration_id, etc.)
    enabled INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- Seed: AI Services
INSERT OR IGNORE INTO integrations (id, name, description, icon, category, auth_type, provider, auth_config, sort_order) VALUES
  ('openai', 'OpenAI', 'Embeddings and transcription', '🧠', 'ai_service', 'api_key', 'custom', '{"credential_key":"OPENAI_API_KEY"}', 10),
  ('elevenlabs', 'ElevenLabs', 'Text-to-speech generation', '🔊', 'ai_service', 'api_key', 'custom', '{"credential_key":"ELEVENLABS_API_KEY"}', 20),
  ('fal-ai', 'fal.ai', 'Image generation', '🎨', 'ai_service', 'api_key', 'custom', '{"credential_key":"FAL_KEY"}', 30);

-- Seed: Channels
INSERT OR IGNORE INTO integrations (id, name, description, icon, category, auth_type, provider, auth_config, sort_order) VALUES
  ('telegram', 'Telegram', 'Primary messaging channel', '💬', 'channel', 'token', 'custom', '{"credential_key":"TELEGRAM_BOT_TOKEN"}', 10),
  ('slack', 'Slack', 'Team messaging', '💬', 'channel', 'oauth', 'nango', '{"nango_id":"slack"}', 20);

-- Seed: Email & Calendar
INSERT OR IGNORE INTO integrations (id, name, description, icon, category, auth_type, provider, auth_config, sort_order) VALUES
  ('google-mail', 'Gmail', 'Read emails, send drafts', '📧', 'email', 'oauth', 'nango', '{"nango_id":"google-mail"}', 10),
  ('google-calendar', 'Google Calendar', 'Manage your schedule', '📅', 'calendar', 'oauth', 'nango', '{"nango_id":"google-calendar"}', 10);

-- Seed: Storage & Productivity
INSERT OR IGNORE INTO integrations (id, name, description, icon, category, auth_type, provider, auth_config, sort_order) VALUES
  ('google-drive', 'Google Drive', 'Access and manage files', '📁', 'storage', 'oauth', 'nango', '{"nango_id":"google-drive"}', 10),
  ('notion', 'Notion', 'Sync pages and databases', '📝', 'productivity', 'oauth', 'nango', '{"nango_id":"notion"}', 10);

-- Seed: Media
INSERT OR IGNORE INTO integrations (id, name, description, icon, category, auth_type, provider, auth_config, sort_order) VALUES
  ('podbean', 'Podbean', 'Podcast publishing', '🎙️', 'media', 'oauth', 'custom', '{"credential_keys":["PODBEAN_CLIENT_ID","PODBEAN_CLIENT_SECRET"]}', 10);

-- Seed: Fitness
INSERT OR IGNORE INTO integrations (id, name, description, icon, category, auth_type, provider, auth_config, sort_order) VALUES
  ('garmin', 'Garmin Connect', 'Health and fitness data', '🏋️', 'fitness', 'credentials', 'custom', '{"fields":["email","password"]}', 10);

-- Seed: Development
INSERT OR IGNORE INTO integrations (id, name, description, icon, category, auth_type, provider, auth_config, sort_order) VALUES
  ('github', 'GitHub', 'Repository and issue tracking', '⚙️', 'development', 'oauth', 'nango', '{"nango_id":"github"}', 10),
  ('linear', 'Linear', 'Issue tracking and projects', '🎯', 'development', 'oauth', 'nango', '{"nango_id":"linear"}', 20);

-- Seed: CRM
INSERT OR IGNORE INTO integrations (id, name, description, icon, category, auth_type, provider, auth_config, sort_order) VALUES
  ('hubspot', 'HubSpot', 'CRM sync and management', '🎯', 'crm', 'oauth', 'nango', '{"nango_id":"hubspot"}', 10);

-- Seed: Infrastructure
INSERT OR IGNORE INTO integrations (id, name, description, icon, category, auth_type, provider, auth_config, sort_order) VALUES
  ('nango', 'Nango', 'OAuth integration platform', '🔧', 'infrastructure', 'api_key', 'custom', '{"credential_key":"NANGO_SECRET_KEY"}', 10);

-- Seed: Google OAuth (app-level, not per-user)
INSERT OR IGNORE INTO integrations (id, name, description, icon, category, auth_type, provider, auth_config, sort_order) VALUES
  ('google-oauth', 'Google OAuth App', 'Google OAuth client credentials', '🔐', 'infrastructure', 'oauth', 'custom', '{"credential_keys":["GOOGLE_CLIENT_ID","GOOGLE_CLIENT_SECRET"]}', 20);
