#!/usr/bin/env npx tsx
/**
 * Gmail API CLI via Nango
 * Usage: npx tsx .claude/skills/gmail/gmail-api.ts <command> [options]
 */

import { config } from 'dotenv';
config();

import { proxyRequest, isConnected } from '../../../src/integrations/nango.js';

const INTEGRATION_ID = 'google-mail';

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{
      mimeType: string;
      body?: { data?: string };
      parts?: Array<{ mimeType: string; body?: { data?: string } }>;
    }>;
  };
  internalDate?: string;
}

interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  resultSizeEstimate?: number;
}

function decodeBase64(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function getHeader(message: GmailMessage, name: string): string {
  const header = message.payload?.headers?.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  );
  return header?.value || '';
}

function getBody(message: GmailMessage): string {
  const payload = message.payload;
  if (!payload) return '';

  // Direct body
  if (payload.body?.data) {
    return decodeBase64(payload.body.data);
  }

  // Check parts for text/plain or text/html
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64(part.body.data);
      }
      // Nested parts (multipart/alternative inside multipart/mixed)
      if (part.parts) {
        for (const subpart of part.parts) {
          if (subpart.mimeType === 'text/plain' && subpart.body?.data) {
            return decodeBase64(subpart.body.data);
          }
        }
      }
    }
    // Fallback to HTML if no plain text
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        // Strip HTML tags for readability
        return decodeBase64(part.body.data).replace(/<[^>]*>/g, '');
      }
    }
  }

  return '';
}

function formatDate(internalDate: string): string {
  const date = new Date(parseInt(internalDate));
  return date.toLocaleString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Amsterdam',
  });
}

function formatTime(internalDate: string): string {
  const date = new Date(parseInt(internalDate));
  return date.toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Amsterdam',
  });
}

async function checkConnection(): Promise<boolean> {
  const connected = await isConnected(INTEGRATION_ID);
  if (!connected) {
    console.error('❌ Gmail niet verbonden. Koppel via Nango dashboard.');
    process.exit(1);
  }
  return true;
}

async function getProfile(): Promise<void> {
  await checkConnection();
  const profile = await proxyRequest<{ emailAddress: string; messagesTotal: number }>(
    INTEGRATION_ID,
    { endpoint: '/gmail/v1/users/me/profile' }
  );
  console.log(`📧 Gmail Profile`);
  console.log(`Email: ${profile.emailAddress}`);
  console.log(`Totaal berichten: ${profile.messagesTotal.toLocaleString()}`);
}

async function getLabels(): Promise<void> {
  await checkConnection();
  const result = await proxyRequest<{ labels: Array<{ id: string; name: string; type: string }> }>(
    INTEGRATION_ID,
    { endpoint: '/gmail/v1/users/me/labels' }
  );
  console.log(`🏷️ Labels (${result.labels.length}):\n`);
  const userLabels = result.labels.filter((l) => l.type === 'user');
  const systemLabels = result.labels.filter((l) => l.type === 'system');

  if (systemLabels.length > 0) {
    console.log('System:');
    systemLabels.forEach((l) => console.log(`  - ${l.name}`));
  }
  if (userLabels.length > 0) {
    console.log('\nUser:');
    userLabels.forEach((l) => console.log(`  - ${l.name}`));
  }
}

async function listMessages(query: string, maxResults: number): Promise<void> {
  await checkConnection();

  const params: Record<string, string> = { maxResults: String(maxResults) };
  if (query) params.q = query;

  const list = await proxyRequest<GmailListResponse>(INTEGRATION_ID, {
    endpoint: '/gmail/v1/users/me/messages',
    params,
  });

  if (!list.messages || list.messages.length === 0) {
    console.log('📭 Geen berichten gevonden.');
    return;
  }

  console.log(`📬 ${list.messages.length} berichten:\n`);

  for (let i = 0; i < list.messages.length; i++) {
    const msg = await proxyRequest<GmailMessage>(INTEGRATION_ID, {
      endpoint: `/gmail/v1/users/me/messages/${list.messages[i].id}`,
      params: { format: 'full' },
    });

    const from = getHeader(msg, 'From');
    const subject = getHeader(msg, 'Subject') || '(geen onderwerp)';
    const time = msg.internalDate ? formatTime(msg.internalDate) : '';
    const preview = msg.snippet ? msg.snippet.slice(0, 60) + '...' : '';

    console.log(`${i + 1}. [${msg.id}] ${time}`);
    console.log(`   Van: ${from}`);
    console.log(`   Onderwerp: ${subject}`);
    if (preview) console.log(`   Preview: ${preview}`);
    console.log('');
  }
}

async function readMessage(messageId: string): Promise<void> {
  await checkConnection();

  const msg = await proxyRequest<GmailMessage>(INTEGRATION_ID, {
    endpoint: `/gmail/v1/users/me/messages/${messageId}`,
    params: { format: 'full' },
  });

  const from = getHeader(msg, 'From');
  const to = getHeader(msg, 'To');
  const subject = getHeader(msg, 'Subject') || '(geen onderwerp)';
  const date = msg.internalDate ? formatDate(msg.internalDate) : '';
  const body = getBody(msg);

  console.log(`📧 Email Details:`);
  console.log(`Van: ${from}`);
  console.log(`Aan: ${to}`);
  console.log(`Datum: ${date}`);
  console.log(`Onderwerp: ${subject}`);
  console.log(`\n---\n${body}`);
}

async function sendMessage(to: string, subject: string): Promise<void> {
  await checkConnection();

  // Read body from stdin
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString('utf-8').trim();

  if (!body) {
    console.error('❌ Email body is leeg. Pipe content via stdin.');
    process.exit(1);
  }

  // Construct RFC 2822 message
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ].join('\r\n');

  // Base64url encode
  const encoded = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const result = await proxyRequest<{ id: string; threadId: string }>(INTEGRATION_ID, {
    endpoint: '/gmail/v1/users/me/messages/send',
    method: 'POST',
    data: { raw: encoded },
  });

  console.log(`✅ Email verzonden!`);
  console.log(`Message ID: ${result.id}`);
}

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;

  if (!command) {
    console.log(`Usage: npx tsx gmail-api.ts <command> [options]

Commands:
  profile           Email adres en totaal berichten
  labels            Lijst alle labels
  unread [n]        Laatste n ongelezen emails (default: 5)
  inbox [n]         Laatste n emails uit inbox (default: 5)
  read <messageId>  Lees volledige email
  search <query> [n] Zoek emails (default: 5)
  send <to> <subj>  Stuur email (body via stdin)`);
    process.exit(0);
  }

  try {
    switch (command) {
      case 'profile':
        await getProfile();
        break;

      case 'labels':
        await getLabels();
        break;

      case 'unread': {
        const n = parseInt(args[0]) || 5;
        await listMessages('is:unread', n);
        break;
      }

      case 'inbox': {
        const n = parseInt(args[0]) || 5;
        await listMessages('in:inbox', n);
        break;
      }

      case 'read': {
        const messageId = args[0];
        if (!messageId) {
          console.error('❌ Message ID required');
          process.exit(1);
        }
        await readMessage(messageId);
        break;
      }

      case 'search': {
        const query = args[0];
        const n = parseInt(args[1]) || 5;
        if (!query) {
          console.error('❌ Search query required');
          process.exit(1);
        }
        await listMessages(query, n);
        break;
      }

      case 'send': {
        const to = args[0];
        const subject = args[1];
        if (!to || !subject) {
          console.error('❌ Usage: send <to> <subject>');
          process.exit(1);
        }
        await sendMessage(to, subject);
        break;
      }

      default:
        console.error(`❌ Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (err) {
    console.error(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();
