/**
 * KITT Slack Bot Adapter
 * Implements ChannelAdapter interface for Slack using Bot Token + Socket Mode.
 *
 * Uses @slack/bolt with Socket Mode — no tunnel or public URL needed.
 * Messages appear with "APP" label (bot identity).
 *
 * Can run alongside the Slack User adapter (different channel type: 'slack-bot').
 */

import { App } from '@slack/bolt';
import type { ChannelAdapter, IncomingMessage, SendOptions, AdapterStatus } from './types.js';
import { prefixChatId, extractRawId } from './types.js';
import { getRouter } from '../router.js';
import { log } from '../logger.js';
import { formatForSlack, splitMessage } from '../format.js';
import { getCredential } from '../../credentials/index.js';
import { getMetaValue } from '../../capabilities/index.js';
import { getMemoryService } from '../../memory/index.js';

// --- Permission system (shared pattern with Slack User adapter) ---

type SlackBotPermission = 'respond' | 'read-only' | 'blocked';

let permissionCache: Record<string, SlackBotPermission> | null = null;
let permissionCacheTimestamp = 0;
const PERMISSION_CACHE_TTL = 30_000;

async function getUserPermission(userId: string, ownBotId: string | null): Promise<SlackBotPermission> {
  if (userId === ownBotId) return 'respond';

  const now = Date.now();
  if (!permissionCache || now - permissionCacheTimestamp > PERMISSION_CACHE_TTL) {
    try {
      const raw = await getMetaValue('slack_bot_allowed_users');
      if (raw) {
        permissionCache = JSON.parse(raw);
      } else {
        permissionCache = null;
      }
    } catch {
      permissionCache = null;
    }
    permissionCacheTimestamp = now;
  }

  if (!permissionCache) return 'respond';
  return permissionCache[userId] || 'blocked';
}

export class SlackBotAdapter implements ChannelAdapter {
  readonly channel = 'slack-bot' as const;
  readonly displayName = 'Slack Bot';

  private app: App | null = null;
  private botUserId: string | null = null;
  private teamName: string | null = null;
  private botName: string | null = null;
  private startedAt: Date | null = null;
  private lastError: string | null = null;

  // User info cache (5 min TTL)
  private userCache: Map<string, { displayName: string; username?: string; expiry: number }> =
    new Map();

  // Thread tracking for channel replies
  private threadMap: Map<string, string> = new Map();

  async start(): Promise<void> {
    const botToken = await getCredential('SLACK_BOT_TOKEN');
    const appToken = await getCredential('SLACK_APP_TOKEN');

    if (!botToken) {
      throw new Error('SLACK_BOT_TOKEN is not set in vault');
    }
    if (!appToken) {
      throw new Error('SLACK_APP_TOKEN is not set in vault');
    }

    this.app = new App({
      token: botToken,
      appToken,
      socketMode: true,
      // Disable built-in logging — we use our own
      logLevel: undefined,
    });

    // Register message handler (for DMs — message.im events)
    this.app.message(async ({ message }) => {
      try {
        // Type guard: only handle regular messages
        if (message.subtype) return;
        if (!('user' in message) || !('text' in message)) return;

        const event = message as {
          user: string;
          text: string;
          channel: string;
          channel_type: string;
          ts: string;
          thread_ts?: string;
          bot_id?: string;
        };

        // Ignore bot messages (including ourselves)
        if (event.bot_id) return;

        await this.handleMessage(event);
      } catch (err) {
        log.error('Slack Bot message handler error', { error: String(err) });
      }
    });

    // Register app_mention handler (for @mentions in channels)
    this.app.event('app_mention', async ({ event }) => {
      try {
        if (!event.user || !event.text) return;

        await this.handleMessage({
          user: event.user,
          text: event.text,
          channel: event.channel,
          channel_type: 'channel', // app_mention only fires in channels
          ts: event.ts,
          thread_ts: event.thread_ts,
        });
      } catch (err) {
        log.error('Slack Bot app_mention handler error', { error: String(err) });
      }
    });

    // Start the app (connects via WebSocket)
    await this.app.start();

    // Get bot identity
    const authResult = await this.app.client.auth.test();
    this.botUserId = authResult.user_id as string;
    this.teamName = authResult.team as string;
    this.botName = authResult.user as string;
    this.startedAt = new Date();

    log.info('Slack Bot adapter started', {
      bot: this.botName,
      botUserId: this.botUserId,
      team: this.teamName,
      mode: 'socket',
    });
  }

  async stop(): Promise<void> {
    if (this.app) {
      await this.app.stop();
      this.app = null;
    }
    this.botUserId = null;
    this.startedAt = null;
    this.userCache.clear();
    this.threadMap.clear();
    log.info('Slack Bot adapter stopped');
  }

  async sendMessage(chatId: string, content: string, options?: SendOptions): Promise<void> {
    if (!this.app) {
      throw new Error('Slack Bot not initialized');
    }

    const rawChannelId = extractRawId(chatId);
    const formatted = formatForSlack(content);
    const chunks = splitMessage(formatted, 4000);

    for (const chunk of chunks) {
      const threadTs = options?.replyToMessageId || this.threadMap.get(rawChannelId);

      await this.app.client.chat.postMessage({
        channel: rawChannelId,
        text: chunk,
        ...(threadTs ? { thread_ts: String(threadTs) } : {}),
      });
    }

    log.info('Sent Slack Bot message', { chatId, length: content.length });
  }

  isConnected(): boolean {
    return this.app !== null && this.startedAt !== null;
  }

  getStatus(): AdapterStatus {
    return {
      connected: this.isConnected(),
      startedAt: this.startedAt?.toISOString() || null,
      uptime: this.startedAt ? Math.floor((Date.now() - this.startedAt.getTime()) / 1000) : 0,
      lastError: this.lastError || undefined,
      details: this.botUserId
        ? {
            bot: this.botName,
            botUserId: this.botUserId,
            team: this.teamName,
            mode: 'socket',
          }
        : undefined,
    };
  }

  // --- Internal message handler ---

  private async handleMessage(event: {
    user: string;
    text: string;
    channel: string;
    channel_type: string;
    ts: string;
    thread_ts?: string;
  }): Promise<void> {
    const userId = event.user;
    const content = event.text;
    if (!content) return;

    // Check permission
    const permission = await getUserPermission(userId, this.botUserId);
    if (permission === 'blocked') {
      log.warn('Slack Bot message from blocked user', { userId });
      return;
    }

    const isDM = event.channel_type === 'im';
    const isGroup = !isDM;

    // In channels, only respond if @mentioned
    if (isGroup && this.botUserId && !content.includes(`<@${this.botUserId}>`)) {
      return;
    }

    // Clean up content: strip @mentions
    const cleanContent = content.replace(/<@[A-Z0-9]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!cleanContent) return;

    // Track thread for channel replies
    if (isGroup) {
      this.threadMap.set(event.channel, event.ts);
    }

    const chatId = prefixChatId('slack-bot', event.channel);
    const userInfo = await this.getUserInfo(userId);

    // Read-only: store in memory but don't route to agent
    if (permission === 'read-only') {
      log.info('Stored read-only Slack Bot message (not responding)', {
        chatId,
        from: userInfo.displayName,
        isDM,
        preview: cleanContent.slice(0, 50),
      });

      try {
        const memory = getMemoryService();
        await memory.storeMessage({
          sessionId: chatId,
          channel: 'slack-bot',
          role: 'user',
          type: 'message',
          content: `[Slack Bot from ${userInfo.displayName}]: ${cleanContent}`,
          metadata: {
            userId,
            displayName: userInfo.displayName,
            readOnly: true,
            isDM,
            messageId: event.ts,
          },
        });
      } catch (err) {
        log.error('Failed to store read-only Slack Bot message', { error: String(err) });
      }
      return;
    }

    log.info('Processing Slack Bot message', {
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

  private async getUserInfo(
    userId: string
  ): Promise<{ displayName: string; username?: string }> {
    const cached = this.userCache.get(userId);
    if (cached && cached.expiry > Date.now()) {
      return { displayName: cached.displayName, username: cached.username };
    }

    try {
      if (this.app) {
        const result = await this.app.client.users.info({ user: userId });
        if (result.ok && result.user) {
          const displayName = result.user.real_name || result.user.name || userId;
          const username = result.user.name;
          this.userCache.set(userId, {
            displayName,
            username,
            expiry: Date.now() + 5 * 60 * 1000,
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

export function createSlackBotAdapter(): SlackBotAdapter {
  return new SlackBotAdapter();
}
