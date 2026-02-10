#!/usr/bin/env npx tsx
/**
 * Migrate Chat IDs to Channel-Prefixed Format
 *
 * This script updates existing chat IDs in the database to use the new
 * channel-prefixed format: telegram:123456, whatsapp:31612345@s.whatsapp.net
 *
 * Usage:
 *   npx tsx scripts/migrate-chat-ids.ts          # Dry run (default)
 *   npx tsx scripts/migrate-chat-ids.ts --apply  # Apply changes
 */

import { createClient } from '@libsql/client';
import * as path from 'path';

const DB_PATH = process.env.KITT_DB_PATH || './profile/memory/kitt.db';

interface TranscriptRow {
  id: string;
  session_id: string;
  chat_id: string | null;
}

async function main(): Promise<void> {
  const dryRun = !process.argv.includes('--apply');

  console.log('=== Chat ID Migration ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN (use --apply to execute)' : 'APPLYING CHANGES'}`);
  console.log(`Database: ${DB_PATH}`);
  console.log('');

  // Connect to database
  const db = createClient({
    url: `file:${path.resolve(DB_PATH)}`,
  });

  try {
    // Check if transcripts table has chat_id column
    const tableInfo = await db.execute(`PRAGMA table_info(transcripts)`);
    const hasChatId = tableInfo.rows.some((row: any) => row.name === 'chat_id');

    if (!hasChatId) {
      console.log('Note: transcripts table does not have chat_id column (using session_id instead)');
    }

    // Find transcripts that need migration
    // We look for session_ids that:
    // 1. Look like numeric Telegram chat IDs
    // 2. Don't already have a channel prefix
    const query = `
      SELECT DISTINCT session_id
      FROM transcripts
      WHERE session_id NOT LIKE '%:%'
        AND session_id GLOB '[0-9]*'
        AND session_id != 'think-loop'
    `;

    const result = await db.execute(query);
    const sessionIds = result.rows.map((row: any) => row.session_id as string);

    console.log(`Found ${sessionIds.length} session IDs to migrate`);

    if (sessionIds.length === 0) {
      console.log('Nothing to migrate!');
      return;
    }

    // Show what will be migrated
    console.log('');
    console.log('Session IDs to migrate:');
    for (const sessionId of sessionIds.slice(0, 10)) {
      console.log(`  ${sessionId} -> telegram:${sessionId}`);
    }
    if (sessionIds.length > 10) {
      console.log(`  ... and ${sessionIds.length - 10} more`);
    }

    if (dryRun) {
      console.log('');
      console.log('This is a dry run. No changes were made.');
      console.log('Run with --apply to execute the migration.');
      return;
    }

    // Apply migration
    console.log('');
    console.log('Applying migration...');

    let updated = 0;
    for (const sessionId of sessionIds) {
      const newSessionId = `telegram:${sessionId}`;

      await db.execute({
        sql: `UPDATE transcripts SET session_id = ? WHERE session_id = ?`,
        args: [newSessionId, sessionId],
      });

      updated++;
      if (updated % 100 === 0) {
        console.log(`  Migrated ${updated}/${sessionIds.length} session IDs...`);
      }
    }

    console.log(`Migrated ${updated} session IDs`);

    // Also update sessions.json if it exists
    const fs = await import('fs/promises');
    const sessionsPath = './profile/state/sessions.json';

    try {
      const sessionsData = await fs.readFile(sessionsPath, 'utf-8');
      const sessions = JSON.parse(sessionsData);

      let sessionsUpdated = 0;
      const newSessions: Record<string, any> = {};

      for (const [chatId, session] of Object.entries(sessions.sessions || {})) {
        if (!chatId.includes(':') && /^\d+$/.test(chatId)) {
          const newChatId = `telegram:${chatId}`;
          newSessions[newChatId] = {
            ...(session as any),
            chatId: newChatId,
          };
          sessionsUpdated++;
        } else {
          newSessions[chatId] = session;
        }
      }

      if (sessionsUpdated > 0) {
        sessions.sessions = newSessions;
        await fs.writeFile(sessionsPath, JSON.stringify(sessions, null, 2));
        console.log(`Updated ${sessionsUpdated} session entries in sessions.json`);
      }
    } catch (err) {
      console.log('Note: Could not update sessions.json (file may not exist)');
    }

    console.log('');
    console.log('Migration complete!');
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
