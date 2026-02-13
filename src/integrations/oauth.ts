/**
 * KITT Generic OAuth2 Framework
 *
 * Database-driven OAuth2 client that works with any provider.
 * Configuration is read from the `integrations` table `auth_config` JSON.
 *
 * Adding a new OAuth provider = DB insert + credential setup, no code changes.
 *
 * Supported flows:
 * - Authorization Code (standard OAuth2)
 * - Token refresh (optional, for providers like Google)
 * - Token storage in encrypted credential vault
 */

import { createClient, type Client } from '@libsql/client';
import * as path from 'path';
import { getCredential, setCredential, deleteCredential } from '../credentials/index.js';

const DB_PATH = path.resolve(process.cwd(), 'profile/data/kitt.db');

/**
 * Resolve a potentially nested field path from an object.
 * Supports dot notation, e.g. "authed_user.access_token"
 */
function resolveField(data: Record<string, unknown>, fieldPath: string): unknown {
  return fieldPath.split('.').reduce((obj, key) => (obj as Record<string, unknown>)?.[key], data as unknown);
}

let dbClient: Client | null = null;

function getDb(): Client {
  if (!dbClient) {
    dbClient = createClient({ url: `file:${DB_PATH}` });
  }
  return dbClient;
}

/**
 * OAuth configuration stored in `integrations.auth_config` JSON
 */
export interface OAuthConfig {
  /** Credential vault key for the OAuth client ID */
  clientIdKey: string;
  /** Credential vault key for the OAuth client secret */
  clientSecretKey: string;
  /** Credential vault key to store the access token */
  tokenKey: string;
  /** Credential vault key to store the refresh token (null = no refresh) */
  refreshTokenKey: string | null;
  /** Provider's OAuth authorize endpoint */
  authorizeUrl: string;
  /** Provider's token exchange endpoint */
  tokenUrl: string;
  /** OAuth scopes (space or comma-separated) */
  scopes: string;
  /** Field name in token response that contains the access token */
  tokenResponseField: string;
  /** Extra params to append to the authorize URL (e.g. access_type, prompt) */
  extraAuthorizeParams: Record<string, string>;
  /** Override redirect URI (e.g. tunnel URL for providers that require HTTPS) */
  redirectUri: string | null;
  /** How to send client credentials in token exchange: 'body' (default) or 'basic' (HTTP Basic Auth) */
  tokenAuthMethod: 'body' | 'basic';
  /** Content type for token exchange: 'form' (default) or 'json' */
  tokenContentType: 'form' | 'json';
}

/**
 * Load OAuthConfig from the `integrations` table for a given integration ID.
 * Returns null if the integration doesn't exist or isn't a direct OAuth integration.
 */
export async function getOAuthConfig(integrationId: string): Promise<OAuthConfig | null> {
  const db = getDb();

  const result = await db.execute({
    sql: `SELECT auth_type, provider, auth_config FROM integrations WHERE id = ?`,
    args: [integrationId],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  const authType = row.auth_type as string;
  const provider = row.provider as string;
  const authConfigRaw = row.auth_config as string | null;

  if (provider !== 'direct' || authType !== 'oauth' || !authConfigRaw) return null;

  try {
    const config = JSON.parse(authConfigRaw);
    return {
      clientIdKey: config.client_id_key,
      clientSecretKey: config.client_secret_key,
      tokenKey: config.token_key,
      refreshTokenKey: config.refresh_token_key ?? null,
      authorizeUrl: config.authorize_url,
      tokenUrl: config.token_url,
      scopes: config.scopes,
      tokenResponseField: config.token_response_field || 'access_token',
      extraAuthorizeParams: config.extra_authorize_params || {},
      redirectUri: config.redirect_uri || null,
      tokenAuthMethod: config.token_auth_method || 'body',
      tokenContentType: config.token_content_type || 'form',
    };
  } catch {
    console.error(`[oauth] Failed to parse auth_config for ${integrationId}`);
    return null;
  }
}

/**
 * Build the OAuth authorize URL for a given integration.
 * The `state` parameter is set to the integrationId so the callback can identify it.
 */
export async function buildAuthorizeUrl(
  integrationId: string,
  redirectUri: string
): Promise<string> {
  const config = await getOAuthConfig(integrationId);
  if (!config) {
    throw new Error(`[oauth] No OAuth config found for integration: ${integrationId}`);
  }

  const clientId = await getCredential(config.clientIdKey);
  if (!clientId) {
    throw new Error(`[oauth] Client ID not configured (${config.clientIdKey})`);
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state: integrationId,
    ...config.extraAuthorizeParams,
  });

  // Only include scope if it's non-empty (some providers like Asana reject empty scope)
  if (config.scopes) {
    params.set('scope', config.scopes);
  }

  const url = `${config.authorizeUrl}?${params.toString()}`;
  console.log(`[oauth] Built authorize URL for ${integrationId}`);
  return url;
}

/**
 * Exchange an authorization code for tokens and store them in the credential vault.
 */
export async function exchangeCodeForTokens(
  integrationId: string,
  code: string,
  redirectUri: string
): Promise<{ success: boolean; error?: string }> {
  const config = await getOAuthConfig(integrationId);
  if (!config) {
    return { success: false, error: `No OAuth config found for: ${integrationId}` };
  }

  const clientId = await getCredential(config.clientIdKey);
  const clientSecret = await getCredential(config.clientSecretKey);

  if (!clientId || !clientSecret) {
    return { success: false, error: `Client credentials not configured for: ${integrationId}` };
  }

  try {
    console.log(`[oauth] Exchanging code for tokens (${integrationId})`);

    const headers: Record<string, string> = {};
    let body: string;

    if (config.tokenAuthMethod === 'basic') {
      // HTTP Basic Auth (e.g. Notion)
      headers['Authorization'] = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
    }

    if (config.tokenContentType === 'json') {
      headers['Content-Type'] = 'application/json';
      const jsonBody: Record<string, string> = {
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      };
      if (config.tokenAuthMethod !== 'basic') {
        jsonBody.client_id = clientId;
        jsonBody.client_secret = clientSecret;
      }
      body = JSON.stringify(jsonBody);
    } else {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      const formBody: Record<string, string> = {
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      };
      if (config.tokenAuthMethod !== 'basic') {
        formBody.client_id = clientId;
        formBody.client_secret = clientSecret;
      }
      body = new URLSearchParams(formBody).toString();
    }

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers,
      body,
    });

    const data = await response.json() as Record<string, unknown>;

    // Check for OAuth errors (different providers return errors differently)
    if (data.error || data.ok === false) {
      const errorMsg = (data.error_description || data.error || 'Token exchange failed') as string;
      console.error(`[oauth] Token exchange failed for ${integrationId}:`, errorMsg);
      return { success: false, error: errorMsg };
    }

    // Extract access token using the configured field name (supports dot notation, e.g. "authed_user.access_token")
    const accessToken = resolveField(data, config.tokenResponseField) as string | undefined;
    if (!accessToken) {
      console.error(`[oauth] No ${config.tokenResponseField} in response for ${integrationId}`);
      return { success: false, error: `No ${config.tokenResponseField} in token response` };
    }

    // Store access token in vault
    await setCredential(config.tokenKey, accessToken, 'oauth');
    console.log(`[oauth] Access token stored for ${integrationId} (${config.tokenKey})`);

    // Store refresh token if configured and present
    if (config.refreshTokenKey && data.refresh_token) {
      await setCredential(config.refreshTokenKey, data.refresh_token as string, 'oauth');
      console.log(`[oauth] Refresh token stored for ${integrationId} (${config.refreshTokenKey})`);
    }

    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[oauth] Token exchange error for ${integrationId}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Refresh an expired access token using the stored refresh token.
 * Only works if `refresh_token_key` is configured for this integration.
 * Returns true if refresh succeeded, false otherwise.
 */
export async function refreshAccessToken(integrationId: string): Promise<boolean> {
  const config = await getOAuthConfig(integrationId);
  if (!config || !config.refreshTokenKey) {
    return false;
  }

  const clientId = await getCredential(config.clientIdKey);
  const clientSecret = await getCredential(config.clientSecretKey);
  const refreshToken = await getCredential(config.refreshTokenKey);

  if (!clientId || !clientSecret || !refreshToken) {
    console.error(`[oauth] Missing credentials for token refresh (${integrationId})`);
    return false;
  }

  try {
    console.log(`[oauth] Refreshing access token for ${integrationId}`);

    const headers: Record<string, string> = {};
    let body: string;

    if (config.tokenAuthMethod === 'basic') {
      headers['Authorization'] = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
    }

    if (config.tokenContentType === 'json') {
      headers['Content-Type'] = 'application/json';
      const jsonBody: Record<string, string> = {
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      };
      if (config.tokenAuthMethod !== 'basic') {
        jsonBody.client_id = clientId;
        jsonBody.client_secret = clientSecret;
      }
      body = JSON.stringify(jsonBody);
    } else {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      const formBody: Record<string, string> = {
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      };
      if (config.tokenAuthMethod !== 'basic') {
        formBody.client_id = clientId;
        formBody.client_secret = clientSecret;
      }
      body = new URLSearchParams(formBody).toString();
    }

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers,
      body,
    });

    const data = await response.json() as Record<string, unknown>;

    if (data.error || data.ok === false) {
      const errorMsg = (data.error_description || data.error || 'Token refresh failed') as string;
      console.error(`[oauth] Token refresh failed for ${integrationId}:`, errorMsg);
      return false;
    }

    const accessToken = resolveField(data, config.tokenResponseField) as string | undefined;
    if (!accessToken) {
      return false;
    }

    // Store new access token
    await setCredential(config.tokenKey, accessToken, 'oauth');
    console.log(`[oauth] Access token refreshed for ${integrationId}`);

    // Some providers rotate refresh tokens
    if (data.refresh_token) {
      await setCredential(config.refreshTokenKey, data.refresh_token as string, 'oauth');
      console.log(`[oauth] Refresh token rotated for ${integrationId}`);
    }

    return true;
  } catch (err) {
    console.error(`[oauth] Token refresh error for ${integrationId}:`, err);
    return false;
  }
}

/**
 * Check if an integration is connected (access token exists in vault).
 */
export async function isOAuthConnected(integrationId: string): Promise<boolean> {
  const config = await getOAuthConfig(integrationId);
  if (!config) return false;

  const token = await getCredential(config.tokenKey);
  return token !== null;
}

/**
 * Disconnect an OAuth integration by removing its tokens from the vault.
 */
export async function disconnectOAuth(integrationId: string): Promise<void> {
  const config = await getOAuthConfig(integrationId);
  if (!config) return;

  await deleteCredential(config.tokenKey);
  console.log(`[oauth] Access token removed for ${integrationId}`);

  if (config.refreshTokenKey) {
    await deleteCredential(config.refreshTokenKey);
    console.log(`[oauth] Refresh token removed for ${integrationId}`);
  }
}
