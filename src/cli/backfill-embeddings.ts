#!/usr/bin/env npx tsx
/**
 * Backfill embeddings for all existing transcripts
 *
 * Usage: npx tsx src/cli/backfill-embeddings.ts [--limit N] [--dry-run]
 */

import 'dotenv/config';
import { getMemoryService } from '../memory/index.js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : 0;

async function main() {
  console.log('🔄 Backfill Embeddings');
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (limit) console.log(`   Limit: ${limit}`);
  console.log('');

  // Initialize memory
  const memory = getMemoryService();
  const status = await memory.initialize();

  console.log(`   FTS: ${status.ftsAvailable ? '✅' : '❌'}`);
  console.log(`   Vector: ${status.vectorAvailable ? '✅' : '❌'}`);
  console.log('');

  const db = memory.getDb();
  if (!db) {
    console.error('❌ Database not available');
    process.exit(1);
  }

  // Get transcripts that haven't been chunked yet
  const result = await db.execute({
    sql: `SELECT t.id, LENGTH(t.content) as content_length, t.type, t.role
          FROM transcripts t
          LEFT JOIN chunks c ON c.transcript_id = t.id
          WHERE c.id IS NULL
            AND t.type != 'task'
          ORDER BY t.created_at ASC
          ${limit ? `LIMIT ${limit}` : ''}`,
    args: [],
  });

  const total = result.rows.length;
  console.log(`📊 Found ${total} transcripts without embeddings`);

  if (dryRun) {
    // Show breakdown
    const types: Record<string, number> = {};
    for (const row of result.rows) {
      const key = `${row.role}/${row.type}`;
      types[key] = (types[key] || 0) + 1;
    }
    console.log('\nBreakdown:');
    for (const [key, count] of Object.entries(types).sort((a, b) => b[1] - a[1])) {
      console.log(`   ${key}: ${count}`);
    }

    const totalSize = result.rows.reduce((sum, r) => sum + Number(r.content_length), 0);
    console.log(`\nTotal content: ${(totalSize / 1024).toFixed(1)} KB`);
    console.log('Estimated chunks: ~' + Math.ceil(totalSize / 1600)); // ~400 tokens ≈ 1600 chars
    console.log('Estimated embedding cost: ~$' + (totalSize / 1000000 * 0.13).toFixed(3));

    process.exit(0);
  }

  // Process in batches
  let processed = 0;
  let errors = 0;

  for (const row of result.rows) {
    try {
      // Use the public scheduleIndexing via a direct call to the private method
      // We need to call indexTranscript directly — it's private, so we access it through the class
      await (memory as any).indexTranscript(String(row.id));
      processed++;

      if (processed % 50 === 0) {
        console.log(`   ✅ ${processed}/${total} processed (${errors} errors)`);
      }
    } catch (err) {
      errors++;
      if (errors <= 5) {
        console.error(`   ❌ Error on ${row.id}: ${err}`);
      }
    }
  }

  // Final stats
  console.log('');
  console.log(`✅ Done! ${processed} transcripts indexed, ${errors} errors`);

  // Verify
  const chunkCount = await db.execute('SELECT COUNT(*) as count FROM chunks');
  const ftsCount = await db.execute('SELECT COUNT(*) as count FROM chunks_fts');
  console.log(`   Chunks: ${chunkCount.rows[0].count}`);
  console.log(`   FTS entries: ${ftsCount.rows[0].count}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
