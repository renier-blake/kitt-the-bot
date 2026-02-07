/**
 * KITT Bridge Types
 * Shared type definitions for the message bridge
 */

/**
 * Incoming message format (written to inbox/)
 */
export interface InboxMessage {
  /** Unique message ID (UUID) */
  id: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Source channel */
  channel: 'telegram' | 'whatsapp' | 'email';
  /** Chat/conversation ID */
  chatId: string;
  /** User ID from the platform */
  userId: string;
  /** Username (e.g., @username) if available */
  username?: string;
  /** Display name (first + last name) */
  displayName: string;
  /** Message text content */
  content: string;
  /** ID of message being replied to, if any */
  replyTo?: string;
  /** Is this a group chat? */
  isGroup: boolean;
  /** Group name if applicable */
  groupName?: string;
  /** Original message object from platform */
  raw: unknown;
}

/**
 * Outgoing message format (read from outbox/)
 */
export interface OutboxMessage {
  /** Unique response ID */
  id: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Target chat ID */
  chatId: string;
  /** Response text content */
  content: string;
  /** Message ID to reply to, if any */
  replyToMessageId?: number;
  /** Text parse mode */
  parseMode?: 'HTML' | 'Markdown';
}

/**
 * Bridge state persisted to disk
 */
export interface BridgeState {
  /** When the bridge was last started */
  startedAt: string;
  /** Timestamp of last processed message */
  lastMessageTimestamp: number;
  /** Per-chat state tracking */
  chats: Record<string, ChatState>;
}

/**
 * Per-chat state
 */
export interface ChatState {
  /** Chat ID */
  chatId: string;
  /** ISO 8601 timestamp of last activity */
  lastActivity: string;
  /** Total messages received */
  messageCount: number;
  /** Display name or group name */
  name: string;
}

/**
 * Logger interface for structured logging
 */
export interface Logger {
  info: (msg: string, data?: Record<string, unknown>) => void;
  error: (msg: string, data?: Record<string, unknown>) => void;
  warn: (msg: string, data?: Record<string, unknown>) => void;
  debug: (msg: string, data?: Record<string, unknown>) => void;
}
