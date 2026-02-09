/**
 * Channel Adapter Types
 * Unified interface for multi-channel messaging (Telegram, WhatsApp, Slack, etc.)
 */

/**
 * Supported channels
 */
export type ChannelType = 'telegram' | 'whatsapp' | 'slack';

/**
 * Options for sending messages
 */
export interface SendOptions {
  /** ID of message to reply to (platform-specific format) */
  replyToMessageId?: string | number;
  /** Text parse mode */
  parseMode?: 'HTML' | 'Markdown' | 'plain';
  /** Send as voice message instead of text */
  asVoice?: boolean;
}

/**
 * Incoming message from any channel (normalized)
 */
export interface IncomingMessage {
  /** Channel-prefixed chat ID: telegram:123456, whatsapp:31612345@s.whatsapp.net */
  chatId: string;
  /** Platform-specific user ID */
  userId: string;
  /** Username (@username format) if available */
  username?: string;
  /** Display name (first + last name) */
  displayName: string;
  /** Message text content (or transcribed voice) */
  content: string;
  /** ID of message being replied to, if any */
  replyTo?: string;
  /** Is this a group chat? */
  isGroup: boolean;
  /** Group name if applicable */
  groupName?: string;
  /** Is this a voice message? */
  isVoice?: boolean;
  /** Voice message duration in seconds */
  voiceDuration?: number;
  /** Platform-specific message ID */
  messageId?: string | number;
  /** Original message object from platform */
  raw: unknown;
}

/**
 * Unified channel adapter interface
 * All channel implementations (Telegram, WhatsApp, Slack) must implement this
 */
export interface ChannelAdapter {
  /** Channel identifier */
  readonly channel: ChannelType;

  /** Human-readable channel name */
  readonly displayName: string;

  /**
   * Start listening for messages
   * Should be called once during bridge startup
   */
  start(): Promise<void>;

  /**
   * Stop and cleanup resources
   * Should be called during graceful shutdown
   */
  stop(): Promise<void>;

  /**
   * Send a text message to a chat
   * @param chatId Channel-prefixed chat ID (e.g., telegram:123456)
   * @param content Message text content
   * @param options Optional send options (reply, parse mode)
   */
  sendMessage(chatId: string, content: string, options?: SendOptions): Promise<void>;

  /**
   * Send a voice message to a chat
   * @param chatId Channel-prefixed chat ID
   * @param audioBuffer Audio data (mp3 or ogg)
   */
  sendVoice?(chatId: string, audioBuffer: Buffer): Promise<void>;

  /**
   * Check if the adapter is connected and ready
   */
  isConnected(): boolean;

  /**
   * Get connection status details
   */
  getStatus(): AdapterStatus;
}

/**
 * Adapter status for health monitoring
 */
export interface AdapterStatus {
  /** Is the adapter connected? */
  connected: boolean;
  /** When was it started? (ISO 8601) */
  startedAt: string | null;
  /** Uptime in seconds */
  uptime: number;
  /** Last error message, if any */
  lastError?: string;
  /** Channel-specific status info */
  details?: Record<string, unknown>;
}

/**
 * Message router callback
 * Called by adapters when a message arrives
 */
export type MessageHandler = (message: IncomingMessage) => Promise<void>;

/**
 * Helper to extract channel from prefixed chat ID
 * @example extractChannel('telegram:123456') => 'telegram'
 */
export function extractChannel(chatId: string): ChannelType | null {
  const [channel] = chatId.split(':');
  if (['telegram', 'whatsapp', 'slack'].includes(channel)) {
    return channel as ChannelType;
  }
  return null;
}

/**
 * Helper to extract raw ID from prefixed chat ID
 * @example extractRawId('telegram:123456') => '123456'
 */
export function extractRawId(chatId: string): string {
  const colonIndex = chatId.indexOf(':');
  if (colonIndex === -1) return chatId;
  return chatId.slice(colonIndex + 1);
}

/**
 * Helper to create prefixed chat ID
 * @example prefixChatId('telegram', '123456') => 'telegram:123456'
 */
export function prefixChatId(channel: ChannelType, rawId: string): string {
  return `${channel}:${rawId}`;
}
