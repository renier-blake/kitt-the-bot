/**
 * In-memory per-chat message queue.
 *
 * When the router is already processing a message for a given chatId,
 * new incoming messages are queued here. After the current processing
 * cycle completes, queued messages are drained and batched together
 * so Opus receives them all at once instead of processing stale messages
 * one by one.
 */

import type { IncomingMessage } from './adapters/types.js';
import { log } from './logger.js';

interface QueuedMessage {
  message: IncomingMessage;
  queuedAt: number;
}

const MAX_QUEUE_SIZE = 10;

export class MessageQueue {
  private queue: Map<string, QueuedMessage[]> = new Map();

  /**
   * Add a message to the queue for a given chatId.
   */
  enqueue(message: IncomingMessage): void {
    const existing = this.queue.get(message.chatId) || [];

    if (existing.length >= MAX_QUEUE_SIZE) {
      log.warn('Message queue full, dropping oldest message', {
        chatId: message.chatId,
        queueSize: existing.length,
      });
      existing.shift();
    }

    existing.push({ message, queuedAt: Date.now() });
    this.queue.set(message.chatId, existing);

    log.info('Message queued', {
      chatId: message.chatId,
      queueSize: existing.length,
    });
  }

  /**
   * Drain all queued messages for a chatId, combining them into
   * a single IncomingMessage with combined content.
   * Returns null if the queue is empty.
   */
  drain(chatId: string): IncomingMessage | null {
    const queued = this.queue.get(chatId);
    if (!queued || queued.length === 0) return null;

    this.queue.delete(chatId);

    // If only one message, return it as-is
    if (queued.length === 1) {
      return queued[0].message;
    }

    // Combine multiple messages into one
    const combinedContent = queued
      .map((q) => q.message.content)
      .join('\n\n');

    // Use the last message as the base (most recent metadata)
    const lastMessage = queued[queued.length - 1].message;

    log.info('Messages drained and batched', {
      chatId,
      messageCount: queued.length,
      combinedLength: combinedContent.length,
    });

    return {
      ...lastMessage,
      content: combinedContent,
    };
  }

  /**
   * Check if there are queued messages for a chatId.
   */
  hasMessages(chatId: string): boolean {
    return (this.queue.get(chatId)?.length || 0) > 0;
  }

  /**
   * Get the queue size for a chatId.
   */
  size(chatId: string): number {
    return this.queue.get(chatId)?.length || 0;
  }
}
