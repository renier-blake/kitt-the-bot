#!/usr/bin/env tsx
/**
 * KITT TTS CLI
 * Generate speech from text and send as Telegram voice message
 *
 * Usage:
 *   npm run tts -- "Hello, this is a test"          # Send voice message with text
 *   npm run tts -- --file path/to/file.md           # Send voice message from file
 *   npm run tts -- --file path/to/file.md --save    # Also save MP3 locally
 *
 * Examples:
 *   npm run tts -- "Testing one two three"
 *   npm run tts -- --file frontends/kitt-website/blog/drafts/2026-02-08.md
 */

import 'dotenv/config';
import * as fs from 'fs';
import { textToSpeech, cleanTextForTTS } from '../bridge/tts.js';
import { getCredential } from '../credentials/index.js';

// Resolved in main() — need async credential access
let TELEGRAM_API = '';
let CHAT_ID = '';

/**
 * Strip markdown frontmatter (---...---) from text
 */
function stripFrontmatter(text: string): string {
  const match = text.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return match ? match[1].trim() : text;
}

/**
 * Send voice message via Telegram API directly
 */
async function sendVoice(audio: Buffer): Promise<void> {
  const formData = new FormData();
  formData.append('chat_id', CHAT_ID!);
  formData.append('voice', new Blob([audio], { type: 'audio/mpeg' }), 'voice.mp3');

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

  if (args.length === 0) {
    console.log('KITT TTS CLI');
    console.log('');
    console.log('Usage:');
    console.log('  npm run tts -- "Your text here"              Send text as voice');
    console.log('  npm run tts -- --file path/to/file.md        Send file as voice');
    console.log('  npm run tts -- --file path/to/file.md --save Also save MP3 locally');
    process.exit(0);
  }

  // Resolve credentials from vault
  const telegramToken = await getCredential('TELEGRAM_BOT_TOKEN');
  const ttsKey = await getCredential('GOOGLE_CLOUD_TTS_API_KEY');
  CHAT_ID = process.env.TELEGRAM_ALLOWED_USERS || '';
  TELEGRAM_API = `https://api.telegram.org/bot${telegramToken}`;

  if (!ttsKey) {
    console.error('❌ GOOGLE_CLOUD_TTS_API_KEY not set in vault or .env');
    process.exit(1);
  }
  if (!telegramToken || !CHAT_ID) {
    console.error('❌ TELEGRAM_BOT_TOKEN or TELEGRAM_ALLOWED_USERS not set');
    process.exit(1);
  }

  let text: string;
  const saveLocally = args.includes('--save');

  // Parse args
  const fileIndex = args.indexOf('--file');
  if (fileIndex !== -1) {
    const filePath = args[fileIndex + 1];
    if (!filePath) {
      console.error('❌ --file requires a path argument');
      process.exit(1);
    }
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      process.exit(1);
    }
    text = stripFrontmatter(fs.readFileSync(filePath, 'utf-8'));
    console.log(`📄 Reading: ${filePath}`);
  } else {
    // Join all non-flag args as text
    text = args.filter(a => a !== '--save').join(' ');
  }

  const cleaned = cleanTextForTTS(text);
  console.log(`🔊 Generating speech (${cleaned.length} chars)...`);

  // Generate TTS
  const result = await textToSpeech(cleaned);

  if (!result.success) {
    console.error(`❌ TTS failed: ${result.error}`);
    process.exit(1);
  }

  console.log(`✅ Audio generated (${(result.audio.length / 1024).toFixed(0)} KB)`);

  // Save locally if requested
  if (saveLocally) {
    const outPath = `/tmp/kitt-tts-${Date.now()}.mp3`;
    fs.writeFileSync(outPath, result.audio);
    console.log(`💾 Saved: ${outPath}`);
  }

  // Send via Telegram
  console.log('📤 Sending to Telegram...');
  await sendVoice(result.audio);
  console.log('✅ Voice message sent!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
