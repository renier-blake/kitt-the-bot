/**
 * KITT Slack Integration
 *
 * Slack-specific helpers for the User Token + Events API architecture.
 * Used by PAS-05 (Slack adapter) to get credentials.
 */

import { WebClient } from '@slack/web-api';
import { getCredential } from '../credentials/index.js';

/**
 * Get Slack credentials needed for the Events API adapter.
 * Returns null if user token is missing (graceful).
 */
export async function getSlackCredentials(): Promise<{
  userToken: string;
  signingSecret: string;
} | null> {
  const userToken = await getCredential('SLACK_USER_TOKEN');
  const signingSecret = await getCredential('SLACK_SIGNING_SECRET');

  if (!userToken || !signingSecret) {
    return null;
  }

  return { userToken, signingSecret };
}

/**
 * Check if Slack is fully configured (user token + signing secret).
 */
export async function isSlackConfigured(): Promise<boolean> {
  const creds = await getSlackCredentials();
  return creds !== null;
}

/**
 * Test the Slack connection by calling auth.test with the user token.
 * Returns user/workspace info if successful.
 */
export async function testSlackConnection(): Promise<{
  ok: boolean;
  team?: string;
  user?: string;
  error?: string;
}> {
  const userToken = await getCredential('SLACK_USER_TOKEN');
  if (!userToken) {
    return { ok: false, error: 'User token not configured' };
  }

  try {
    const client = new WebClient(userToken);
    const result = await client.auth.test();

    if (!result.ok) {
      return { ok: false, error: result.error || 'auth.test failed' };
    }

    console.log(`[slack] Connection test OK: ${result.team} (user: ${result.user})`);

    return {
      ok: true,
      team: result.team,
      user: result.user,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[slack] Connection test failed:', errorMsg);
    return { ok: false, error: errorMsg };
  }
}
