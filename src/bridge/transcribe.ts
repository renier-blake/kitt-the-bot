/**
 * KITT Voice Transcription Service
 *
 * Uses OpenAI Whisper API to transcribe voice messages
 */

import { log } from './logger.js';

const OPENAI_WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';

export interface TranscriptionResult {
  text: string;
  success: boolean;
  error?: string;
}

/**
 * Transcribe audio buffer using OpenAI Whisper API
 *
 * @param audioBuffer - The audio file buffer (OGG format from Telegram)
 * @param filename - Original filename for the audio
 * @returns Transcription result with text or error
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  filename = 'voice.ogg'
): Promise<TranscriptionResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    log.error('OPENAI_API_KEY not configured for transcription');
    return {
      text: '',
      success: false,
      error: 'OpenAI API key not configured',
    };
  }

  try {
    // Create form data with the audio file
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: 'audio/ogg' });
    formData.append('file', blob, filename);
    formData.append('model', 'whisper-1');
    formData.append('language', 'nl'); // Dutch as default, Whisper auto-detects if wrong

    log.info('Sending audio to Whisper API', {
      fileSize: audioBuffer.length,
      filename,
    });

    const response = await fetch(OPENAI_WHISPER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error('Whisper API error', {
        status: response.status,
        error: errorText,
      });
      return {
        text: '',
        success: false,
        error: `Whisper API error: ${response.status}`,
      };
    }

    const data = (await response.json()) as { text: string };

    log.info('Transcription successful', {
      textLength: data.text.length,
      preview: data.text.slice(0, 50),
    });

    return {
      text: data.text.trim(),
      success: true,
    };
  } catch (err) {
    log.error('Transcription failed', { error: String(err) });
    return {
      text: '',
      success: false,
      error: String(err),
    };
  }
}

/**
 * Download file from Telegram and return as buffer
 *
 * @param fileUrl - Full URL to download the file from
 * @returns Buffer with file contents
 */
export async function downloadTelegramFile(fileUrl: string): Promise<Buffer> {
  const response = await fetch(fileUrl);

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
