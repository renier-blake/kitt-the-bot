/**
 * KITT Slack Adapter
 * Implements ChannelAdapter interface for Slack using User Token + Events API.
 *
 * Events arrive via HTTP webhook (see slack-events.ts), not via internal polling.
 * Messages are sent using the user token, so they appear as a regular Slack user.
 */

import { WebClient } from '@slack/web-api';
import type { ChannelAdapter, IncomingMessage, SendOptions, AdapterStatus } from './types.js';
import { prefixChatId, extractRawId } from './types.js';
import { getRouter } from '../router.js';
import { log } from '../logger.js';
import { formatForSlack, splitMessage } from '../format.js';
import { getCredential } from '../../credentials/index.js';
import { getMetaValue } from '../../capabilities/index.js';
import { getMemoryService } from '../../memory/index.js';

/**
 * Check if a Slack channel is a DM.
 */
function isDirectMessage(channelType: string | undefined): boolean {
  return channelType === 'im';
}

/**
 * Check if the bot is mentioned in the message text.
 * Slack mentions look like <@U1234567890> in the raw text.
 */
function isMentioned(text: string, userId: string): boolean {
  return text.includes(`<@${userId}>`);
}

/**
 * Strip all @mentions from message text and clean up whitespace.
 */
function stripMentions(text: string): string {
  return text.replace(/<@[A-Z0-9]+>/g, '').replace(/\s+/g, ' ').trim();
}

// --- Permission system (database-backed, like WhatsApp) ---

export type SlackPermission = 'respond' | 'read-only' | 'blocked';

/** Cache for allowed users config (30s TTL) */
let permissionCache: Record<string, SlackPermission> | null = null;
let permissionCacheTimestamp = 0;
const PERMISSION_CACHE_TTL = 30_000;

/**
 * Get permission level for a Slack user.
 * Config stored in meta table as 'slack_allowed_users' JSON:
 *   { "U12345": "respond", "U67890": "read-only" }
 *
 * If no config exists, all users get 'respond' (backwards compatible).
 * If config exists but user is not listed, they get 'blocked'.
 */
async function getUserPermission(userId: string, ownUserId: string | null): Promise<SlackPermission> {
  // Own user always gets respond (prevent self-block)
  if (userId === ownUserId) return 'respond';

  const now = Date.now();
  if (!permissionCache || now - permissionCacheTimestamp > PERMISSION_CACHE_TTL) {
    try {
      const raw = await getMetaValue('slack_allowed_users');
      if (raw) {
        permissionCache = JSON.parse(raw);
      } else {
        permissionCache = null; // No config = allow all
      }
    } catch {
      permissionCache = null;
    }
    permissionCacheTimestamp = now;
  }

  // No config → everyone allowed (backwards compatible)
  if (!permissionCache) return 'respond';

  return permissionCache[userId] || 'blocked';
}

/** Slack Events API message event shape */
export interface SlackMessageEvent {
  type: 'message';
  subtype?: string;
  channel: string;
  channel_type: 'im' | 'channel' | 'group' | 'mpim';
  user: string;
  text: string;
  ts: string;
  bot_id?: string;
  thread_ts?: string;
}

export class SlackAdapter implements ChannelAdapter {
  readonly channel = 'slack' as const;
  readonly displayName = 'Slack';

  private client: WebClient | null = null;
  private userId: string | null = null;
  private teamName: string | null = null;
  private userName: string | null = null;
  private startedAt: Date | null = null;
  private lastError: string | null = null;

  // User info cache (5 min TTL)
  private userCache: Map<string, { displayName: string; username?: string; expiry: number }> =
    new Map();

  // Thread tracking: store last incoming message ts per channel for thread replies
  private threadMap: Map<string, string> = new Map();

  async start(): Promise<void> {
    const userToken = await getCredential('SLACK_USER_TOKEN');
    if (!userToken) {
      throw new Error('SLACK_USER_TOKEN is not set in vault or .env');
    }

    this.client = new WebClient(userToken);

    // Verify connection and get own identity
    const authResult = await this.client.auth.test();
    if (!authResult.ok) {
      throw new Error(`Slack auth.test failed: ${authResult.error}`);
    }

    this.userId = authResult.user_id as string;
    this.teamName = authResult.team as string;
    this.userName = authResult.user as string;
    this.startedAt = new Date();

    log.info('Slack adapter started', {
      user: this.userName,
      userId: this.userId,
      team: this.teamName,
    });
    // NOTE: No polling to start — events arrive via HTTP webhook (slack-events.ts)
  }

  async stop(): Promise<void> {
    this.client = null;
    this.userId = null;
    this.startedAt = null;
    this.userCache.clear();
    this.threadMap.clear();
    log.info('Slack adapter stopped');
  }

  async sendMessage(chatId: string, content: string, options?: SendOptions): Promise<void> {
    if (!this.client) {
      throw new Error('Slack client not initialized');
    }

    const rawChannelId = extractRawId(chatId);
    const formatted = formatForSlack(content);

    // Split long messages (Slack limit is ~40000, but 4000 is best practice)
    const chunks = splitMessage(formatted, 4000);

    for (const chunk of chunks) {
      // Reply in thread if we have a thread_ts for this channel (keeps channels clean)
      const threadTs = options?.replyToMessageId || this.threadMap.get(rawChannelId);

      await this.client.chat.postMessage({
        channel: rawChannelId,
        text: chunk,
        ...(threadTs ? { thread_ts: String(threadTs) } : {}),
      });
    }

    log.info('Sent Slack message', { chatId, length: content.length });
  }

  // No sendVoice — Slack has no native voice messages. Router falls back to text.

  isConnected(): boolean {
    return this.client !== null && this.startedAt !== null;
  }

  getStatus(): AdapterStatus {
    return {
      connected: this.isConnected(),
      startedAt: this.startedAt?.toISOString() || null,
      uptime: this.startedAt ? Math.floor((Date.now() - this.startedAt.getTime()) / 1000) : 0,
      lastError: this.lastError || undefined,
      details: this.userId
        ? {
            user: this.userName,
            userId: this.userId,
            team: this.teamName,
          }
        : undefined,
    };
  }

  /** Get the authenticated user's Slack ID (for filtering self-messages) */
  getUserId(): string | null {
    return this.userId;
  }

  /**
   * Handle an incoming Slack event.
   * Called by the Express route in slack-events.ts — not by internal polling.
   */
  async handleEvent(event: SlackMessageEvent): Promise<void> {
    // Ignore own messages (prevents echo loops)
    if (event.user === this.userId) return;

    // Ignore bot messages
    if (event.subtype === 'bot_message' || event.bot_id) return;

    // Ignore message subtypes (edits, deletes, joins, etc.)
    if (event.subtype) return;

    const content = event.text;
    if (!content) return;

    const userId = event.user;

    // Check user permission (database-backed)
    const permission = await getUserPermission(userId, this.userId);
    if (permission === 'blocked') {
      log.warn('Slack message from blocked user', { userId });
      return;
    }

    const isDM = isDirectMessage(event.channel_type);
    const isGroup = !isDM;

    // In channels, only respond if @mentioned
    if (isGroup && this.userId && !isMentioned(content, this.userId)) {
      return;
    }

    // Clean up content: strip @mentions
    const cleanContent = stripMentions(content);
    if (!cleanContent) return;

    // Track thread for channel replies
    if (isGroup) {
      this.threadMap.set(event.channel, event.ts);
    }

    const chatId = prefixChatId('slack', event.channel);

    // Look up display name (cached)
    const userInfo = await this.getUserInfo(userId);

    // Read-only: store in memory but don't route to agent
    if (permission === 'read-only') {
      log.info('Stored read-only Slack message (not responding)', {
        chatId,
        from: userInfo.displayName,
        isDM,
        preview: cleanContent.slice(0, 50),
      });

      try {
        const memory = getMemoryService();
        await memory.storeMessage({
          sessionId: chatId,
          channel: 'slack',
          role: 'user',
          type: 'message',
          content: `[Slack from ${userInfo.displayName}]: ${cleanContent}`,
          metadata: {
            userId,
            displayName: userInfo.displayName,
            readOnly: true,
            isDM,
            messageId: event.ts,
          },
        });
      } catch (err) {
        log.error('Failed to store read-only Slack message', { error: String(err) });
      }
      return;
    }

    log.info('Processing Slack message', {
      chatId,
      from: userInfo.displayName,
      isDM,
      preview: cleanContent.slice(0, 50),
    });

    const message: IncomingMessage = {
      chatId,
      userId,
      username: userInfo.username,
      displayName: userInfo.displayName,
      content: cleanContent,
      replyTo: event.thread_ts,
      isGroup,
      messageId: event.ts,
      raw: event,
    };

    await getRouter().handleIncoming(message);
  }

  // --- Private methods ---

  private async getUserInfo(
    userId: string
  ): Promise<{ displayName: string; username?: string }> {
    const cached = this.userCache.get(userId);
    if (cached && cached.expiry > Date.now()) {
      return { displayName: cached.displayName, username: cached.username };
    }

    try {
      if (this.client) {
        const result = await this.client.users.info({ user: userId });
        if (result.ok && result.user) {
          const displayName = result.user.real_name || result.user.name || userId;
          const username = result.user.name;
          this.userCache.set(userId, {
            displayName,
            username,
            expiry: Date.now() + 5 * 60 * 1000, // 5 min TTL
          });
          return { displayName, username };
        }
      }
    } catch {
      // Non-critical: fall back to user ID
    }

    return { displayName: userId };
  }
}

export function createSlackAdapter(): SlackAdapter {
  return new SlackAdapter();
}
