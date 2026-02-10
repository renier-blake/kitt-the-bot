/**
 * KITT Configuration Service
 * Database-driven configuration for integrations
 */

import { createClient, type Client } from '@libsql/client';
import * as path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'profile/data/kitt.db');

let dbClient: Client | null = null;

function getDb(): Client {
  if (!dbClient) {
    dbClient = createClient({
      url: `file:${DB_PATH}`,
    });
  }
  return dbClient;
}

export interface KittConfig {
  userId: string;
  userEmail: string;
  userName: string;
  timezone: string;
}

export interface KittConnection {
  id: number;
  integrationId: string;
  connectionId: string;
  label: string;
  accountEmail: string | null;
  isDefault: boolean;
  createdAt: number;
}

/**
 * Get a config value from the database
 * Falls back to environment variable if not in database
 */
export async function getConfigValue(key: string, fallback?: string): Promise<string | null> {
  const db = getDb();

  try {
    const result = await db.execute({
      sql: 'SELECT value FROM kitt_config WHERE key = ?',
      args: [key],
    });

    if (result.rows.length > 0) {
      return result.rows[0].value as string;
    }
  } catch {
    // Table might not exist yet
  }

  // Fallback to environment variable
  const envKey = `KITT_${key.toUpperCase()}`;
  return process.env[envKey] || fallback || null;
}

/**
 * Set a config value in the database
 */
export async function setConfigValue(key: string, value: string, description?: string): Promise<void> {
  const db = getDb();

  await db.execute({
    sql: `INSERT OR REPLACE INTO kitt_config (key, value, description, updated_at)
          VALUES (?, ?, COALESCE(?, (SELECT description FROM kitt_config WHERE key = ?)), strftime('%s', 'now'))`,
    args: [key, value, description || null, key],
  });
}

/**
 * Get all config values
 */
export async function getAllConfig(): Promise<KittConfig> {
  return {
    userId: (await getConfigValue('user_id', 'default')) || 'default',
    userEmail: (await getConfigValue('user_email')) || 'user@kitt.local',
    userName: (await getConfigValue('user_name')) || 'KITT User',
    timezone: (await getConfigValue('timezone')) || 'Europe/Amsterdam',
  };
}

/**
 * Get all connections for an integration
 */
export async function getConnections(integrationId: string): Promise<KittConnection[]> {
  const db = getDb();

  try {
    const result = await db.execute({
      sql: `SELECT id, integration_id, connection_id, label, account_email, is_default, created_at
            FROM kitt_connections
            WHERE integration_id = ?
            ORDER BY is_default DESC, label ASC`,
      args: [integrationId],
    });

    return result.rows.map((row) => ({
      id: row.id as number,
      integrationId: row.integration_id as string,
      connectionId: row.connection_id as string,
      label: row.label as string,
      accountEmail: row.account_email as string | null,
      isDefault: Boolean(row.is_default),
      createdAt: row.created_at as number,
    }));
  } catch {
    return [];
  }
}

/**
 * Get the default connection for an integration
 */
export async function getDefaultConnection(integrationId: string): Promise<KittConnection | null> {
  const connections = await getConnections(integrationId);
  return connections.find((c) => c.isDefault) || connections[0] || null;
}

/**
 * Get a connection by label
 */
export async function getConnectionByLabel(integrationId: string, label: string): Promise<KittConnection | null> {
  const connections = await getConnections(integrationId);
  return connections.find((c) => c.label.toLowerCase() === label.toLowerCase()) || null;
}

/**
 * Save a new connection (called after successful OAuth)
 */
export async function saveConnection(
  integrationId: string,
  connectionId: string,
  label: string,
  accountEmail?: string,
  isDefault?: boolean
): Promise<void> {
  const db = getDb();

  // If this is the first connection for this integration, make it default
  const existing = await getConnections(integrationId);
  const shouldBeDefault = isDefault ?? existing.length === 0;

  // If making this default, unset other defaults
  if (shouldBeDefault && existing.length > 0) {
    await db.execute({
      sql: 'UPDATE kitt_connections SET is_default = 0 WHERE integration_id = ?',
      args: [integrationId],
    });
  }

  await db.execute({
    sql: `INSERT OR REPLACE INTO kitt_connections
          (integration_id, connection_id, label, account_email, is_default, created_at)
          VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'))`,
    args: [integrationId, connectionId, label, accountEmail || null, shouldBeDefault ? 1 : 0],
  });
}

/**
 * Delete a connection
 */
export async function deleteConnectionRecord(integrationId: string, connectionId: string): Promise<void> {
  const db = getDb();

  await db.execute({
    sql: 'DELETE FROM kitt_connections WHERE integration_id = ? AND connection_id = ?',
    args: [integrationId, connectionId],
  });
}

/**
 * Set a connection as default
 */
export async function setDefaultConnection(integrationId: string, connectionId: string): Promise<void> {
  const db = getDb();

  // Unset all defaults for this integration
  await db.execute({
    sql: 'UPDATE kitt_connections SET is_default = 0 WHERE integration_id = ?',
    args: [integrationId],
  });

  // Set the new default
  await db.execute({
    sql: 'UPDATE kitt_connections SET is_default = 1 WHERE integration_id = ? AND connection_id = ?',
    args: [integrationId, connectionId],
  });
}
