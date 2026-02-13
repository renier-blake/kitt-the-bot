/**
 * KITT Asana Integration
 *
 * Asana-specific helpers: authenticated fetch with auto-refresh,
 * connection test, and workspace discovery.
 */

import { getCredential } from '../credentials/index.js';
import { refreshAccessToken } from './oauth.js';

const ASANA_BASE_URL = 'https://app.asana.com/api/1.0';

let cachedWorkspaceGid: string | null = null;

/**
 * Get the best available Asana token.
 * PAT takes priority (team/service use), then OAuth access token.
 */
export async function getAsanaToken(): Promise<string | null> {
  const pat = await getCredential('ASANA_PAT');
  if (pat) return pat;

  const oauthToken = await getCredential('ASANA_ACCESS_TOKEN');
  return oauthToken;
}

/**
 * Check if we're using a PAT (vs OAuth token).
 */
async function isUsingPat(): Promise<boolean> {
  const pat = await getCredential('ASANA_PAT');
  return pat !== null;
}

/**
 * Authenticated fetch wrapper for the Asana API.
 * - Injects Bearer token from vault
 * - Auto-refreshes OAuth token on 401 (not for PAT)
 * - Unwraps Asana's { data: ... } response envelope
 */
export async function asanaFetch<T = unknown>(
  endpoint: string,
  options: {
    method?: string;
    data?: Record<string, unknown>;
    params?: Record<string, string>;
  } = {}
): Promise<T> {
  const { method = 'GET', data, params } = options;

  const token = await getAsanaToken();
  if (!token) {
    throw new Error('Asana not connected. Set up OAuth or PAT in Portal → Integrations.');
  }

  const doFetch = async (bearerToken: string): Promise<Response> => {
    let url = `${ASANA_BASE_URL}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Accept': 'application/json',
      },
    };

    if (data && method !== 'GET') {
      fetchOptions.headers = {
        ...fetchOptions.headers as Record<string, string>,
        'Content-Type': 'application/json',
      };
      fetchOptions.body = JSON.stringify({ data });
    }

    return fetch(url, fetchOptions);
  };

  let response = await doFetch(token);

  // Auto-refresh on 401 if using OAuth (not PAT)
  if (response.status === 401 && !(await isUsingPat())) {
    console.log('[asana] Token expired, refreshing...');
    const refreshed = await refreshAccessToken('asana');
    if (refreshed) {
      const newToken = await getCredential('ASANA_ACCESS_TOKEN');
      if (newToken) {
        response = await doFetch(newToken);
      }
    }

    if (response.status === 401) {
      throw new Error('Asana token expired and refresh failed. Reconnect via Portal.');
    }
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Asana API error ${response.status}: ${errorBody}`);
  }

  const json = await response.json() as { data: T };
  return json.data;
}

/**
 * Test the Asana connection by calling GET /users/me.
 * Returns workspace and user info if successful.
 */
export async function testAsanaConnection(): Promise<{
  ok: boolean;
  workspace?: string;
  user?: string;
  error?: string;
}> {
  const token = await getAsanaToken();
  if (!token) {
    return { ok: false, error: 'No token configured (OAuth or PAT)' };
  }

  try {
    const me = await asanaFetch<{
      name: string;
      email: string;
      workspaces: Array<{ gid: string; name: string }>;
    }>('/users/me');

    const workspace = me.workspaces?.[0]?.name || 'Unknown';
    console.log(`[asana] Connection test OK: ${workspace} (user: ${me.name})`);

    return {
      ok: true,
      workspace,
      user: me.name,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[asana] Connection test failed:', errorMsg);
    return { ok: false, error: errorMsg };
  }
}

/**
 * Get the workspace GID (cached after first call).
 * Uses the first workspace from /users/me.
 */
export async function getWorkspaceGid(): Promise<string> {
  if (cachedWorkspaceGid) return cachedWorkspaceGid;

  const me = await asanaFetch<{
    workspaces: Array<{ gid: string; name: string }>;
  }>('/users/me');

  if (!me.workspaces?.length) {
    throw new Error('No Asana workspaces found for this account.');
  }

  cachedWorkspaceGid = me.workspaces[0].gid;
  return cachedWorkspaceGid;
}
