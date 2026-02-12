/**
 * Credential Vault Types
 */

export interface CredentialMeta {
  key: string;
  category: string;
  description: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CredentialEntry {
  key: string;
  valueEncrypted: Buffer;
  iv: Buffer;
  authTag: Buffer;
  category: string;
  description: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface MigrationResult {
  migrated: string[];
  skipped: string[];
  failed: Array<{ key: string; error: string }>;
}

/** Known credential categories */
export type CredentialCategory = 'api_key' | 'oauth' | 'token' | 'credentials' | 'other';

/** Registry of known credentials with metadata */
export const KNOWN_CREDENTIALS: Record<string, { category: CredentialCategory; description: string }> = {
  TELEGRAM_BOT_TOKEN: { category: 'token', description: 'Telegram Bot API token (from @BotFather)' },
  OPENAI_API_KEY: { category: 'api_key', description: 'OpenAI API key for embeddings and transcription' },
  GOOGLE_CLOUD_TTS_API_KEY: { category: 'api_key', description: 'Google Cloud TTS API key for voice messages' },
  FAL_KEY: { category: 'api_key', description: 'fal.ai API key for image generation' },
  NANGO_SECRET_KEY: { category: 'api_key', description: 'Nango secret key for OAuth integrations' },
  PODBEAN_CLIENT_ID: { category: 'oauth', description: 'Podbean OAuth client ID' },
  PODBEAN_CLIENT_SECRET: { category: 'oauth', description: 'Podbean OAuth client secret' },
  GOOGLE_CLIENT_ID: { category: 'oauth', description: 'Google OAuth client ID' },
  GOOGLE_CLIENT_SECRET: { category: 'oauth', description: 'Google OAuth client secret' },
  SLACK_CLIENT_ID: { category: 'oauth', description: 'Slack App Client ID' },
  SLACK_CLIENT_SECRET: { category: 'oauth', description: 'Slack App Client Secret' },
  SLACK_APP_TOKEN: { category: 'token', description: 'Slack App-Level Token for Socket Mode (xapp-...)' },
  SLACK_BOT_TOKEN: { category: 'token', description: 'Slack Bot Token (xoxb-...) — obtained via OAuth' },
  SLACK_USER_TOKEN: { category: 'token', description: 'Slack User Token (xoxp-...) for sending as user' },
  SLACK_SIGNING_SECRET: { category: 'api_key', description: 'Slack Signing Secret for Events API verification' },
  CLOUDFLARE_TUNNEL_TOKEN: { category: 'token', description: 'Cloudflare Tunnel token for Slack Events API webhook' },
};

/** Keys that are secrets (should go in vault). Everything else is config. */
export const SECRET_KEYS = Object.keys(KNOWN_CREDENTIALS);
