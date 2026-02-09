/**
 * KITT Message Router
 * Shared message processing for all channels (Telegram, WhatsApp, Slack)
 * Extracts channel-agnostic logic from the channel adapters
 */

import type { ChannelAdapter, IncomingMessage, SendOptions, ChannelType } from './adapters/types.js';
import { extractChannel, extractRawId } from './adapters/types.js';
import { runAgent, type AgentModel } from './agent.js';
import { getSessionId, updateSession, clearSession } from './sessions.js';
import { updateChatState, saveState } from './state.js';
import { log } from './logger.js';
import { getMemoryService } from '../memory/index.js';
import type { Channel } from '../memory/types.js';
import { splitMessage } from './format.js';
import { clearAllModes } from '../scheduler/sleep-mode.js';
import { acquireProcessingLock, releaseProcessingLock } from '../scheduler/processing-lock.js';
import * as fs from 'fs';
import * as path from 'path';

// Default model for chat (Opus for full capability)
const DEFAULT_MODEL: AgentModel = 'opus';

// Skills directory
const SKILLS_DIR = process.env.KITT_SKILLS_DIR || './.claude/skills';

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
   * Start the router and all registered adapters
   */
  async start(): Promise<void> {
    this.startedAt = new Date();
    log.info('Starting router', { adapterCount: this.adapters.size });

    for (const adapter of this.adapters.values()) {
      try {
        await adapter.start();
        log.info('Adapter started', { channel: adapter.channel });
      } catch (err) {
        log.error('Failed to start adapter', {
          channel: adapter.channel,
          error: String(err),
        });
        throw err;
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
   * Handle an incoming message from any channel
   * This is called by channel adapters when they receive a message
   */
  async handleIncoming(message: IncomingMessage): Promise<void> {
    const channel = extractChannel(message.chatId);
    if (!channel) {
      log.error('Invalid chat ID format', { chatId: message.chatId });
      return;
    }

    log.info('Processing message', {
      chatId: message.chatId,
      channel,
      from: message.displayName,
      isGroup: message.isGroup,
      preview: message.content.slice(0, 50),
      model: DEFAULT_MODEL,
    });

    // Wake KITT if sleeping/DND (user message = wake up)
    const memory = getMemoryService();
    const db = memory.getDb();
    if (db) {
      await clearAllModes(db);
    }

    // Get existing session for this chat (using prefixed chatId)
    const sessionId = getSessionId(message.chatId);

    // Store user message in memory (non-blocking)
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

    // Acquire processing lock so Think Loop knows we're handling this
    if (db) {
      await acquireProcessingLock(db);
    }

    // Run agent with Opus
    let response = await runAgent(message.content, { sessionId, model: DEFAULT_MODEL });

    // Auto-recovery: if session seems corrupted, clear and retry with fresh session
    if (response.sessionFailed && sessionId) {
      log.warn('Session failure detected, clearing and retrying', {
        chatId: message.chatId,
        oldSessionId: sessionId,
      });
      console.log(`[router] Session corrupted, starting fresh...`);
      clearSession(message.chatId);

      // Retry without session (fresh start)
      response = await runAgent(message.content, { model: DEFAULT_MODEL });

      if (response.sessionFailed) {
        log.error('Agent failed even without session', { chatId: message.chatId });
        await this.sendMessage(
          message.chatId,
          `Sorry, er ging iets mis. De sessie is gereset, probeer het opnieuw.`
        );
        if (db) await releaseProcessingLock(db);
        return;
      }
    }

    if (response.error) {
      log.error('Agent failed', { chatId: message.chatId, error: response.error });
      await this.sendMessage(message.chatId, `Sorry, er ging iets mis. Probeer het opnieuw.`);
      if (db) await releaseProcessingLock(db);
      return;
    }

    // Check if agent wants to trigger a skill with a different model
    if (response.result) {
      const skillTrigger = this.parseSkillTrigger(response.result);
      if (skillTrigger) {
        const skillModel = this.getSkillModel(skillTrigger.skillName);
        if (skillModel && skillModel !== DEFAULT_MODEL) {
          const skillContent = this.getSkillContent(skillTrigger.skillName);

          log.info('Skill triggered with different model', {
            skill: skillTrigger.skillName,
            model: skillModel,
            hasSkillContent: !!skillContent,
          });
          console.log(`[router] Routing to ${skillModel} for skill: ${skillTrigger.skillName}`);

          // Run skill with its preferred model + full skill context
          const skillResponse = await runAgent(skillTrigger.prompt, {
            model: skillModel,
            skillContext: skillContent || undefined,
          });
          if (skillResponse.result) {
            response = skillResponse;
          }
        }
      }
    }

    // Update session for context persistence
    if (response.sessionId) {
      updateSession(message.chatId, response.sessionId, message.displayName);
    }

    // Update chat state
    const chatName = message.groupName || message.displayName;
    updateChatState(message.chatId, chatName);
    await saveState();

    // Store KITT response in memory
    if (response.result) {
      try {
        await memory.storeMessage({
          sessionId: message.chatId,
          channel: channel as Channel,
          role: 'kitt',
          content: response.result,
          metadata: {
            agentSessionId: response.sessionId,
            inResponseToVoice: message.isVoice,
          },
        });
      } catch (err) {
        log.error('Failed to store KITT message in memory', { error: String(err) });
      }

      // Check for memory triggers (non-blocking)
      this.checkMemoryTriggers(message.content, response.result).catch((err) => {
        log.error('Memory trigger check failed', { error: String(err) });
      });
    }

    // Release processing lock
    if (db) {
      await releaseProcessingLock(db).catch((err) => {
        log.error('Failed to release processing lock', { error: String(err) });
      });
    }

    // Send response via the appropriate adapter
    if (response.result) {
      await this.sendMessage(message.chatId, response.result);
    } else {
      // Log why we're sending fallback message
      log.warn('Agent returned empty result, sending fallback', {
        chatId: message.chatId,
        sessionId: response.sessionId,
        hasError: !!response.error,
        error: response.error,
        sessionFailed: response.sessionFailed,
        resultType: typeof response.result,
        resultValue: response.result === null ? 'null' : response.result === undefined ? 'undefined' : `empty string (len=${response.result.length})`,
        userMessage: message.content.slice(0, 50),
      });
      console.log(`[router] ⚠️ Empty agent result for ${message.chatId} - sending fallback`);
      await this.sendMessage(message.chatId, 'Ik heb je bericht verwerkt.');
    }
  }

  /**
   * Send a message to any channel
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

    // Split long messages
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
   * Parse skill trigger from agent response
   * Format: "SKILL:skill-name prompt..."
   */
  private parseSkillTrigger(response: string): { skillName: string; prompt: string } | null {
    const match = response.match(/^SKILL:(\S+)\s+([\s\S]+)$/);
    if (match) {
      return { skillName: match[1], prompt: match[2].trim() };
    }
    return null;
  }

  /**
   * Get model for a skill from its SKILL.md metadata
   */
  private getSkillModel(skillName: string): AgentModel | null {
    const skillPath = path.join(SKILLS_DIR, skillName, 'SKILL.md');
    if (!fs.existsSync(skillPath)) return null;

    try {
      const content = fs.readFileSync(skillPath, 'utf-8');
      const metadataMatch = content.match(/^metadata:\s*(\{[\s\S]*?\})$/m);
      if (metadataMatch) {
        const metadata = JSON.parse(metadataMatch[1]);
        return metadata?.kitt?.model || null;
      }
    } catch {
      // Ignore parse errors
    }
    return null;
  }

  /**
   * Get full skill content for injection into agent context
   */
  private getSkillContent(skillName: string): string | null {
    const skillPath = path.join(SKILLS_DIR, skillName, 'SKILL.md');
    if (!fs.existsSync(skillPath)) return null;

    try {
      return fs.readFileSync(skillPath, 'utf-8');
    } catch {
      return null;
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
