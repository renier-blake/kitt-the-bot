/**
 * KITT WhatsApp Adapter
 * Implements ChannelAdapter interface for WhatsApp using Baileys
 */

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  downloadMediaMessage,
  WAMessageContent,
  WAMessageKey,
  WAMessage,
  proto,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import * as path from 'path';
import type { ChannelAdapter, IncomingMessage, SendOptions, AdapterStatus } from './types.js';
import { prefixChatId, extractRawId } from './types.js';
import { getRouter } from '../router.js';
import { log } from '../logger.js';
import { getMemoryService } from '../../memory/index.js';
import { transcribeAudio } from '../transcribe.js';
import pino from 'pino';

// Silent pino logger for Baileys (it requires pino-compatible logger)
const baileysLogger = pino({ level: 'silent' });

// Auth state directory
const AUTH_DIR = process.env.WHATSAPP_AUTH_DIR || './data/whatsapp-auth';

// Allowed numbers cache (refreshed from DB)
let allowedNumbersCache: string[] = [];
let cacheTimestamp = 0;
const CACHE_TTL = 30000; // 30 seconds

/**
 * Get allowed numbers from database (with caching)
 */
async function getAllowedNumbers(): Promise<string[]> {
  const now = Date.now();
  if (now - cacheTimestamp < CACHE_TTL) {
    return allowedNumbersCache;
  }

  try {
    const { getMetaValue } = await import('../../capabilities/index.js');
    const value = await getMetaValue('whatsapp_allowed_numbers');
    if (value) {
      allowedNumbersCache = JSON.parse(value);
    } else {
      allowedNumbersCache = [];
    }
  } catch {
    // Keep existing cache on error
  }
  cacheTimestamp = now;
  return allowedNumbersCache;
}

/**
 * Extract text content from WhatsApp message
 */
function getMessageContent(message: proto.IMessage | null | undefined): string {
  if (!message) return '';

  // Text message
  if (message.conversation) return message.conversation;

  // Extended text (with preview, etc.)
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;

  // Image with caption
  if (message.imageMessage?.caption) return `[Image] ${message.imageMessage.caption}`;
  if (message.imageMessage) return '[Image]';

  // Video with caption
  if (message.videoMessage?.caption) return `[Video] ${message.videoMessage.caption}`;
  if (message.videoMessage) return '[Video]';

  // Document
  if (message.documentMessage?.fileName) return `[Document: ${message.documentMessage.fileName}]`;
  if (message.documentMessage) return '[Document]';

  // Audio/Voice
  if (message.audioMessage) {
    return message.audioMessage.ptt ? '[Voice Message]' : '[Audio]';
  }

  // Sticker
  if (message.stickerMessage) return '[Sticker]';

  // Location
  if (message.locationMessage) {
    const loc = message.locationMessage;
    return `[Location: ${loc.degreesLatitude}, ${loc.degreesLongitude}]`;
  }

  // Contact
  if (message.contactMessage) {
    return `[Contact: ${message.contactMessage.displayName}]`;
  }

  // Reaction
  if (message.reactionMessage) {
    return `[Reaction: ${message.reactionMessage.text}]`;
  }

  return '[Unsupported message type]';
}

/**
 * Check if a JID is a group
 */
function isGroupJid(jid: string): boolean {
  return jid.endsWith('@g.us');
}

/**
 * Check if a phone number is allowed to have conversations with KITT
 * @param jid - The JID to check
 * @param ownJid - The connected account's JID (always allowed for "Message Yourself")
 * @param isFromMe - Whether the message is from the connected account (for @lid detection)
 * @returns 'respond' = can have conversations, 'read-only' = KITT reads but doesn't respond
 */
async function getNumberPermission(jid: string, ownJid?: string, isFromMe?: boolean): Promise<'respond' | 'read-only'> {
  // Always allow your own number (for "Message Yourself" chat)
  if (ownJid) {
    const ownNumber = ownJid.split('@')[0].split(':')[0]; // Remove @s.whatsapp.net and :device
    const checkNumber = jid.split('@')[0];
    if (checkNumber === ownNumber) return 'respond';
  }

  // Allow @lid JIDs if fromMe=true (Message Yourself chat uses @lid format)
  // The @lid is WhatsApp's internal linked-device ID, not a phone number
  if (jid.endsWith('@lid') && isFromMe) {
    return 'respond';
  }

  // Get allowed numbers from database
  const allowedNumbers = await getAllowedNumbers();

  // No whitelist configured = only connected number allowed (checked above)
  // This is the safe default: strangers are read-only
  if (allowedNumbers.length === 0) return 'read-only';

  // Extract identifier from JID (phone number or @lid ID)
  const identifier = jid.split('@')[0];

  // Check if whitelisted - works for both phone numbers and @lid values
  // For phone numbers: match if the number contains the allowed digits
  // For @lid: exact match on the numeric ID
  const isWhitelisted = allowedNumbers.some((allowed) => {
    const allowedDigits = allowed.replace(/[^\d]/g, '');
    // Exact match for @lid IDs (they don't overlap with phone numbers)
    if (identifier === allowedDigits) return true;
    // Partial match for phone numbers (handles country code variations)
    if (identifier.includes(allowedDigits) || allowedDigits.includes(identifier)) return true;
    return false;
  });

  // Log for debugging @lid issues - show how to add them
  if (!isWhitelisted && jid.endsWith('@lid')) {
    log.warn('Blocked @lid message - add to allowlist if wanted', {
      lid: identifier,
      addThis: `+${identifier}`,
      allowedNumbers
    });
  }

  return isWhitelisted ? 'respond' : 'read-only';
}

export class WhatsAppAdapter implements ChannelAdapter {
  readonly channel = 'whatsapp' as const;
  readonly displayName = 'WhatsApp';

  private sock: ReturnType<typeof makeWASocket> | null = null;
  private startedAt: Date | null = null;
  private lastError: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private _connected = false;
  private currentQrCode: string | null = null;
  private qrCodeUpdatedAt: Date | null = null;

  // Track message IDs that KITT sent (to avoid processing our own responses)
  private sentMessageIds = new Set<string>();

  async start(): Promise<void> {
    // Ensure auth directory exists
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    await this.connect();
  }

  private async connect(): Promise<void> {
    try {
      // Get latest Baileys version
      const { version, isLatest } = await fetchLatestBaileysVersion();
      log.info('Baileys version', { version: version.join('.'), isLatest });

      // Load auth state
      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

      // Create socket
      this.sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
        },
        printQRInTerminal: false,  // QR code exposed via getQrCode() for Portal UI
        generateHighQualityLinkPreview: false,
        logger: baileysLogger,
      });

      // Save credentials on update
      this.sock.ev.on('creds.update', saveCreds);

      // Handle connection updates
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.currentQrCode = qr;
          this.qrCodeUpdatedAt = new Date();
          log.info('WhatsApp QR code generated', { qrLength: qr.length });
          console.log('[whatsapp] QR code ready - scan via Portal or API');
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const errorMsg = lastDisconnect?.error?.message || 'Connection closed';
          const isQrTimeout = statusCode === 408 || errorMsg.includes('QR refs');
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut && !isQrTimeout;

          this._connected = false;
          this.lastError = errorMsg;

          log.warn('WhatsApp connection closed', {
            statusCode,
            shouldReconnect,
            isQrTimeout,
            error: errorMsg,
          });

          if (isQrTimeout) {
            // QR code timed out — nobody scanned. Don't keep looping.
            console.log('[whatsapp] QR code timed out. Scan via Portal to reconnect.');
          } else if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`[whatsapp] Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

            // Exponential backoff: 5s, 10s, 20s, 40s, 80s
            const delay = 5000 * Math.pow(2, this.reconnectAttempts - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
            await this.connect();
          } else if (statusCode === DisconnectReason.loggedOut) {
            console.log('[whatsapp] Logged out. Please re-authenticate by restarting the bridge.');
            // Clear auth state
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('[whatsapp] Max reconnect attempts reached. Restart bridge to try again.');
          }
        } else if (connection === 'open') {
          this._connected = true;
          this.startedAt = new Date();
          this.reconnectAttempts = 0;
          this.lastError = null;
          this.currentQrCode = null;  // Clear QR when connected
          this.qrCodeUpdatedAt = null;

          const user = this.sock?.user;
          log.info('WhatsApp connected', {
            id: user?.id,
            name: user?.name,
          });
          console.log(`[whatsapp] Connected as ${user?.name || user?.id}`);
        }
      });

      // Handle incoming messages
      this.sock.ev.on('messages.upsert', async (upsert) => {
        if (upsert.type !== 'notify') return;

        for (const msg of upsert.messages) {
          await this.handleMessage(msg);
        }
      });
    } catch (err) {
      this.lastError = String(err);
      log.error('Failed to connect WhatsApp', { error: this.lastError });
      throw err;
    }
  }

  private async handleMessage(msg: proto.IWebMessageInfo): Promise<void> {
    // Ensure key exists
    if (!msg.key) return;

    // Skip status updates
    if (msg.key.remoteJid === 'status@broadcast') return;

    // Skip messages that KITT sent (to avoid loops)
    // But allow fromMe messages that user sent (e.g., "Message Yourself" chat)
    if (msg.key.id && this.sentMessageIds.has(msg.key.id)) {
      log.debug('Skipping own sent message', { id: msg.key.id });
      return;
    }

    const jid = msg.key.remoteJid;
    if (!jid) return;

    // Check if this is a voice message that needs transcription
    const isVoiceMessage = msg.message?.audioMessage?.ptt === true;

    let content: string;
    let isVoice = false;
    let voiceDuration: number | undefined;

    if (isVoiceMessage) {
      // Handle voice message with transcription
      const transcribeResult = await this.transcribeVoiceMessage(msg);
      if (!transcribeResult) return; // Transcription failed or not supported
      content = transcribeResult.text;
      isVoice = true;
      voiceDuration = msg.message?.audioMessage?.seconds || undefined;
    } else {
      content = getMessageContent(msg.message);
      if (!content) return;

      // Skip unsupported message types (images, videos, etc.)
      if (content.startsWith('[') && content.endsWith(']')) {
        log.debug('Skipping unsupported message type', { content });
        return;
      }
    }

    const isGroup = isGroupJid(jid);
    const userId = msg.key.participant || jid;
    const displayName = msg.pushName || userId.split('@')[0];

    // Groups: KITT does not respond in group chats by default.
    // Only store messages as read-only context (no response).
    if (isGroup) {
      try {
        const memory = getMemoryService();
        await memory.storeMessage({
          sessionId: prefixChatId('whatsapp', jid),
          channel: 'whatsapp',
          role: 'user',
          type: 'message',
          content: `[Group message from ${displayName}]: ${content}`,
          metadata: {
            fromNumber: userId.split('@')[0],
            displayName,
            readOnly: true,
            isGroup: true,
            groupJid: jid,
            messageId: msg.key.id,
          },
        });
      } catch (err) {
        log.error('Failed to store group message', { error: String(err) });
      }
      log.debug('Group message stored (read-only, no response)', { jid, from: displayName });
      return;
    }

    const chatId = prefixChatId('whatsapp', jid);

    // Check permission level (own number is always 'respond')
    // For @lid JIDs, use participant if available (actual sender's number)
    // This handles linked device messages correctly
    const ownJid = this.sock?.user?.id;
    const senderJid = msg.key.participant || jid;
    const permission = await getNumberPermission(senderJid, ownJid, msg.key.fromMe ?? false);

    log.info('Processing WhatsApp message', {
      chatId,
      from: displayName,
      isGroup,
      permission,
      isVoice,
      preview: content.slice(0, 50),
    });

    // For read-only: store in memory but don't respond
    // Skip our own outgoing messages to non-allowlisted chats (not useful to store)
    if (permission === 'read-only' && msg.key.fromMe) {
      log.debug('Skipping own outgoing message to non-allowlisted chat', { chatId });
      return;
    }
    if (permission === 'read-only') {
      try {
        const memory = getMemoryService();
        await memory.storeMessage({
          sessionId: chatId,
          channel: 'whatsapp',
          role: 'user',
          type: 'message',
          content: `[Incoming WhatsApp from ${displayName}]: ${content}`,
          metadata: {
            fromNumber: userId.split('@')[0],
            displayName,
            readOnly: true,
            fromMe: msg.key.fromMe ?? false,
            messageId: msg.key.id,
            isVoice,
          },
        });
        // Log with sender info so user knows who tried to message
        const senderId = userId.split('@')[0];
        const isLid = userId.endsWith('@lid');
        log.info('Stored read-only WhatsApp message (not responding)', {
          from: displayName,
          senderId,
          isLid,
          chatId,
          tip: `Add +${senderId} to allowlist to enable responses`
        });
      } catch (err) {
        log.error('Failed to store read-only message', { error: String(err) });
      }
      return; // Don't route to agent - no response
    }

    // Build incoming message and route to handler
    const message: IncomingMessage = {
      chatId,
      userId: userId.split('@')[0],
      displayName,
      content,
      replyTo: msg.message?.extendedTextMessage?.contextInfo?.stanzaId || undefined,
      isGroup,
      groupName: isGroup ? undefined : undefined, // TODO: Get group name
      messageId: msg.key.id || undefined,
      isVoice,
      voiceDuration,
      raw: msg,
    };

    try {
      await getRouter().handleIncoming(message);
    } catch (err) {
      log.error('Error handling WhatsApp message', { error: String(err) });
    }
  }

  /**
   * Transcribe a WhatsApp voice message using Whisper
   */
  private async transcribeVoiceMessage(msg: proto.IWebMessageInfo): Promise<{ text: string } | null> {
    if (!this.sock) return null;

    const audioMessage = msg.message?.audioMessage;
    if (!audioMessage) return null;

    const duration = audioMessage.seconds || 0;
    log.info('Processing WhatsApp voice message', {
      duration,
      fileSize: audioMessage.fileLength,
      mimetype: audioMessage.mimetype,
    });

    try {
      // Download the voice message using Baileys
      // Cast to WAMessage - msg has required fields but stricter types
      const audioBuffer = await downloadMediaMessage(
        msg as WAMessage,
        'buffer',
        {},
        {
          logger: baileysLogger,
          reuploadRequest: this.sock.updateMediaMessage,
        }
      ) as Buffer;

      if (!audioBuffer || audioBuffer.length === 0) {
        log.error('Failed to download voice message: empty buffer');
        return null;
      }

      log.info('Voice message downloaded', { size: audioBuffer.length });

      // Transcribe with Whisper
      const transcription = await transcribeAudio(audioBuffer, 'voice.ogg');

      if (!transcription.success || !transcription.text) {
        log.error('Voice transcription failed', { error: transcription.error });
        return null;
      }

      log.info('WhatsApp voice transcribed', {
        textLength: transcription.text.length,
        preview: transcription.text.slice(0, 50),
      });

      return { text: transcription.text };
    } catch (err) {
      log.error('Failed to transcribe WhatsApp voice message', { error: String(err) });
      return null;
    }
  }

  async stop(): Promise<void> {
    if (this.sock) {
      this.sock.ev.removeAllListeners('creds.update');
      this.sock.ev.removeAllListeners('connection.update');
      this.sock.ev.removeAllListeners('messages.upsert');
      // Don't call logout() - just close connection, keep session valid
      // (like closing WhatsApp Web tab without logging out)
      this.sock.end(undefined);
      this.sock = null;
      this._connected = false;
      this.startedAt = null;
      log.info('WhatsApp adapter stopped');
    }
  }

  async sendMessage(chatId: string, content: string, _options?: SendOptions): Promise<void> {
    if (!this.sock || !this._connected) {
      throw new Error('WhatsApp not connected');
    }

    const jid = extractRawId(chatId);

    const result = await this.sock.sendMessage(jid, { text: content });

    // Track sent message ID to avoid processing our own messages
    if (result?.key?.id) {
      this.sentMessageIds.add(result.key.id);
      // Clean up old IDs after 1 minute to prevent memory leak
      setTimeout(() => this.sentMessageIds.delete(result.key.id!), 60000);
    }

    log.info('Sent WhatsApp message', {
      chatId,
      length: content.length,
    });
  }

  async sendVoice(chatId: string, audioBuffer: Buffer): Promise<void> {
    if (!this.sock || !this._connected) {
      throw new Error('WhatsApp not connected');
    }

    const jid = extractRawId(chatId);

    const result = await this.sock.sendMessage(jid, {
      audio: audioBuffer,
      mimetype: 'audio/ogg; codecs=opus',
      ptt: true, // Push-to-talk (voice message)
    });

    // Track sent message ID to avoid processing our own messages
    if (result?.key?.id) {
      this.sentMessageIds.add(result.key.id);
      setTimeout(() => this.sentMessageIds.delete(result.key.id!), 60000);
    }

    log.info('Sent WhatsApp voice message', {
      chatId,
      audioSize: audioBuffer.length,
    });
  }

  isConnected(): boolean {
    return this.sock !== null && this._connected;
  }

  getStatus(): AdapterStatus {
    return {
      connected: this._connected,
      startedAt: this.startedAt?.toISOString() || null,
      uptime: this.startedAt ? Math.floor((Date.now() - this.startedAt.getTime()) / 1000) : 0,
      lastError: this.lastError || undefined,
      details: this.sock?.user
        ? {
            id: this.sock.user.id,
            name: this.sock.user.name,
          }
        : undefined,
    };
  }

  /**
   * Get current QR code for Portal UI display
   */
  getQrCode(): { qr: string; generatedAt: string } | null {
    if (!this.currentQrCode) return null;
    return {
      qr: this.currentQrCode,
      generatedAt: this.qrCodeUpdatedAt?.toISOString() || new Date().toISOString(),
    };
  }
}

// Export convenience function
export function createWhatsAppAdapter(): WhatsAppAdapter {
  return new WhatsAppAdapter();
}
