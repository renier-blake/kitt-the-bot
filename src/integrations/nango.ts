/**
 * Nango Integration Service
 * OAuth/API layer for third-party integrations
 *
 * Nango handles:
 * - OAuth flows (token acquisition, refresh)
 * - API proxying with automatic token injection
 * - Connection management
 *
 * Multi-account support:
 * - Multiple connections per integration (e.g., 3 Gmail accounts)
 * - Labels for easy identification ("Persoonlijk", "LeadIT")
 * - Default connection per integration
 */

import { Nango } from '@nangohq/node';
import {
  getAllConfig,
  getDefaultConnection,
  getConnectionByLabel,
  saveConnection,
  deleteConnectionRecord,
  type KittConfig,
} from './config.js';

let nangoClient: Nango | null = null;
let cachedConfig: KittConfig | null = null;

/**
 * Get user config from database (cached)
 */
async function getConfig(): Promise<KittConfig> {
  if (!cachedConfig) {
    cachedConfig = await getAllConfig();
  }
  return cachedConfig;
}

/**
 * Clear config cache (call after config changes)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}

/**
 * Get the user ID for Nango connections
 * Now reads from database instead of .env
 */
export async function getUserId(): Promise<string> {
  const config = await getConfig();
  return config.userId;
}

/**
 * Get user display info for OAuth sessions
 */
async function getUserInfo(): Promise<{ id: string; email: string; displayName: string }> {
  const config = await getConfig();
  return {
    id: config.userId,
    email: config.userEmail,
    displayName: config.userName,
  };
}

/**
 * Get or create Nango client instance
 */
export function getNango(): Nango {
  if (!nangoClient) {
    const secretKey = process.env.NANGO_SECRET_KEY;
    if (!secretKey) {
      throw new Error('NANGO_SECRET_KEY not configured in .env');
    }
    nangoClient = new Nango({ secretKey });
  }
  return nangoClient;
}

/**
 * Create a connect session for the frontend Connect UI
 * Returns a session token that the frontend uses to show the OAuth popup
 */
export async function createConnectSession(
  integrationId: string
): Promise<{ token: string; expiresAt: string }> {
  const nango = getNango();
  const userInfo = await getUserInfo();

  const session = await nango.createConnectSession({
    end_user: {
      id: userInfo.id,
      email: userInfo.email,
      display_name: userInfo.displayName,
    },
    allowed_integrations: [integrationId],
  });

  return {
    token: session.data.token,
    expiresAt: session.data.expires_at,
  };
}

/**
 * List all active connections for the user from Nango
 */
export async function listConnections(): Promise<
  Array<{
    id: string;
    integrationId: string;
    provider: string;
    createdAt: string;
  }>
> {
  const nango = getNango();

  const result = await nango.listConnections();

  return result.connections.map((conn: any) => ({
    id: conn.connection_id,
    integrationId: conn.integration_id || conn.provider_config_key,
    provider: conn.provider,
    createdAt: conn.created_at || conn.created,
  }));
}

/**
 * Find the connection ID for a given integration
 * Supports multi-account via account label
 *
 * @param integrationId - The integration (e.g., 'google-mail')
 * @param accountLabel - Optional account label (e.g., 'LeadIT')
 * @returns Connection ID or null
 */
export async function findConnectionId(
  integrationId: string,
  accountLabel?: string
): Promise<string | null> {
  // If account label specified, look up in our database
  if (accountLabel) {
    const conn = await getConnectionByLabel(integrationId, accountLabel);
    if (conn) return conn.connectionId;
  }

  // Try to get default connection from database
  const defaultConn = await getDefaultConnection(integrationId);
  if (defaultConn) return defaultConn.connectionId;

  // Fallback: get first connection from Nango
  const connections = await listConnections();
  const match = connections.find((c) => c.integrationId === integrationId);
  return match?.id || null;
}

/**
 * Get a specific connection
 * If connectionId is not provided, finds the default connection for this integration
 */
export async function getConnection(
  integrationId: string,
  connectionId?: string
): Promise<{
  id: string;
  provider: string;
  credentials: unknown;
} | null> {
  const nango = getNango();

  // If no connectionId provided, find it dynamically
  const connId = connectionId || (await findConnectionId(integrationId));
  if (!connId) return null;

  try {
    const conn = await nango.getConnection(integrationId, connId);
    return {
      id: conn.connection_id,
      provider: conn.provider,
      credentials: conn.credentials,
    };
  } catch {
    return null;
  }
}

/**
 * Delete a connection
 * Also removes from local database
 */
export async function deleteConnection(
  integrationId: string,
  connectionId?: string
): Promise<void> {
  const nango = getNango();
  const connId = connectionId || (await findConnectionId(integrationId));
  if (!connId) {
    throw new Error(`No connection found for integration: ${integrationId}`);
  }

  // Delete from Nango
  await nango.deleteConnection(integrationId, connId);

  // Delete from local database
  await deleteConnectionRecord(integrationId, connId);
}

/**
 * Register a new connection after successful OAuth
 * Call this after the Connect UI successfully completes
 */
export async function registerConnection(
  integrationId: string,
  connectionId: string,
  label: string,
  accountEmail?: string,
  isDefault?: boolean
): Promise<void> {
  await saveConnection(integrationId, connectionId, label, accountEmail, isDefault);
}

/**
 * Proxy an API request through Nango
 * Nango automatically injects the OAuth token
 *
 * @param integrationId - The integration (e.g., 'google-mail')
 * @param options - Request options
 * @param options.account - Optional account label for multi-account (e.g., 'LeadIT')
 */
export async function proxyRequest<T = unknown>(
  integrationId: string,
  options: {
    endpoint: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    data?: unknown;
    params?: Record<string, string>;
    headers?: Record<string, string>;
    connectionId?: string;
    account?: string; // Account label for multi-account
  }
): Promise<T> {
  const nango = getNango();

  // Find connection ID: explicit > by label > default
  let connId = options.connectionId;
  if (!connId && options.account) {
    connId = await findConnectionId(integrationId, options.account) || undefined;
  }
  if (!connId) {
    connId = await findConnectionId(integrationId) || undefined;
  }

  if (!connId) {
    throw new Error(`No connection found for integration: ${integrationId}`);
  }

  const response = await nango.proxy({
    providerConfigKey: integrationId,
    connectionId: connId,
    method: options.method || 'GET',
    endpoint: options.endpoint,
    data: options.data,
    params: options.params,
    headers: options.headers,
  });

  return response.data as T;
}

/**
 * Check if a specific integration is connected
 */
export async function isConnected(integrationId: string): Promise<boolean> {
  const connId = await findConnectionId(integrationId);
  return connId !== null;
}

/**
 * Get available integrations from Nango
 * These are the integrations configured in the Nango dashboard
 */
export async function listIntegrations(): Promise<
  Array<{
    uniqueKey: string;
    provider: string;
  }>
> {
  const nango = getNango();
  const result = await nango.listIntegrations();

  return result.configs.map((config) => ({
    uniqueKey: config.unique_key,
    provider: config.provider,
  }));
}

// Re-export config types and functions for convenience
export { getDefaultConnection, getConnectionByLabel, saveConnection } from './config.js';
export type { KittConnection } from './config.js';
