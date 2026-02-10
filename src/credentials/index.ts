/**
 * KITT Credential Vault
 *
 * Encrypted credential storage using AES-256-GCM in SQLite.
 * Replaces plaintext .env for secrets while maintaining backwards compatibility.
 *
 * Usage:
 *   const apiKey = await getCredential('OPENAI_API_KEY');
 *   await setCredential('OPENAI_API_KEY', 'sk-...', 'api_key');
 */

import { createClient, type Client } from '@libsql/client';
import path from 'node:path';
import { encrypt, decrypt } from './crypto.js';
import type { CredentialMeta, MigrationResult, CredentialCategory } from './types.js';
import { KNOWN_CREDENTIALS, SECRET_KEYS } from './types.js';

const DB_PATH = path.resolve(process.cwd(), 'profile/data/kitt.db');

// In-memory cache to avoid repeated DB queries + decryption
const cache = new Map<string, { value: string; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let dbClient: Client | null = null;
let initialized = false;

function getDb(): Client {
  if (!dbClient) {
    dbClient = createClient({ url: `file:${DB_PATH}` });
  }
  return dbClient;
}

/**
 * Initialize the credentials table if it doesn't exist.
 */
async function ensureTable(): Promise<void> {
  if (initialized) return;

  const db = getDb();
  await db.execute(`
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
    )
  `);

  initialized = true;
}

/**
 * Get a credential from the vault.
 * Falls back to process.env if not found in vault (backwards compatible).
 *
 * @param key - The credential key (e.g., 'OPENAI_API_KEY')
 * @returns The decrypted value, or null if not found anywhere
 */
export async function getCredential(key: string): Promise<string | null> {
  // Check cache first
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  // Try vault
  try {
    await ensureTable();
    const db = getDb();

    const result = await db.execute({
      sql: 'SELECT value_encrypted, iv, auth_tag FROM credentials WHERE key = ?',
      args: [key],
    });

    if (result.rows.length > 0) {
      const row = result.rows[0];
      const encrypted = Buffer.from(row.value_encrypted as ArrayBuffer);
      const iv = Buffer.from(row.iv as ArrayBuffer);
      const authTag = Buffer.from(row.auth_tag as ArrayBuffer);

      const value = decrypt(encrypted, iv, authTag);

      // Cache the decrypted value
      cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL });
      return value;
    }
  } catch (err) {
    // If vault fails, fall through to env
    console.warn(`[credentials] Failed to read ${key} from vault:`, err);
  }

  // Fallback: process.env (backwards compatible)
  const envValue = process.env[key] ?? null;
  if (envValue) {
    cache.set(key, { value: envValue, expiresAt: Date.now() + CACHE_TTL });
  }
  return envValue;
}

/**
 * Store a credential in the encrypted vault.
 *
 * @param key - The credential key
 * @param value - The plaintext value to encrypt and store
 * @param category - Optional category (api_key, oauth, token, other)
 * @param description - Optional description
 */
export async function setCredential(
  key: string,
  value: string,
  category?: CredentialCategory,
  description?: string
): Promise<void> {
  await ensureTable();
  const db = getDb();

  const { encrypted, iv, authTag } = encrypt(value);

  // Auto-detect category and description from known credentials
  const known = KNOWN_CREDENTIALS[key];
  const finalCategory = category || known?.category || 'other';
  const finalDescription = description || known?.description || null;

  await db.execute({
    sql: `INSERT INTO credentials (key, value_encrypted, iv, auth_tag, category, description, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, unixepoch() * 1000, unixepoch() * 1000)
          ON CONFLICT(key) DO UPDATE SET
            value_encrypted = excluded.value_encrypted,
            iv = excluded.iv,
            auth_tag = excluded.auth_tag,
            category = excluded.category,
            description = COALESCE(excluded.description, credentials.description),
            updated_at = unixepoch() * 1000`,
    args: [key, encrypted, iv, authTag, finalCategory, finalDescription],
  });

  // Update cache
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL });
}

/**
 * List all credentials (metadata only, no values).
 */
export async function listCredentials(): Promise<CredentialMeta[]> {
  await ensureTable();
  const db = getDb();

  const result = await db.execute(
    'SELECT key, category, description, created_at, updated_at FROM credentials ORDER BY category, key'
  );

  return result.rows.map((row) => ({
    key: row.key as string,
    category: row.category as string,
    description: row.description as string | null,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  }));
}

/**
 * Delete a credential from the vault.
 */
export async function deleteCredential(key: string): Promise<boolean> {
  await ensureTable();
  const db = getDb();

  const result = await db.execute({
    sql: 'DELETE FROM credentials WHERE key = ?',
    args: [key],
  });

  cache.delete(key);
  return (result.rowsAffected ?? 0) > 0;
}

/**
 * Check if a credential exists in the vault (not .env fallback).
 */
export async function hasCredential(key: string): Promise<boolean> {
  await ensureTable();
  const db = getDb();

  const result = await db.execute({
    sql: 'SELECT 1 FROM credentials WHERE key = ?',
    args: [key],
  });

  return result.rows.length > 0;
}

/**
 * Migrate credentials from .env file to the encrypted vault.
 * Only migrates known secret keys (SECRET_KEYS), not config values.
 * Does NOT delete from .env — that's a manual step.
 */
export async function migrateFromEnv(envPath?: string): Promise<MigrationResult> {
  const dotenv = await import('dotenv');
  const fs = await import('node:fs');

  const resolvedPath = envPath || path.resolve(process.cwd(), '.env');
  const result: MigrationResult = { migrated: [], skipped: [], failed: [] };

  if (!fs.existsSync(resolvedPath)) {
    return result;
  }

  const envConfig = dotenv.config({ path: resolvedPath });
  if (!envConfig.parsed) {
    return result;
  }

  for (const key of SECRET_KEYS) {
    const value = envConfig.parsed[key] || process.env[key];
    if (!value) continue;

    // Check if already in vault
    const exists = await hasCredential(key);
    if (exists) {
      result.skipped.push(key);
      continue;
    }

    try {
      await setCredential(key, value);
      result.migrated.push(key);
    } catch (err) {
      result.failed.push({
        key,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

/**
 * Clear the in-memory cache.
 */
export function clearCache(): void {
  cache.clear();
}

// Re-export types
export type { CredentialMeta, MigrationResult, CredentialCategory } from './types.js';
export { SECRET_KEYS, KNOWN_CREDENTIALS } from './types.js';
