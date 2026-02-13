/**
 * KITT Notion Integration
 *
 * Notion-specific helpers: authenticated fetch with Notion-Version header,
 * auto-refresh on 401, connection test.
 */

import { getCredential } from '../credentials/index.js';
import { refreshAccessToken } from './oauth.js';

const NOTION_BASE_URL = 'https://api.notion.com';
const NOTION_VERSION = '2022-06-28';

/**
 * Get the best available Notion token.
 * Internal Integration Token takes priority, then OAuth access token.
 */
export async function getNotionToken(): Promise<string | null> {
  const internal = await getCredential('NOTION_INTERNAL_TOKEN');
  if (internal) return internal;

  const oauthToken = await getCredential('NOTION_ACCESS_TOKEN');
  return oauthToken;
}

/**
 * Check if we're using an Internal Integration Token (vs OAuth).
 */
async function isUsingInternalToken(): Promise<boolean> {
  const token = await getCredential('NOTION_INTERNAL_TOKEN');
  return token !== null;
}

/**
 * Authenticated fetch wrapper for the Notion API.
 * - Injects Bearer token + Notion-Version header
 * - Auto-refreshes OAuth token on 401 (not for Internal Token)
 * - Handles Notion's response format (no envelope for single objects, { results } for lists)
 */
export async function notionFetch<T = unknown>(
  endpoint: string,
  options: {
    method?: string;
    data?: Record<string, unknown>;
    params?: Record<string, string>;
  } = {}
): Promise<T> {
  const { method = 'GET', data, params } = options;

  const token = await getNotionToken();
  if (!token) {
    throw new Error('Notion not connected. Set up OAuth or Internal Token in Portal → Integrations.');
  }

  const doFetch = async (bearerToken: string): Promise<Response> => {
    let url = `${NOTION_BASE_URL}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Notion-Version': NOTION_VERSION,
        'Accept': 'application/json',
      },
    };

    if (data && method !== 'GET') {
      fetchOptions.headers = {
        ...fetchOptions.headers as Record<string, string>,
        'Content-Type': 'application/json',
      };
      fetchOptions.body = JSON.stringify(data);
    }

    return fetch(url, fetchOptions);
  };

  let response = await doFetch(token);

  // Auto-refresh on 401 if using OAuth (not Internal Token)
  if (response.status === 401 && !(await isUsingInternalToken())) {
    console.log('[notion] Token expired, refreshing...');
    const refreshed = await refreshAccessToken('notion');
    if (refreshed) {
      const newToken = await getCredential('NOTION_ACCESS_TOKEN');
      if (newToken) {
        response = await doFetch(newToken);
      }
    }

    if (response.status === 401) {
      throw new Error('Notion token expired and refresh failed. Reconnect via Portal.');
    }
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Notion API error ${response.status}: ${errorBody}`);
  }

  // Notion returns 200 with empty body for some DELETE operations
  const text = await response.text();
  if (!text) return {} as T;

  return JSON.parse(text) as T;
}

/**
 * Test the Notion connection by calling GET /v1/users/me.
 * Returns bot info and workspace name if successful.
 */
export async function testNotionConnection(): Promise<{
  ok: boolean;
  workspace?: string;
  user?: string;
  error?: string;
}> {
  const token = await getNotionToken();
  if (!token) {
    return { ok: false, error: 'No token configured (OAuth or Internal Token)' };
  }

  try {
    const me = await notionFetch<{
      type: string;
      bot: {
        owner: { type: string; workspace?: boolean };
        workspace_name?: string;
      };
      name: string;
    }>('/v1/users/me');

    const workspace = me.bot?.workspace_name || 'Unknown';
    console.log(`[notion] Connection test OK: ${workspace} (bot: ${me.name})`);

    return {
      ok: true,
      workspace,
      user: me.name,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[notion] Connection test failed:', errorMsg);
    return { ok: false, error: errorMsg };
  }
}
