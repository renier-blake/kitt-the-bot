#!/usr/bin/env tsx
/**
 * KITT Podcast CLI
 * Upload audio to Podbean and publish as podcast episode
 *
 * Usage:
 *   npm run podcast -- --file path/to/audio.mp3 --title "Episode Title"
 *   npm run podcast -- --file path/to/audio.mp3 --title "Title" --description "<p>Show notes</p>"
 *   npm run podcast -- --file path/to/audio.mp3 --title "Title" --draft
 *   npm run podcast -- --file path/to/audio.mp3 --title "Title" --logo path/to/image.png
 *
 * Environment:
 *   PODBEAN_CLIENT_ID      - From developers.podbean.com
 *   PODBEAN_CLIENT_SECRET   - From developers.podbean.com
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'https://api.podbean.com/v1';
const TOKEN_CACHE = '/tmp/podbean-token.json';

// ── Auth ────────────────────────────────────────────────────────────

interface TokenCache {
  access_token: string;
  expires_at: number;
}

async function getAccessToken(): Promise<string> {
  // Check cache
  if (fs.existsSync(TOKEN_CACHE)) {
    const cached: TokenCache = JSON.parse(fs.readFileSync(TOKEN_CACHE, 'utf-8'));
    if (Date.now() < cached.expires_at - 60000) { // 1 min buffer
      return cached.access_token;
    }
  }

  const clientId = process.env.PODBEAN_CLIENT_ID;
  const clientSecret = process.env.PODBEAN_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing PODBEAN_CLIENT_ID or PODBEAN_CLIENT_SECRET in .env');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${API_BASE}/oauth/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Auth failed (${response.status}): ${error}`);
  }

  const data = await response.json() as { access_token: string; expires_in: number };

  // Cache token
  const cache: TokenCache = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
  fs.writeFileSync(TOKEN_CACHE, JSON.stringify(cache));

  return data.access_token;
}

// ── Podcast ID ──────────────────────────────────────────────────────

async function getPodcastId(token: string): Promise<string> {
  // Check env first
  if (process.env.PODBEAN_PODCAST_ID) {
    return process.env.PODBEAN_PODCAST_ID;
  }

  const response = await fetch(`${API_BASE}/podcasts?access_token=${token}`);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get podcasts (${response.status}): ${error}`);
  }

  const data = await response.json() as { podcasts: Array<{ id: string; title: string }> };

  if (!data.podcasts || data.podcasts.length === 0) {
    throw new Error('No podcasts found on this Podbean account. Create one first at podbean.com');
  }

  const podcast = data.podcasts[0];
  console.log(`📻 Podcast: ${podcast.title} (${podcast.id})`);
  return podcast.id;
}

// ── Upload ──────────────────────────────────────────────────────────

interface UploadAuth {
  presigned_url: string;
  file_key: string;
}

async function authorizeUpload(token: string, filePath: string, contentType: string): Promise<UploadAuth> {
  const stats = fs.statSync(filePath);
  const filename = path.basename(filePath);

  const params = new URLSearchParams({
    access_token: token,
    filename,
    filesize: stats.size.toString(),
    content_type: contentType,
  });

  const response = await fetch(`${API_BASE}/files/uploadAuthorize?${params}`);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Upload auth failed (${response.status}): ${error}`);
  }

  return await response.json() as UploadAuth;
}

async function uploadFile(presignedUrl: string, filePath: string, contentType: string): Promise<void> {
  const fileBuffer = fs.readFileSync(filePath);

  const response = await fetch(presignedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body: fileBuffer,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Upload failed (${response.status}): ${error}`);
  }
}

// ── Publish ─────────────────────────────────────────────────────────

interface Episode {
  id: string;
  title: string;
  permalink_url: string;
  player_url: string;
  media_url: string;
}

async function publishEpisode(
  token: string,
  podcastId: string,
  title: string,
  content: string,
  mediaKey: string,
  logoKey: string | null,
  isDraft: boolean,
): Promise<Episode> {
  const params = new URLSearchParams({
    access_token: token,
    podcast_id: podcastId,
    title,
    content,
    media_key: mediaKey,
    status: isDraft ? 'draft' : 'publish',
    type: 'public',
  });

  if (logoKey) {
    params.append('logo_key', logoKey);
  }

  const response = await fetch(`${API_BASE}/episodes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Publish failed (${response.status}): ${error}`);
  }

  const data = await response.json() as { episode: Episode };
  return data.episode;
}

// ── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Help
  if (args.length === 0 || args[0] === '--help') {
    console.log('🎙️  KITT Podcast CLI (Podbean)');
    console.log('');
    console.log('Usage:');
    console.log('  npm run podcast -- --file audio.mp3 --title "Episode Title"');
    console.log('  npm run podcast -- --file audio.mp3 --title "Title" --description "<p>Notes</p>"');
    console.log('  npm run podcast -- --file audio.mp3 --title "Title" --draft');
    console.log('  npm run podcast -- --file audio.mp3 --title "Title" --logo image.png');
    console.log('');
    console.log('Options:');
    console.log('  --file          Path to MP3 file (required)');
    console.log('  --title         Episode title (required)');
    console.log('  --description   Episode description/show notes (HTML)');
    console.log('  --draft         Publish as draft instead of public');
    console.log('  --logo          Path to episode artwork (PNG/JPG)');
    process.exit(0);
  }

  // Parse args
  const fileIdx = args.indexOf('--file');
  const titleIdx = args.indexOf('--title');
  const descIdx = args.indexOf('--description');
  const logoIdx = args.indexOf('--logo');
  const isDraft = args.includes('--draft');

  if (fileIdx === -1 || !args[fileIdx + 1]) {
    console.error('❌ --file is required');
    process.exit(1);
  }
  if (titleIdx === -1 || !args[titleIdx + 1]) {
    console.error('❌ --title is required');
    process.exit(1);
  }

  const filePath = args[fileIdx + 1];
  const title = args[titleIdx + 1];
  const description = descIdx !== -1 ? args[descIdx + 1] : `<p>${title}</p>`;
  const logoPath = logoIdx !== -1 ? args[logoIdx + 1] : null;

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  if (logoPath && !fs.existsSync(logoPath)) {
    console.error(`❌ Logo not found: ${logoPath}`);
    process.exit(1);
  }

  const fileSize = (fs.statSync(filePath).size / (1024 * 1024)).toFixed(1);
  console.log(`📄 File: ${filePath} (${fileSize} MB)`);
  console.log(`📝 Title: ${title}`);
  console.log(`📋 Status: ${isDraft ? 'draft' : 'publish'}`);
  console.log('');

  // 1. Authenticate
  console.log('🔑 Authenticating...');
  const token = await getAccessToken();
  console.log('✅ Authenticated');

  // 2. Get podcast ID
  const podcastId = await getPodcastId(token);

  // 3. Upload audio
  console.log('📤 Uploading audio...');
  const audioAuth = await authorizeUpload(token, filePath, 'audio/mpeg');
  await uploadFile(audioAuth.presigned_url, filePath, 'audio/mpeg');
  console.log(`✅ Audio uploaded (key: ${audioAuth.file_key})`);

  // 4. Upload logo (optional)
  let logoKey: string | null = null;
  if (logoPath) {
    console.log('🖼️  Uploading logo...');
    const ext = path.extname(logoPath).toLowerCase();
    const logoContentType = ext === '.png' ? 'image/png' : 'image/jpeg';
    const logoAuth = await authorizeUpload(token, logoPath, logoContentType);
    await uploadFile(logoAuth.presigned_url, logoPath, logoContentType);
    logoKey = logoAuth.file_key;
    console.log(`✅ Logo uploaded (key: ${logoKey})`);
  }

  // 5. Publish episode
  console.log('🚀 Publishing episode...');
  const episode = await publishEpisode(token, podcastId, title, description, audioAuth.file_key, logoKey, isDraft);

  console.log('');
  console.log('✅ Episode published!');
  console.log('');
  console.log(`🎙️  Player:    ${episode.player_url}`);
  console.log(`🔗 Permalink: ${episode.permalink_url}`);
  console.log(`📥 Media:     ${episode.media_url}`);
}

main().catch((err) => {
  console.error('❌ Fatal error:', err.message || err);
  process.exit(1);
});
