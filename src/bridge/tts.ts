/**
 * KITT Text-to-Speech Service
 *
 * Uses ElevenLabs API to generate voice responses
 */

import { log } from './logger.js';

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

// Default voice: Custom KITT voice
const DEFAULT_VOICE_ID = '60CwgZt94Yf7yYIXMDDe';

export interface TTSResult {
  audio: Buffer;
  success: boolean;
  error?: string;
}

export interface TTSOptions {
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  speed?: number; // 0.25 to 4.0, default 1.25
}

/**
 * Generate speech from text using ElevenLabs API
 *
 * @param text - The text to convert to speech
 * @param options - Optional TTS settings
 * @returns TTS result with audio buffer or error
 */
export async function textToSpeech(
  text: string,
  options: TTSOptions = {}
): Promise<TTSResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = options.voiceId || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

  if (!apiKey) {
    log.error('ELEVENLABS_API_KEY not configured');
    return {
      audio: Buffer.alloc(0),
      success: false,
      error: 'ElevenLabs API key not configured',
    };
  }

  // Clean text for speech (remove markdown, emojis)
  const cleanedText = cleanTextForTTS(text);

  // Limit text length to avoid huge API costs
  const maxLength = 5000;
  const truncatedText = cleanedText.length > maxLength
    ? cleanedText.slice(0, maxLength) + '...'
    : cleanedText;

  try {
    log.info('Sending text to ElevenLabs TTS', {
      textLength: truncatedText.length,
      voiceId,
      preview: truncatedText.slice(0, 50),
    });

    const response = await fetch(`${ELEVENLABS_API_URL}/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: truncatedText,
        model_id: options.modelId || 'eleven_multilingual_v2',
        voice_settings: {
          stability: options.stability ?? 0.5,
          similarity_boost: options.similarityBoost ?? 0.75,
          speed: options.speed ?? 1.25,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error('ElevenLabs API error', {
        status: response.status,
        error: errorText,
      });
      return {
        audio: Buffer.alloc(0),
        success: false,
        error: `ElevenLabs API error: ${response.status} - ${errorText}`,
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    log.info('TTS generation successful', {
      audioSize: audioBuffer.length,
    });

    return {
      audio: audioBuffer,
      success: true,
    };
  } catch (err) {
    log.error('TTS generation failed', { error: String(err) });
    return {
      audio: Buffer.alloc(0),
      success: false,
      error: String(err),
    };
  }
}

/**
 * Check if a message should trigger a voice response
 *
 * @param isVoiceInput - Whether the user sent a voice message
 * @param messageText - The user's message text (for command detection)
 * @returns Whether to respond with voice
 */
export function shouldRespondWithVoice(
  isVoiceInput: boolean,
  messageText: string
): boolean {
  const lowerText = messageText.toLowerCase();

  // Explicit text request
  if (lowerText.includes('type het') || lowerText.includes('tekst') || lowerText.includes('schrijf')) {
    return false;
  }

  // Only voice response when explicitly requested with "vertel het even"
  if (lowerText.includes('vertel het even') || lowerText.includes('vertel even')) {
    return true;
  }

  return false;
}

/**
 * Clean text for TTS - remove markdown, emojis, and other non-speakable content
 *
 * @param text - Raw text with markdown/emojis
 * @returns Clean text suitable for speech
 */
export function cleanTextForTTS(text: string): string {
  return text
    // Remove emoji's
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc symbols
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport
    .replace(/[\u{1F700}-\u{1F77F}]/gu, '') // Alchemical
    .replace(/[\u{1F780}-\u{1F7FF}]/gu, '') // Geometric
    .replace(/[\u{1F800}-\u{1F8FF}]/gu, '') // Supplemental arrows
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental symbols
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols extended
    .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
    // Remove markdown formatting
    .replace(/\*\*([^*]+)\*\*/g, '$1')      // **bold** → bold
    .replace(/\*([^*]+)\*/g, '$1')          // *italic* → italic
    .replace(/_([^_]+)_/g, '$1')            // _italic_ → italic
    .replace(/~~([^~]+)~~/g, '$1')          // ~~strike~~ → strike
    .replace(/`([^`]+)`/g, '$1')            // `code` → code
    .replace(/```[\s\S]*?```/g, '')         // Remove code blocks entirely
    .replace(/^#+\s*/gm, '')                // Remove # headers
    .replace(/^\s*[-*]\s+/gm, '')           // Remove bullet points
    .replace(/^\s*\d+\.\s+/gm, '')          // Remove numbered lists
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [link](url) → link
    .replace(/\n{3,}/g, '\n\n')             // Multiple newlines → double
    .trim();
}
