/**
 * KITT Message Router
 * Shared message processing for all channels (Telegram, WhatsApp, Slack)
 * Extracts channel-agnostic logic from the channel adapters
 */

import type { ChannelAdapter, IncomingMessage, SendOptions, ChannelType } from './adapters/types.js';
import { extractChannel } from './adapters/types.js';
import { runAgent } from './agent.js';
import { updateChatState, saveState } from './state.js';
import { log } from './logger.js';
import { getMemoryService } from '../memory/index.js';
import type { Channel } from '../memory/types.js';
import { splitMessage } from './format.js';
import { clearAllModes } from '../scheduler/sleep-mode.js';
import { acquireProcessingLock, releaseProcessingLock } from '../scheduler/processing-lock.js';
import { dispatchBackgroundTask } from '../scheduler/background-runner.js';
import { classifyMessage } from './classifier.js';
import { MessageQueue } from './message-queue.js';
import { textToSpeech, analyzeContentForVoice } from './tts.js';


/**
 * ACK messages — sent when agent takes longer than 5 seconds
 */
const ACK_MESSAGES = [
  'Pondering...',
  'Ruminating...',
  'Cogitating...',
  'Schlepping...',
  'Wibbling...',
  'Noodling...',
  'Percolating...',
  'Marinating...',
  'Mulling...',
  'Tinkering...',
  'Rummaging...',
  'Simmering...',
  'Baking...',
  'Thinking...',
  'Cleaning...',
  'Running...',
  'Brewing...',
  'Juggling...',
  'Scribbling...',
  'Crunching...',
  'Vibing...',
  'Stretching...',
  'Daydreaming...',
  'Untangling...',
  'Assembling...',
  'Composting...',
];

/**
 * Memory trigger patterns
 */
const MEMORY_TRIGGERS = [
  'onthoud dit',
  'onthoud dat',
  'remember this',
  'remember that',
  'remember:',
];

/**
 * MessageRouter handles incoming messages from all channels
 * and routes responses back to the correct adapter
 */
export class MessageRouter {
  private adapters: Map<ChannelType, ChannelAdapter> = new Map();
  private startedAt: Date | null = null;
  private queue: MessageQueue = new MessageQueue();
  private processing: Set<string> = new Set();

  /**
   * Register an adapter for a channel
   */
  registerAdapter(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.channel, adapter);
    log.info('Adapter registered', { channel: adapter.channel });
  }

  /**
   * Unregister an adapter
   */
  unregisterAdapter(channel: ChannelType): void {
    this.adapters.delete(channel);
    log.info('Adapter unregistered', { channel });
  }

  /**
   * Get a registered adapter
   */
  getAdapter(channel: ChannelType): ChannelAdapter | undefined {
    return this.adapters.get(channel);
  }

  /**
   * Get all registered adapters
   */
  getAdapters(): ChannelAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Start the router and all registered adapters.
   * Non-critical adapters (Slack, WhatsApp) failing won't crash the bridge.
   */
  async start(): Promise<void> {
    this.startedAt = new Date();
    log.info('Starting router', { adapterCount: this.adapters.size });

    const criticalAdapters = new Set(['telegram']);

    for (const adapter of this.adapters.values()) {
      try {
        await adapter.start();
        log.info('Adapter started', { channel: adapter.channel });
      } catch (err) {
        log.error('Failed to start adapter', {
          channel: adapter.channel,
          error: String(err),
        });

        if (criticalAdapters.has(adapter.channel)) {
          throw err; // Telegram must work — crash the bridge
        }
        // Non-critical adapter: log and continue without it
        log.warn('Adapter disabled due to startup failure', { channel: adapter.channel });
        this.adapters.delete(adapter.channel);
      }
    }
  }

  /**
   * Stop all adapters and the router
   */
  async stop(): Promise<void> {
    log.info('Stopping router');

    for (const adapter of this.adapters.values()) {
      try {
        await adapter.stop();
        log.info('Adapter stopped', { channel: adapter.channel });
      } catch (err) {
        log.error('Failed to stop adapter', {
          channel: adapter.channel,
          error: String(err),
        });
      }
    }

    this.startedAt = null;
  }

  /**
   * Handle an incoming message from any channel.
   * Uses a per-chat message queue: if Opus is already processing for this chat,
   * the message is queued and batched after the current cycle completes.
   */
  async handleIncoming(message: IncomingMessage): Promise<void> {
    const channel = extractChannel(message.chatId);
    if (!channel) {
      log.error('Invalid chat ID format', { chatId: message.chatId });
      return;
    }

    log.info('Incoming message', {
      chatId: message.chatId,
      channel,
      from: message.displayName,
      isGroup: message.isGroup,
      preview: message.content.slice(0, 50),
    });

    // Store user message in memory (always, even if queued)
    const memory = getMemoryService();
    memory.storeMessage({
      sessionId: message.chatId,
      channel: channel as Channel,
      role: 'user',
      content: message.content,
      metadata: {
        userId: message.userId,
        username: message.username,
        displayName: message.displayName,
        chatName: message.groupName || message.displayName,
        isGroup: message.isGroup,
        messageId: message.messageId,
        isVoice: message.isVoice,
        voiceDuration: message.voiceDuration,
      },
    }).catch((err) => {
      log.error('Failed to store user message in memory', { error: String(err) });
    });

    // If already processing for this chat, queue the message
    if (this.processing.has(message.chatId)) {
      this.queue.enqueue(message);
      console.log(`[router] 📥 Message queued for ${message.chatId} (queue: ${this.queue.size(message.chatId)})`);
      return;
    }

    // Mark as processing
    this.processing.add(message.chatId);
    const db = memory.getDb();

    // Wake KITT if sleeping/DND
    if (db) {
      await clearAllModes(db);
      await acquireProcessingLock(db);

      // Track conversation activity for think loop suppression
      await db.execute({
        sql: `INSERT OR REPLACE INTO meta (key, value) VALUES ('last_user_message_at', $1)`,
        args: [String(Date.now())],
      }).catch(() => { /* non-critical */ });
    }

    try {
      // Process the message
      await this.processMessage(message, channel);

      // After processing, drain any queued messages
      while (this.queue.hasMessages(message.chatId)) {
        const batched = this.queue.drain(message.chatId);
        if (batched) {
          console.log(`[router] 📤 Processing queued messages for ${message.chatId}`);

          // Update conversation activity timestamp
          if (db) {
            await db.execute({
              sql: `INSERT OR REPLACE INTO meta (key, value) VALUES ('last_user_message_at', $1)`,
              args: [String(Date.now())],
            }).catch(() => { /* non-critical */ });
          }

          await this.processMessage(batched, channel);
        }
      }
    } finally {
      this.processing.delete(message.chatId);
      if (db) {
        await releaseProcessingLock(db).catch((err) => {
          log.error('Failed to release processing lock', { error: String(err) });
        });
      }
    }
  }

  /**
   * Process a single message through the classifier + Opus agent.
   *
   * Flow:
   * 1. Classifier (GPT-4o-mini, ~300ms) → determines if direct or background
   * 2. If background + high confidence → dispatch skill directly, send ack
   * 3. If direct → full Opus agent for conversational response
   * 4. Opus can still emit BACKGROUND_TASK signal as fallback
   */
  private async processMessage(message: IncomingMessage, channel: string): Promise<void> {
    const memory = getMemoryService();
    const db = memory.getDb();

    log.info('Processing message', {
      chatId: message.chatId,
      channel,
      from: message.displayName,
      preview: message.content.slice(0, 50),
    });

    // --- Step 1: Classifier pre-routing ---
    const classification = await classifyMessage(message.content);

    if (classification.type === 'background' && classification.capability && classification.confidence >= 0.7) {
      // Fast path: dispatch background task directly, skip Opus
      log.info('Classifier routed to background', {
        chatId: message.chatId,
        capability: classification.capability,
        confidence: classification.confidence,
      });

      // Send ack to user immediately
      const ack = classification.ack || `Ik werk eraan...`;
      await this.sendMessage(message.chatId, ack);

      // Store ack in memory
      try {
        await memory.storeMessage({
          sessionId: message.chatId,
          channel: channel as Channel,
          role: 'kitt',
          content: ack,
          metadata: { classifierRouted: true, capability: classification.capability },
        });
      } catch (err) {
        log.error('Failed to store classifier ack in memory', { error: String(err) });
      }

      // Dispatch background task
      const onComplete = async (chatId: string, result: string) => {
        await this.sendMessage(chatId, result);
      };

      await dispatchBackgroundTask({
        chatId: message.chatId,
        channel,
        capabilityId: classification.capability,
        prompt: message.content,
        description: classification.capability,
        onComplete,
      }).catch((err) => {
        log.error('Failed to dispatch classified background task', {
          capability: classification.capability,
          error: err instanceof Error ? err.message : String(err),
        });
      });

      // Update chat state
      updateChatState(message.chatId, message.groupName || message.displayName);
      await saveState();

      return;
    }

    // --- Step 2: Direct path → Opus agent ---

    // ACK: only show for complex messages that need context (skip for casual chat)
    const shouldAck = classification.needsContext || classification.confidence < 0.8;
    let ackSent = false;
    let ackTimer: ReturnType<typeof setTimeout> | undefined;
    if (shouldAck) {
      const ACK_DELAY_MS = 3_000;
      ackTimer = setTimeout(async () => {
        ackSent = true;
        const ack = ACK_MESSAGES[Math.floor(Math.random() * ACK_MESSAGES.length)];
        await this.sendMessage(message.chatId, ack).catch(() => {});
      }, ACK_DELAY_MS);
    }

    // Agent call — timeout is handled by the Agent Pool (90s for chat)
    let response: Awaited<ReturnType<typeof runAgent>>;

    try {
      response = await runAgent(message.content, {
        agentType: 'chat',
        chatId: message.chatId,
        allowedTools: [],
        skipMemorySearch: !classification.needsContext,
        db: db ?? undefined,
      });
    } catch (err) {
      clearTimeout(ackTimer);
      const errorMsg = err instanceof Error ? err.message : String(err);

      // SDK crash (exit code 1, SIGINT): retry once with fresh session
      if (errorMsg.includes('exit code') || errorMsg.includes('SIGINT')) {
        log.warn('Agent SDK crashed, retrying', { chatId: message.chatId, error: errorMsg });
        try {
          response = await runAgent(message.content, {
            agentType: 'chat',
            chatId: message.chatId,
            allowedTools: [],
            skipMemorySearch: !classification.needsContext,
            db: db ?? undefined,
          });
        } catch (retryErr) {
          log.error('Retry also failed', { chatId: message.chatId, error: String(retryErr) });
          await this.sendMessage(message.chatId, 'Even technische problemen, probeer het zo nog eens.');
          return;
        }
      } else {
        log.error('Chat agent failed', { chatId: message.chatId, error: errorMsg });
        await this.sendMessage(message.chatId, 'Sorry, er ging iets mis. Probeer het opnieuw.');
        return;
      }
    }

    clearTimeout(ackTimer);

    if (response.error) {
      log.error('Chat agent failed', { chatId: message.chatId, error: response.error });
      await this.sendMessage(message.chatId, `Sorry, er ging iets mis. Probeer het opnieuw.`);
      return;
    }

    // Update chat state
    const chatName = message.groupName || message.displayName;
    updateChatState(message.chatId, chatName);
    await saveState();

    if (!response.result) {
      log.warn('Chat agent returned empty result', {
        chatId: message.chatId,
        userMessage: message.content.slice(0, 50),
      });
      await this.sendMessage(message.chatId, 'Ik heb je bericht verwerkt.');
      return;
    }

    // Parse response for VOICE_MODE signal (before BACKGROUND_TASK)
    const { message: withoutVoiceSignal, voiceMode } = this.parseVoiceMode(response.result);

    // Store voice mode change if signaled
    if (voiceMode !== undefined && db) {
      const key = `voice_mode_${message.chatId}`;
      await db.execute({
        sql: `INSERT OR REPLACE INTO meta (key, value) VALUES ($1, $2)`,
        args: [key, voiceMode ? 'on' : 'off'],
      }).catch((err) => {
        log.error('Failed to store voice mode', { error: String(err) });
      });
      log.info('Voice mode changed', { chatId: message.chatId, enabled: voiceMode });
    }

    // Parse response for BACKGROUND_TASK signal (Opus fallback — still supported)
    const { message: userMessage, task } = this.parseBackgroundTask(withoutVoiceSignal);

    // Send the organic response to the user
    if (userMessage) {
      await this.sendMessage(message.chatId, userMessage);
    }

    // Store KITT response in memory
    try {
      await memory.storeMessage({
        sessionId: message.chatId,
        channel: channel as Channel,
        role: 'kitt',
        content: userMessage || response.result,
        metadata: {
          inResponseToVoice: message.isVoice,
          hasBackgroundTask: !!task,
        },
      });
    } catch (err) {
      log.error('Failed to store KITT message in memory', { error: String(err) });
    }

    // If KITT requested a background task (Opus fallback), dispatch it
    if (task) {
      log.info('Dispatching background task (Opus signal)', {
        chatId: message.chatId,
        skill: task.skill,
      });

      const onComplete = async (chatId: string, result: string) => {
        await this.sendMessage(chatId, result);
      };

      await dispatchBackgroundTask({
        chatId: message.chatId,
        channel,
        capabilityId: task.skill,
        prompt: task.prompt,
        description: userMessage || `Background task: ${task.skill}`,
        onComplete,
      }).catch((err) => {
        log.error('Failed to dispatch background task', {
          skill: task.skill,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

    // Check for memory triggers (non-blocking)
    this.checkMemoryTriggers(message.content, response.result).catch((err) => {
      log.error('Memory trigger check failed', { error: String(err) });
    });
  }

  /**
   * Send a message to any channel.
   * If voice mode is enabled for this chat, routes through Kokoro TTS.
   */
  async sendMessage(chatId: string, content: string, options?: SendOptions): Promise<void> {
    const channel = extractChannel(chatId);
    if (!channel) {
      log.error('Cannot send: invalid chat ID format', { chatId });
      return;
    }

    const adapter = this.adapters.get(channel);
    if (!adapter) {
      log.error('Cannot send: no adapter for channel', { channel, chatId });
      return;
    }

    // Check if voice mode is enabled for this chat
    const voiceModeEnabled = await this.isVoiceModeEnabled(chatId);

    if (voiceModeEnabled && adapter.sendVoice) {
      const analysis = analyzeContentForVoice(content);

      if (analysis.mode === 'voice' && analysis.voicePart) {
        // Pure conversational → all voice
        const sent = await this.sendAsVoice(chatId, analysis.voicePart, adapter);
        if (sent) return;
        // Fallback to text below
      } else if (analysis.mode === 'mixed' && analysis.textPart && analysis.voicePart) {
        // Mixed: send structured data as text, rest as voice
        const textChunks = splitMessage(analysis.textPart, 4000);
        for (const chunk of textChunks) {
          await adapter.sendMessage(chatId, chunk, options);
        }
        // Then send voice summary
        await this.sendAsVoice(chatId, analysis.voicePart, adapter);
        log.info('Mixed message sent', { chatId, channel, textLength: analysis.textPart.length, voiceLength: analysis.voicePart.length });
        return;
      }
      // mode === 'text' → fall through to normal text sending
    }

    // Text mode (default)
    const chunks = splitMessage(content, 4000);
    for (const chunk of chunks) {
      await adapter.sendMessage(chatId, chunk, options);
    }

    log.info('Message sent', {
      chatId,
      channel,
      length: content.length,
      chunks: chunks.length,
    });
  }

  /**
   * Get router status for health monitoring
   */
  getStatus(): RouterStatus {
    return {
      running: this.startedAt !== null,
      startedAt: this.startedAt?.toISOString() || null,
      uptime: this.startedAt ? Math.floor((Date.now() - this.startedAt.getTime()) / 1000) : 0,
      adapters: Array.from(this.adapters.entries()).map(([channel, adapter]) => ({
        channel,
        displayName: adapter.displayName,
        ...adapter.getStatus(),
      })),
    };
  }

  // --- Private helper methods ---

  /**
   * Parse VOICE_MODE signal from agent response.
   * Format: text + \nVOICE_MODE:on or \nVOICE_MODE:off
   */
  private parseVoiceMode(response: string): {
    message: string;
    voiceMode?: boolean;
  } {
    const signalPattern = /\n?VOICE_MODE:(on|off)\s*$/i;
    const match = response.match(signalPattern);

    if (!match) {
      return { message: response };
    }

    const voiceMode = match[1].toLowerCase() === 'on';
    const message = response.slice(0, match.index).trim();

    log.info('Voice mode signal parsed', { enabled: voiceMode });

    return { message, voiceMode };
  }

  /**
   * Check if voice mode is enabled for a chat
   */
  private async isVoiceModeEnabled(chatId: string): Promise<boolean> {
    try {
      const memory = getMemoryService();
      const db = memory.getDb();
      if (!db) return false;

      const key = `voice_mode_${chatId}`;
      const result = await db.execute({
        sql: `SELECT value FROM meta WHERE key = $1`,
        args: [key],
      });

      return result.rows.length > 0 && result.rows[0].value === 'on';
    } catch {
      return false;
    }
  }

  /**
   * Send content as a voice message via Kokoro TTS.
   * Returns true if voice was sent, false if failed (caller should fallback to text).
   */
  private async sendAsVoice(chatId: string, text: string, adapter: ChannelAdapter): Promise<boolean> {
    if (!adapter.sendVoice) return false;

    try {
      log.info('Generating voice response', { chatId, textLength: text.length });

      const ttsResult = await textToSpeech(text);

      if (!ttsResult.success || ttsResult.audio.length === 0) {
        log.error('TTS failed, falling back to text', { error: ttsResult.error });
        return false;
      }

      await adapter.sendVoice(chatId, ttsResult.audio);

      log.info('Voice message sent', {
        chatId,
        textLength: text.length,
        audioSize: ttsResult.audio.length,
      });

      return true;
    } catch (err) {
      log.error('Failed to send voice message', { error: String(err) });
      return false;
    }
  }

  /**
   * Parse BACKGROUND_TASK signal from agent response.
   * Format: natural text + \nBACKGROUND_TASK:{"skill":"id","prompt":"..."}
   * Takes the LAST occurrence if multiple signals exist.
   * Always strips signal text from the user-facing message.
   */
  private parseBackgroundTask(response: string): {
    message: string;
    task?: { skill: string; prompt: string };
  } {
    // Find the last BACKGROUND_TASK: occurrence
    const lastIdx = response.lastIndexOf('BACKGROUND_TASK:');
    if (lastIdx === -1) {
      return { message: response };
    }

    // Everything before the signal is the user message
    const message = response.slice(0, lastIdx).trim();
    // Everything after "BACKGROUND_TASK:" on that line is the JSON
    const signalText = response.slice(lastIdx + 'BACKGROUND_TASK:'.length).trim();

    // Extract just the first JSON object (stop at first complete })
    try {
      // Try parsing the whole remaining text first
      const taskInfo = JSON.parse(signalText);

      if (!taskInfo.skill || !taskInfo.prompt) {
        log.warn('BACKGROUND_TASK signal missing skill or prompt', { taskInfo });
        return { message };
      }

      log.info('Background task signal parsed', {
        skill: taskInfo.skill,
        promptLength: taskInfo.prompt.length,
      });

      return { message, task: { skill: taskInfo.skill, prompt: taskInfo.prompt } };
    } catch {
      // If full text fails, try extracting just the first JSON object
      try {
        const jsonMatch = signalText.match(/^\{[^}]*\}/);
        if (jsonMatch) {
          const taskInfo = JSON.parse(jsonMatch[0]);
          if (taskInfo.skill && taskInfo.prompt) {
            log.info('Background task signal parsed (extracted)', {
              skill: taskInfo.skill,
              promptLength: taskInfo.prompt.length,
            });
            return { message, task: { skill: taskInfo.skill, prompt: taskInfo.prompt } };
          }
        }
      } catch {
        // Fall through
      }

      log.warn('Failed to parse BACKGROUND_TASK signal', {
        signalPreview: signalText.slice(0, 100),
      });
      // Always strip the signal from user-facing message, even on parse failure
      return { message };
    }
  }

  /**
   * Check for memory triggers and store facts
   */
  private async checkMemoryTriggers(
    userMessage: string,
    _response: string
  ): Promise<void> {
    const fact = this.extractMemoryFact(userMessage);

    if (fact) {
      try {
        const memory = getMemoryService();
        await memory.addFact(fact, 'Notes');
        log.info('Memory fact stored', { fact: fact.slice(0, 50) });
      } catch (err) {
        log.error('Failed to store memory fact', { error: String(err) });
      }
    }
  }

  /**
   * Extract memory fact from user message if it contains a trigger
   */
  private extractMemoryFact(userMessage: string): string | null {
    const lowerMessage = userMessage.toLowerCase();

    for (const trigger of MEMORY_TRIGGERS) {
      if (lowerMessage.includes(trigger)) {
        const triggerIndex = lowerMessage.indexOf(trigger);
        const afterTrigger = userMessage.slice(triggerIndex + trigger.length).trim();

        if (afterTrigger.length > 0) {
          return afterTrigger;
        }
        return userMessage;
      }
    }

    return null;
  }
}

/**
 * Router status for health monitoring
 */
export interface RouterStatus {
  running: boolean;
  startedAt: string | null;
  uptime: number;
  adapters: Array<{
    channel: ChannelType;
    displayName: string;
    connected: boolean;
    startedAt: string | null;
    uptime: number;
    lastError?: string;
    details?: Record<string, unknown>;
  }>;
}

// Singleton router instance
let router: MessageRouter | null = null;

/**
 * Get or create the message router instance
 */
export function getRouter(): MessageRouter {
  if (!router) {
    router = new MessageRouter();
  }
  return router;
}
