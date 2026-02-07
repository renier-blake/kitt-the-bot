/**
 * KITT Telegram Adapter
 * Handles Telegram bot connection and message processing
 * With KITT personality and memory triggers
 */

import { Bot, Context, InputFile } from 'grammy';
import type { Chat, User } from 'grammy/types';
import * as fs from 'fs';
import * as path from 'path';
import { runAgent, type AgentModel } from './agent.js';

// Default model for Telegram chat (Opus for full capability)
const TELEGRAM_DEFAULT_MODEL: AgentModel = 'opus';

// Skills directory (same as skills.ts)
const SKILLS_DIR = process.env.KITT_SKILLS_DIR || './.claude/skills';

/**
 * Get model for a skill from its SKILL.md metadata
 */
function getSkillModel(skillName: string): AgentModel | null {
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
function getSkillContent(skillName: string): string | null {
  const skillPath = path.join(SKILLS_DIR, skillName, 'SKILL.md');
  if (!fs.existsSync(skillPath)) return null;

  try {
    return fs.readFileSync(skillPath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Parse skill trigger from agent response
 * Format: "SKILL:skill-name prompt..."
 */
function parseSkillTrigger(response: string): { skillName: string; prompt: string } | null {
  const match = response.match(/^SKILL:(\S+)\s+([\s\S]+)$/);
  if (match) {
    return { skillName: match[1], prompt: match[2].trim() };
  }
  return null;
}

import { getSessionId, updateSession } from './sessions.js';
import { updateChatState, saveState } from './state.js';
import { log } from './logger.js';
import { getMemoryService } from '../memory/index.js';
import { splitMessage, formatForTelegramSafe } from './format.js';
import { transcribeAudio, downloadTelegramFile } from './transcribe.js';
import { textToSpeech, shouldRespondWithVoice } from './tts.js';
import { clearSleep } from '../scheduler/sleep-mode.js';

let bot: Bot | null = null;

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

// splitMessage is imported from ./format.js

/**
 * Check if user is allowed (if whitelist is configured)
 */
function isAllowedUser(userId: number): boolean {
  const allowedUsers = process.env.TELEGRAM_ALLOWED_USERS;
  if (!allowedUsers) return true; // No whitelist = allow all

  const allowed = allowedUsers.split(',').map((id) => id.trim());
  return allowed.includes(String(userId));
}

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
 * Check if message contains a memory trigger and extract the fact
 */
function extractMemoryFact(userMessage: string): string | null {
  const lowerMessage = userMessage.toLowerCase();

  for (const trigger of MEMORY_TRIGGERS) {
    if (lowerMessage.includes(trigger)) {
      // Extract the content after the trigger
      const triggerIndex = lowerMessage.indexOf(trigger);
      const afterTrigger = userMessage.slice(triggerIndex + trigger.length).trim();

      // If there's content after the trigger, use that
      if (afterTrigger.length > 0) {
        return afterTrigger;
      }

      // Otherwise, use the whole message as context
      return userMessage;
    }
  }

  return null;
}

/**
 * Check for memory triggers and store facts
 */
async function checkMemoryTriggers(
  userMessage: string,
  _response: string
): Promise<void> {
  const fact = extractMemoryFact(userMessage);

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
 * Send a voice response via TTS
 * @returns true if voice was sent successfully, false otherwise
 */
async function sendVoiceResponse(
  ctx: Context,
  text: string
): Promise<boolean> {
  // Check if ElevenLabs is configured
  if (!process.env.ELEVENLABS_API_KEY) {
    log.debug('ElevenLabs not configured, skipping voice response');
    return false;
  }

  try {
    // Show recording indicator while generating
    await ctx.replyWithChatAction('record_voice');

    const ttsResult = await textToSpeech(text);

    if (!ttsResult.success || ttsResult.audio.length === 0) {
      log.error('TTS generation failed', { error: ttsResult.error });
      return false;
    }

    // Send voice message
    await ctx.replyWithVoice(
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

/**
 * Initialize and start the Telegram bot
 */
export async function startTelegramBot(): Promise<Bot> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set');
  }

  bot = new Bot(token);

  // Handle text messages
  bot.on('message:text', async (ctx) => {
    const user = ctx.message.from;
    const chatId = String(ctx.chat.id);
    const content = ctx.message.text;

    // Check user whitelist
    if (!isAllowedUser(user.id)) {
      log.warn('Message from non-whitelisted user', {
        userId: user.id,
        username: user.username,
      });
      return;
    }

    // Wake KITT if sleeping (user message = wake up)
    {
      const memoryForSleep = getMemoryService();
      const sleepDb = memoryForSleep.getDb();
      if (sleepDb) {
        await clearSleep(sleepDb);
      }
    }

    // Check if we should process this message
    if (!shouldProcess(ctx)) {
      log.debug('Skipping message (not triggered)', {
        chatId: ctx.chat.id,
        isGroup: isGroupChat(ctx.chat),
      });
      return;
    }

    const chatName = getChatName(ctx.chat, user);
    const displayName = getDisplayName(user);

    log.info('Processing message', {
      chatId,
      from: displayName,
      isGroup: isGroupChat(ctx.chat),
      preview: content.slice(0, 50),
      model: TELEGRAM_DEFAULT_MODEL,
    });

    // Show typing indicator
    await ctx.replyWithChatAction('typing');

    // Get existing session for this chat
    const sessionId = getSessionId(chatId);

    // Store user message in memory (non-blocking)
    const memory = getMemoryService();
    memory.storeMessage({
      sessionId: chatId,
      channel: 'telegram',
      role: 'user',
      content,
      metadata: {
        userId: user.id,
        username: user.username,
        displayName,
        chatName,
        isGroup: isGroupChat(ctx.chat),
        messageId: ctx.message.message_id,
      },
    }).catch((err) => {
      log.error('Failed to store user message in memory', { error: String(err) });
    });

    // Run agent with Haiku (fast router/communicator)
    let response = await runAgent(content, { sessionId, model: TELEGRAM_DEFAULT_MODEL });

    if (response.error) {
      log.error('Agent failed', { chatId, error: response.error });
      await ctx.reply(`Sorry, er ging iets mis. Probeer het opnieuw.`);
      return;
    }

    // Check if Haiku wants to trigger a skill with a different model
    if (response.result) {
      const skillTrigger = parseSkillTrigger(response.result);
      if (skillTrigger) {
        const skillModel = getSkillModel(skillTrigger.skillName);
        if (skillModel && skillModel !== TELEGRAM_DEFAULT_MODEL) {
          // Load full skill content for context injection
          const skillContent = getSkillContent(skillTrigger.skillName);

          log.info('Skill triggered with different model', {
            skill: skillTrigger.skillName,
            model: skillModel,
            hasSkillContent: !!skillContent,
          });
          console.log(`[telegram] 🔄 Routing to ${skillModel} for skill: ${skillTrigger.skillName}`);

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
      updateSession(chatId, response.sessionId, displayName);
    }

    // Update chat state
    updateChatState(chatId, chatName);
    await saveState();

    // Store KITT response in memory (non-blocking)
    // F53: role 'kitt' ipv 'assistant'
    if (response.result) {
      memory.storeMessage({
        sessionId: chatId,
        channel: 'telegram',
        role: 'kitt',
        content: response.result,
        metadata: {
          agentSessionId: response.sessionId,
        },
      }).catch((err) => {
        log.error('Failed to store KITT message in memory', { error: String(err) });
      });

      // Check for memory triggers (non-blocking)
      checkMemoryTriggers(content, response.result).catch((err) => {
        log.error('Memory trigger check failed', { error: String(err) });
      });
    }

    // Send response
    const finalResult = response.result;
    if (finalResult) {
      // Check if user wants voice response (for text messages)
      const useVoice = shouldRespondWithVoice(false, content);

      if (useVoice) {
        // Try to send voice response
        const voiceSent = await sendVoiceResponse(ctx, finalResult);

        if (!voiceSent) {
          // Fallback to text if voice failed
          const chunks = splitMessage(finalResult, 4000);
          for (const chunk of chunks) {
            const { text, parseMode } = formatForTelegramSafe(chunk);
            await ctx.reply(text, { parse_mode: parseMode });
          }
        }
      } else {
        // Normal text response
        const chunks = splitMessage(finalResult, 4000);
        for (const chunk of chunks) {
          const { text, parseMode } = formatForTelegramSafe(chunk);
          await ctx.reply(text, { parse_mode: parseMode });
        }
      }
    } else {
      await ctx.reply('Ik heb je bericht verwerkt.');
    }
  });

  // Handle voice messages
  bot.on('message:voice', async (ctx) => {
    const user = ctx.message.from;
    const chatId = String(ctx.chat.id);

    // Check user whitelist
    if (!isAllowedUser(user.id)) {
      log.warn('Voice message from non-whitelisted user', {
        userId: user.id,
        username: user.username,
      });
      return;
    }

    // Wake KITT if sleeping (user message = wake up)
    const memoryService = getMemoryService();
    const dbClient = memoryService.getDb();
    if (dbClient) {
      await clearSleep(dbClient);
    }

    // In groups, only process if replied to bot (can't @mention in voice)
    if (isGroupChat(ctx.chat) && !isReplyToBot(ctx)) {
      log.debug('Skipping voice message in group (not a reply to bot)', {
        chatId: ctx.chat.id,
      });
      return;
    }

    const chatName = getChatName(ctx.chat, user);
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

      // Get existing session for this chat
      const sessionId = getSessionId(chatId);

      // Store transcribed message in memory (with voice metadata)
      const memory = getMemoryService();
      memory.storeMessage({
        sessionId: chatId,
        channel: 'telegram',
        role: 'user',
        content: transcribedText,
        metadata: {
          userId: user.id,
          username: user.username,
          displayName,
          chatName,
          isGroup: isGroupChat(ctx.chat),
          messageId: ctx.message.message_id,
          isVoice: true,
          voiceDuration: ctx.message.voice.duration,
        },
      }).catch((err) => {
        log.error('Failed to store voice message in memory', { error: String(err) });
      });

      // Run agent with transcribed text (Haiku for fast communication)
      const response = await runAgent(transcribedText, { sessionId, model: TELEGRAM_DEFAULT_MODEL });

      if (response.error) {
        log.error('Agent failed on voice message', { chatId, error: response.error });
        await ctx.reply(`Sorry, er ging iets mis. Probeer het opnieuw.`);
        return;
      }

      // Update session for context persistence
      if (response.sessionId) {
        updateSession(chatId, response.sessionId, displayName);
      }

      // Update chat state
      updateChatState(chatId, chatName);
      await saveState();

      // Store KITT response in memory
      // F53: role 'kitt' ipv 'assistant'
      if (response.result) {
        memory.storeMessage({
          sessionId: chatId,
          channel: 'telegram',
          role: 'kitt',
          content: response.result,
          metadata: {
            agentSessionId: response.sessionId,
            inResponseToVoice: true,
          },
        }).catch((err) => {
          log.error('Failed to store KITT message in memory', { error: String(err) });
        });

        // Check for memory triggers
        checkMemoryTriggers(transcribedText, response.result).catch((err) => {
          log.error('Memory trigger check failed', { error: String(err) });
        });
      }

      // Send response with transcription feedback
      if (response.result) {
        // Check if we should respond with voice
        const useVoice = shouldRespondWithVoice(true, transcribedText);

        if (useVoice) {
          // Try to send voice response
          const voiceSent = await sendVoiceResponse(ctx, response.result);

          if (voiceSent) {
            // Also send text transcription note
            await ctx.reply(`🎤 *Ik hoorde:* "${transcribedText}"`, { parse_mode: 'Markdown' });
          } else {
            // Fallback to text if voice failed
            const transcriptionNote = `🎤 *Ik hoorde:* "${transcribedText}"\n\n`;
            const fullResponse = transcriptionNote + response.result;

            const chunks = splitMessage(fullResponse, 4000);
            for (const chunk of chunks) {
              const { text, parseMode } = formatForTelegramSafe(chunk);
              await ctx.reply(text, { parse_mode: parseMode });
            }
          }
        } else {
          // Text response requested
          const transcriptionNote = `🎤 *Ik hoorde:* "${transcribedText}"\n\n`;
          const fullResponse = transcriptionNote + response.result;

          const chunks = splitMessage(fullResponse, 4000);
          for (const chunk of chunks) {
            const { text, parseMode } = formatForTelegramSafe(chunk);
            await ctx.reply(text, { parse_mode: parseMode });
          }
        }
      } else {
        await ctx.reply(`🎤 Ik hoorde: "${transcribedText}"\n\nIk heb je bericht verwerkt.`);
      }
    } catch (err) {
      log.error('Voice message processing failed', { error: String(err) });
      await ctx.reply('Sorry, er ging iets mis bij het verwerken van je voice message.');
    }
  });

  // Handle errors
  bot.catch((err) => {
    log.error('Bot error', { error: String(err.error), ctx: err.ctx?.update?.update_id });
  });

  // Start bot
  await bot.init();
  log.info('Telegram bot initialized', {
    username: bot.botInfo.username,
    id: bot.botInfo.id,
  });

  // Start polling (non-blocking)
  bot.start({
    onStart: (botInfo) => {
      log.info('Bot started polling', { username: botInfo.username });
    },
  });

  return bot;
}

/**
 * Send a message via Telegram
 */
export async function sendTelegramMessage(
  chatId: string,
  content: string,
  options?: {
    replyToMessageId?: number;
    parseMode?: 'HTML' | 'Markdown';
  }
): Promise<void> {
  if (!bot) {
    throw new Error('Telegram bot not initialized');
  }

  await bot.api.sendMessage(chatId, content, {
    parse_mode: options?.parseMode,
    reply_to_message_id: options?.replyToMessageId,
  });

  log.info('Sent Telegram message', {
    chatId,
    length: content.length,
  });
}

/**
 * Get bot instance
 */
export function getBot(): Bot | null {
  return bot;
}

/**
 * Stop the bot
 */
export async function stopTelegramBot(): Promise<void> {
  if (bot) {
    await bot.stop();
    bot = null;
    log.info('Telegram bot stopped');
  }
}
