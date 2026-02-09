/**
 * KITT Telegram Adapter
 * Implements ChannelAdapter interface for Telegram
 */

import { Bot, Context, InputFile } from 'grammy';
import type { Chat, User } from 'grammy/types';
import type { ChannelAdapter, IncomingMessage, SendOptions, AdapterStatus } from './types.js';
import { prefixChatId, extractRawId } from './types.js';
import { getRouter } from '../router.js';
import { log } from '../logger.js';
import { formatForTelegramSafe, splitMessage } from '../format.js';
import { transcribeAudio, downloadTelegramFile } from '../transcribe.js';
import { textToSpeech, shouldRespondWithVoice } from '../tts.js';

/**
 * Check if a chat is a group (not DM)
 */
function isGroupChat(chat: Chat): boolean {
  return chat.type === 'group' || chat.type === 'supergroup';
}

/**
 * Check if the bot is mentioned in the message
 */
function isBotMentioned(text: string, botUsername: string): boolean {
  return text.toLowerCase().includes(`@${botUsername.toLowerCase()}`);
}

/**
 * Check if message is a reply to a bot message
 */
function isReplyToBot(ctx: Context): boolean {
  const reply = ctx.message?.reply_to_message;
  if (!reply) return false;
  return reply.from?.id === ctx.me.id;
}

/**
 * Get display name from Telegram user
 */
function getDisplayName(user: User): string {
  if (user.first_name && user.last_name) {
    return `${user.first_name} ${user.last_name}`;
  }
  return user.first_name || user.username || 'Unknown';
}

/**
 * Get chat name (group name or user name)
 */
function getChatName(chat: Chat, user: User): string {
  if (isGroupChat(chat)) {
    return (chat as Chat.GroupChat | Chat.SupergroupChat).title || 'Unknown Group';
  }
  return getDisplayName(user);
}

/**
 * Check if message should be processed
 */
function shouldProcess(ctx: Context): boolean {
  const chat = ctx.message?.chat;
  const text = ctx.message?.text;

  if (!chat || !text) return false;

  // Always process DMs
  if (!isGroupChat(chat)) {
    return true;
  }

  // In groups, only process if mentioned or replied to
  const botUsername = ctx.me.username;
  if (isBotMentioned(text, botUsername)) {
    return true;
  }

  if (isReplyToBot(ctx)) {
    return true;
  }

  return false;
}

/**
 * Check if user is allowed (if whitelist is configured)
 */
function isAllowedUser(userId: number): boolean {
  const allowedUsers = process.env.TELEGRAM_ALLOWED_USERS;
  if (!allowedUsers) return true; // No whitelist = allow all

  const allowed = allowedUsers.split(',').map((id) => id.trim());
  return allowed.includes(String(userId));
}

export class TelegramAdapter implements ChannelAdapter {
  readonly channel = 'telegram' as const;
  readonly displayName = 'Telegram';

  private bot: Bot | null = null;
  private startedAt: Date | null = null;
  private lastError: string | null = null;
  private pendingResponses: Map<string, { useVoice: boolean; transcribedText?: string }> = new Map();

  async start(): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is not set');
    }

    this.bot = new Bot(token);
    this.setupHandlers();

    // Initialize bot
    await this.bot.init();
    log.info('Telegram bot initialized', {
      username: this.bot.botInfo.username,
      id: this.bot.botInfo.id,
    });

    // Start polling (non-blocking)
    this.bot.start({
      onStart: (botInfo) => {
        this.startedAt = new Date();
        log.info('Telegram bot started polling', { username: botInfo.username });
      },
    });

    // Handle errors
    this.bot.catch((err) => {
      this.lastError = String(err.error);
      log.error('Telegram bot error', { error: String(err.error), ctx: err.ctx?.update?.update_id });
    });
  }

  async stop(): Promise<void> {
    if (this.bot) {
      await this.bot.stop();
      this.bot = null;
      this.startedAt = null;
      log.info('Telegram bot stopped');
    }
  }

  async sendMessage(chatId: string, content: string, options?: SendOptions): Promise<void> {
    if (!this.bot) {
      throw new Error('Telegram bot not initialized');
    }

    const rawChatId = extractRawId(chatId);
    const pending = this.pendingResponses.get(chatId);

    // Check if we should respond with voice
    if (pending?.useVoice && options?.asVoice !== false) {
      const voiceSent = await this.sendVoiceResponse(rawChatId, content);

      if (voiceSent) {
        // Also send transcription note if this was a voice message
        if (pending.transcribedText) {
          await this.bot.api.sendMessage(
            rawChatId,
            `*Ik hoorde:* "${pending.transcribedText}"`,
            { parse_mode: 'Markdown' }
          );
        }
        this.pendingResponses.delete(chatId);
        return;
      }
      // Fallback to text if voice failed
    }

    // Text response - include transcription note if needed
    let messageContent = content;
    if (pending?.transcribedText) {
      messageContent = `*Ik hoorde:* "${pending.transcribedText}"\n\n${content}`;
    }

    // Split and send
    const chunks = splitMessage(messageContent, 4000);
    for (const chunk of chunks) {
      const { text, parseMode } = formatForTelegramSafe(chunk);
      await this.bot.api.sendMessage(rawChatId, text, {
        parse_mode: parseMode,
        reply_to_message_id: options?.replyToMessageId as number | undefined,
      });
    }

    this.pendingResponses.delete(chatId);
    log.info('Sent Telegram message', { chatId, length: content.length });
  }

  async sendVoice(chatId: string, audioBuffer: Buffer): Promise<void> {
    if (!this.bot) {
      throw new Error('Telegram bot not initialized');
    }

    const rawChatId = extractRawId(chatId);
    await this.bot.api.sendVoice(rawChatId, new InputFile(audioBuffer, 'response.mp3'));
  }

  isConnected(): boolean {
    return this.bot !== null && this.startedAt !== null;
  }

  getStatus(): AdapterStatus {
    return {
      connected: this.isConnected(),
      startedAt: this.startedAt?.toISOString() || null,
      uptime: this.startedAt ? Math.floor((Date.now() - this.startedAt.getTime()) / 1000) : 0,
      lastError: this.lastError || undefined,
      details: this.bot
        ? {
            username: this.bot.botInfo.username,
            id: this.bot.botInfo.id,
          }
        : undefined,
    };
  }

  // --- Private methods ---

  private setupHandlers(): void {
    if (!this.bot) return;

    // Handle text messages
    this.bot.on('message:text', async (ctx) => {
      await this.handleTextMessage(ctx);
    });

    // Handle voice messages
    this.bot.on('message:voice', async (ctx) => {
      await this.handleVoiceMessage(ctx);
    });
  }

  private async handleTextMessage(ctx: Context): Promise<void> {
    const user = ctx.message?.from;
    const chat = ctx.message?.chat;
    const content = ctx.message?.text;

    if (!user || !chat || !content) return;

    // Check user whitelist
    if (!isAllowedUser(user.id)) {
      log.warn('Message from non-whitelisted user', {
        userId: user.id,
        username: user.username,
      });
      return;
    }

    // Check if we should process this message
    if (!shouldProcess(ctx)) {
      log.debug('Skipping message (not triggered)', {
        chatId: chat.id,
        isGroup: isGroupChat(chat),
      });
      return;
    }

    const chatId = prefixChatId('telegram', String(chat.id));
    const chatName = getChatName(chat, user);
    const displayName = getDisplayName(user);

    // Show typing indicator
    await ctx.replyWithChatAction('typing');

    // Check if user wants voice response
    const useVoice = shouldRespondWithVoice(false, content);
    this.pendingResponses.set(chatId, { useVoice });

    // Build incoming message and route to handler
    const message: IncomingMessage = {
      chatId,
      userId: String(user.id),
      username: user.username,
      displayName,
      content,
      replyTo: ctx.message?.reply_to_message?.message_id?.toString(),
      isGroup: isGroupChat(chat),
      groupName: isGroupChat(chat) ? chatName : undefined,
      messageId: ctx.message?.message_id,
      raw: ctx.message,
    };

    await getRouter().handleIncoming(message);
  }

  private async handleVoiceMessage(ctx: Context): Promise<void> {
    const user = ctx.message?.from;
    const chat = ctx.message?.chat;

    if (!user || !chat || !ctx.message?.voice) return;

    // Check user whitelist
    if (!isAllowedUser(user.id)) {
      log.warn('Voice message from non-whitelisted user', {
        userId: user.id,
        username: user.username,
      });
      return;
    }

    // In groups, only process if replied to bot (can't @mention in voice)
    if (isGroupChat(chat) && !isReplyToBot(ctx)) {
      log.debug('Skipping voice message in group (not a reply to bot)', {
        chatId: chat.id,
      });
      return;
    }

    const chatId = prefixChatId('telegram', String(chat.id));
    const chatName = getChatName(chat, user);
    const displayName = getDisplayName(user);

    log.info('Processing voice message', {
      chatId,
      from: displayName,
      duration: ctx.message.voice.duration,
      fileSize: ctx.message.voice.file_size,
    });

    // Show typing indicator
    await ctx.replyWithChatAction('typing');

    try {
      // Get file info from Telegram
      const file = await ctx.getFile();
      const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

      // Download the audio file
      const audioBuffer = await downloadTelegramFile(fileUrl);

      // Transcribe with Whisper
      const transcription = await transcribeAudio(audioBuffer, file.file_path);

      if (!transcription.success || !transcription.text) {
        log.error('Transcription failed', { error: transcription.error });
        await ctx.reply('Sorry, ik kon je voice message niet verstaan. Kun je het nog een keer proberen?');
        return;
      }

      const transcribedText = transcription.text;

      log.info('Voice transcribed', {
        chatId,
        text: transcribedText.slice(0, 50),
      });

      // Check if we should respond with voice
      const useVoice = shouldRespondWithVoice(true, transcribedText);
      this.pendingResponses.set(chatId, { useVoice, transcribedText });

      // Build incoming message and route to handler
      const message: IncomingMessage = {
        chatId,
        userId: String(user.id),
        username: user.username,
        displayName,
        content: transcribedText,
        replyTo: ctx.message?.reply_to_message?.message_id?.toString(),
        isGroup: isGroupChat(chat),
        groupName: isGroupChat(chat) ? chatName : undefined,
        isVoice: true,
        voiceDuration: ctx.message.voice.duration,
        messageId: ctx.message?.message_id,
        raw: ctx.message,
      };

      await getRouter().handleIncoming(message);
    } catch (err) {
      log.error('Voice message processing failed', { error: String(err) });
      await ctx.reply('Sorry, er ging iets mis bij het verwerken van je voice message.');
    }
  }

  private async sendVoiceResponse(rawChatId: string, text: string): Promise<boolean> {
    // Check if ElevenLabs is configured
    if (!process.env.ELEVENLABS_API_KEY || !this.bot) {
      log.debug('ElevenLabs not configured, skipping voice response');
      return false;
    }

    try {
      // Show recording indicator while generating
      await this.bot.api.sendChatAction(rawChatId, 'record_voice');

      const ttsResult = await textToSpeech(text);

      if (!ttsResult.success || ttsResult.audio.length === 0) {
        log.error('TTS generation failed', { error: ttsResult.error });
        return false;
      }

      // Send voice message
      await this.bot.api.sendVoice(
        rawChatId,
        new InputFile(ttsResult.audio, 'response.mp3')
      );

      log.info('Voice response sent', {
        textLength: text.length,
        audioSize: ttsResult.audio.length,
      });

      return true;
    } catch (err) {
      log.error('Failed to send voice response', { error: String(err) });
      return false;
    }
  }
}

// Export convenience function for direct access
export function createTelegramAdapter(): TelegramAdapter {
  return new TelegramAdapter();
}
