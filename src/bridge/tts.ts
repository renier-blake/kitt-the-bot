/**
 * KITT Text-to-Speech Service
 *
 * Uses Google Cloud TTS for high-quality Dutch speech generation.
 * Returns OGG Opus directly — no local dependencies needed.
 */

import { getCredential } from '../credentials/index.js';
import { getConfigValue } from '../integrations/config.js';
import { log } from './logger.js';

const GOOGLE_TTS_API = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const DEFAULT_VOICE = 'nl-NL-Wavenet-G'; // Male Dutch WaveNet

export interface TTSResult {
  audio: Buffer;
  success: boolean;
  error?: string;
}

export interface TTSOptions {
  voice?: string;
  speed?: number;
}

/**
 * Content analysis result for voice mode routing
 */
export interface VoiceContentAnalysis {
  mode: 'voice' | 'mixed' | 'text';
  /** Full content for voice-only mode */
  voicePart?: string;
  /** Structured content (tables/code) to send as text */
  textPart?: string;
}

/**
 * Generate speech from text using Google Cloud TTS
 *
 * @param text - The text to convert to speech
 * @param options - Optional TTS settings (voice, speed)
 * @returns TTS result with audio buffer (OGG Opus) or error
 */
export async function textToSpeech(
  text: string,
  options: TTSOptions = {}
): Promise<TTSResult> {
  const apiKey = await getCredential('GOOGLE_CLOUD_TTS_API_KEY');
  if (!apiKey) {
    return {
      audio: Buffer.alloc(0),
      success: false,
      error: 'Google Cloud TTS API key not configured',
    };
  }

  // Clean text for speech
  const cleanedText = cleanTextForTTS(text);

  if (!cleanedText.trim()) {
    return {
      audio: Buffer.alloc(0),
      success: false,
      error: 'No speakable text after cleaning',
    };
  }

  // Read voice preference from Portal-configured integration settings
  const configuredVoice = await getConfigValue('google_cloud_tts_voice');
  const voice = options.voice || configuredVoice || DEFAULT_VOICE;
  const language = voice.substring(0, 5); // Extract 'nl-NL' from voice name

  try {
    log.info('Generating Google Cloud TTS', {
      textLength: cleanedText.length,
      voice,
      preview: cleanedText.slice(0, 50),
    });

    const response = await fetch(`${GOOGLE_TTS_API}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: cleanedText },
        voice: { languageCode: language, name: voice },
        audioConfig: {
          audioEncoding: 'OGG_OPUS',
          sampleRateHertz: 24000,
          speakingRate: options.speed ?? 1.0,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      log.error('Google Cloud TTS API error', { status: response.status, error: errText });
      return {
        audio: Buffer.alloc(0),
        success: false,
        error: `Google TTS API error: ${response.status}`,
      };
    }

    const data = await response.json() as { audioContent: string };
    const audioBuffer = Buffer.from(data.audioContent, 'base64');

    log.info('Google Cloud TTS successful', {
      audioSize: audioBuffer.length,
      textLength: cleanedText.length,
      voice,
    });

    return {
      audio: audioBuffer,
      success: true,
    };
  } catch (err) {
    log.error('Google Cloud TTS failed', { error: String(err) });
    return {
      audio: Buffer.alloc(0),
      success: false,
      error: String(err),
    };
  }
}

/**
 * Analyze content to determine how it should be sent in voice mode.
 *
 * - Pure conversational text → voice (any length)
 * - Contains tables or code blocks → mixed (data as text, rest as voice)
 * - Only tables/code with no prose → text only
 */
export function analyzeContentForVoice(content: string): VoiceContentAnalysis {
  const lines = content.split('\n');
  const textLines: string[] = [];
  const structuredLines: string[] = [];

  let inCodeBlock = false;
  let inTable = false;

  for (const line of lines) {
    // Track code blocks
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      structuredLines.push(line);
      continue;
    }

    if (inCodeBlock) {
      structuredLines.push(line);
      continue;
    }

    // Track table rows (lines starting/ending with |, or separator rows like |---|)
    const isTableRow = /^\s*\|.*\|\s*$/.test(line);
    const isTableSeparator = /^\s*\|[\s\-:|]+\|\s*$/.test(line);

    if (isTableRow || isTableSeparator) {
      inTable = true;
      structuredLines.push(line);
      continue;
    }

    // End of table
    if (inTable && !isTableRow) {
      inTable = false;
    }

    textLines.push(line);
  }

  const hasStructured = structuredLines.length > 0;
  const voiceText = textLines.join('\n').trim();
  const structuredText = structuredLines.join('\n').trim();

  if (!hasStructured) {
    // Pure conversational content → all voice
    return { mode: 'voice', voicePart: content };
  }

  if (!voiceText) {
    // Only structured content → text only
    return { mode: 'text' };
  }

  // Mixed: structured data as text + prose as voice
  return {
    mode: 'mixed',
    textPart: structuredText,
    voicePart: voiceText,
  };
}

/**
 * Clean text for TTS - remove markdown, emojis, and other non-speakable content
 */
export function cleanTextForTTS(text: string): string {
  return text
    // Remove emojis
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{1F700}-\u{1F77F}]/gu, '')
    .replace(/[\u{1F780}-\u{1F7FF}]/gu, '')
    .replace(/[\u{1F800}-\u{1F8FF}]/gu, '')
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '')
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    // Remove markdown formatting
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/---+/g, '')
    .replace(/\|[^\n]+\|/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
