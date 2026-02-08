#!/usr/bin/env tsx
/**
 * KITT Kokoro TTS CLI
 * Generate high-quality speech locally using Kokoro 82M via MLX-Audio
 *
 * Usage:
 *   npm run tts:kokoro -- "Hello world"                           # Generate and send to Telegram
 *   npm run tts:kokoro -- --file path/to/file.md                  # Generate from file
 *   npm run tts:kokoro -- --file path/to/file.md --no-send        # Generate only, don't send
 *   npm run tts:kokoro -- --file path.md --voice am_adam          # Use specific voice
 *   npm run tts:kokoro -- --file path.md --out /path/out.mp3      # Custom output path
 *   npm run tts:kokoro -- --voices                                # List available voices
 *
 * Voices (selection):
 *   US Female: af_heart, af_bella, af_nova, af_sky, af_sarah, af_jessica, af_nicole, af_river
 *   US Male:   am_adam, am_echo, am_eric, am_fenrir, am_liam, am_michael, am_onyx, am_puck
 *   UK Female: bf_alice, bf_emma, bf_isabella, bf_lily
 *   UK Male:   bm_daniel, bm_fable, bm_george, bm_lewis
 */

import 'dotenv/config';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = process.cwd();
const VENV_ACTIVATE = path.join(PROJECT_ROOT, '.venv/kokoro/bin/activate');
const MODEL = 'prince-canuma/Kokoro-82M';
const DEFAULT_VOICE = 'am_adam';
const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const CHAT_ID = process.env.TELEGRAM_ALLOWED_USERS;

const VOICES: Record<string, string[]> = {
  'US Female': ['af_alloy', 'af_aoede', 'af_bella', 'af_heart', 'af_jessica', 'af_kore', 'af_nicole', 'af_nova', 'af_river', 'af_sarah', 'af_sky'],
  'US Male': ['am_adam', 'am_echo', 'am_eric', 'am_fenrir', 'am_liam', 'am_michael', 'am_onyx', 'am_puck'],
  'UK Female': ['bf_alice', 'bf_emma', 'bf_isabella', 'bf_lily'],
  'UK Male': ['bm_daniel', 'bm_fable', 'bm_george', 'bm_lewis'],
};

/**
 * Strip markdown frontmatter (---...---) from text
 */
function stripFrontmatter(text: string): string {
  const match = text.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return match ? match[1].trim() : text;
}

/**
 * Clean text for TTS - remove markdown formatting
 */
function cleanText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/---+/g, '')
    .replace(/\|[^\n]+\|/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Generate audio using Kokoro via mlx-audio Python CLI
 */
function generateAudio(text: string, voice: string, outputDir: string, prefix: string, speed: number = 1.0): string {
  // Write text to temp file to avoid shell escaping issues
  const textFile = `/tmp/kokoro-input-${Date.now()}.txt`;
  fs.writeFileSync(textFile, text);

  try {
    const cmd = `source "${VENV_ACTIVATE}" && python3 -m mlx_audio.tts.generate --model ${MODEL} --voice ${voice} --speed ${speed} --join_audio --output_path "${outputDir}" --file_prefix "${prefix}" --text "$(cat "${textFile}")"`;

    execSync(cmd, {
      shell: '/bin/zsh',
      stdio: ['pipe', 'inherit', 'inherit'],
      timeout: 600000, // 10 min max
      maxBuffer: 10 * 1024 * 1024,
    });
  } finally {
    if (fs.existsSync(textFile)) fs.unlinkSync(textFile);
  }

  // mlx-audio output: prefix.wav (joined) or prefix_000.wav (chunked)
  const joinedFile = path.join(outputDir, `${prefix}.wav`);
  const chunkedFile = path.join(outputDir, `${prefix}_000.wav`);
  const outputFile = fs.existsSync(joinedFile) ? joinedFile : chunkedFile;
  if (!fs.existsSync(outputFile)) {
    throw new Error('Audio generation failed - no output file created');
  }
  return outputFile;
}

/**
 * Convert WAV to MP3 using ffmpeg
 */
function convertToMp3(wavPath: string, mp3Path: string): void {
  execSync(`ffmpeg -y -i "${wavPath}" -codec:a libmp3lame -qscale:a 2 "${mp3Path}" 2>/dev/null`, {
    shell: '/bin/zsh',
  });
}

/**
 * Send voice message via Telegram API
 */
async function sendVoice(mp3Path: string): Promise<void> {
  const audioBuffer = fs.readFileSync(mp3Path);
  const formData = new FormData();
  formData.append('chat_id', CHAT_ID!);
  formData.append('voice', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'voice.mp3');

  const response = await fetch(`${TELEGRAM_API}/sendVoice`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${response.status} - ${error}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // List voices
  if (args.includes('--voices')) {
    console.log('🎙️  Available Kokoro voices:\n');
    for (const [category, voices] of Object.entries(VOICES)) {
      console.log(`${category}: ${voices.join(', ')}`);
    }
    process.exit(0);
  }

  // Help
  if (args.length === 0 || args[0] === '--help') {
    console.log('🎙️  KITT Kokoro TTS CLI (local, high-quality, free)');
    console.log('');
    console.log('Usage:');
    console.log('  npm run tts:kokoro -- "Your text here"                    Generate & send to Telegram');
    console.log('  npm run tts:kokoro -- --file path/to/file.md              Generate from file & send');
    console.log('  npm run tts:kokoro -- --file path.md --no-send            Generate only (no Telegram)');
    console.log('  npm run tts:kokoro -- --file path.md --voice am_adam      Use specific voice');
    console.log('  npm run tts:kokoro -- --file path.md --out /path/out.mp3  Custom output path');
    console.log('  npm run tts:kokoro -- --voices                            List available voices');
    process.exit(0);
  }

  // Check venv exists
  if (!fs.existsSync(VENV_ACTIVATE)) {
    console.error('❌ Kokoro venv not found at .venv/kokoro/');
    console.error('   Setup: python3.12 -m venv .venv/kokoro && source .venv/kokoro/bin/activate && pip install mlx-audio "misaki[en]" num2words');
    process.exit(1);
  }

  // Check ffmpeg
  try {
    execSync('which ffmpeg', { stdio: 'pipe' });
  } catch {
    console.error('❌ ffmpeg not found. Install with: brew install ffmpeg');
    process.exit(1);
  }

  // Parse args
  const noSend = args.includes('--no-send');
  const voiceIdx = args.indexOf('--voice');
  const voice = voiceIdx !== -1 ? args[voiceIdx + 1] : DEFAULT_VOICE;
  const speedIdx = args.indexOf('--speed');
  const speed = speedIdx !== -1 ? parseFloat(args[speedIdx + 1]) : 1.0;
  const fileIdx = args.indexOf('--file');
  const outIdx = args.indexOf('--out');

  let text: string;
  if (fileIdx !== -1) {
    const filePath = args[fileIdx + 1];
    if (!filePath || !fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      process.exit(1);
    }
    text = stripFrontmatter(fs.readFileSync(filePath, 'utf-8'));
    console.log(`📄 Reading: ${filePath}`);
  } else {
    // Collect text args (skip flags and their values)
    const skipNext = new Set<number>();
    for (let i = 0; i < args.length; i++) {
      if (['--voice', '--out', '--speed'].includes(args[i])) skipNext.add(i + 1);
    }
    text = args.filter((a, i) => !a.startsWith('--') && !skipNext.has(i)).join(' ');
  }

  if (!text.trim()) {
    console.error('❌ No text provided');
    process.exit(1);
  }

  const cleaned = cleanText(text);
  console.log(`🎙️  Voice: ${voice}`);
  console.log(`⚡ Speed: ${speed}x`);
  console.log(`🔊 Generating speech (${cleaned.length} chars)...`);

  // Generate WAV
  const timestamp = Date.now();
  const prefix = `kokoro-${timestamp}`;
  const wavPath = generateAudio(cleaned, voice, '/tmp', prefix, speed);

  const wavSize = fs.statSync(wavPath).size;
  console.log(`✅ WAV generated (${(wavSize / 1024).toFixed(0)} KB)`);

  // Convert to MP3
  const mp3Path = outIdx !== -1 ? args[outIdx + 1] : `/tmp/kokoro-${timestamp}.mp3`;
  convertToMp3(wavPath, mp3Path);

  const mp3Size = fs.statSync(mp3Path).size;
  console.log(`✅ MP3 converted (${(mp3Size / 1024).toFixed(0)} KB)`);
  console.log(`💾 Saved: ${mp3Path}`);

  // Clean up WAV
  fs.unlinkSync(wavPath);

  // Send to Telegram
  if (!noSend) {
    if (!process.env.TELEGRAM_BOT_TOKEN || !CHAT_ID) {
      console.warn('⚠️  Telegram not configured, skipping send');
    } else {
      console.log('📤 Sending to Telegram...');
      await sendVoice(mp3Path);
      console.log('✅ Voice message sent!');
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
