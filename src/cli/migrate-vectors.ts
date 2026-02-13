#!/usr/bin/env tsx
/**
 * Vector Store Migration Script
 *
 * Extracts embeddings from kitt.db (F32_BLOB in chunks table) into a
 * dedicated vectors.db file. Sets the `vector_migrated` flag so the
 * schema v21 migration can safely drop the embedding column.
 *
 * Usage:
 *   npx tsx src/cli/migrate-vectors.ts              # Run migration
 *   npx tsx src/cli/migrate-vectors.ts --dry-run    # Preview only
 */

import 'dotenv/config';
import { createClient } from '@libsql/client';
import { VectorStore } from '../memory/vector-store.js';
import { embeddingToBuffer, bufferToEmbedding } from '../memory/utils.js';
import fs from 'node:fs';
import path from 'node:path';

const KITT_DB = path.resolve('profile/data/kitt.db');
const VECTORS_DB = path.resolve('profile/data/kitt-vectors.db');
const BATCH_SIZE = 100;

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('=== Vector Store Migration ===');
  console.log(`Source: ${KITT_DB}`);
  console.log(`Target: ${VECTORS_DB}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  // Check source exists
  if (!fs.existsSync(KITT_DB)) {
    console.error('ERROR: kitt.db not found at', KITT_DB);
    process.exit(1);
  }

  const sourceSize = fs.statSync(KITT_DB).size;
  console.log(`Source DB size: ${(sourceSize / 1024 / 1024).toFixed(1)} MB`);

  // Open source database
  const db = createClient({ url: `file:${KITT_DB}` });

  // Count chunks with embeddings
  const countResult = await db.execute('SELECT COUNT(*) as count FROM chunks WHERE embedding IS NOT NULL');
  const totalChunks = Number(countResult.rows[0].count);
  console.log(`Chunks with embeddings: ${totalChunks}`);

  if (totalChunks === 0) {
    console.log('No embeddings to migrate. Done.');
    db.close();
    return;
  }

  // Check first embedding dimensions
  const sampleResult = await db.execute('SELECT embedding FROM chunks WHERE embedding IS NOT NULL LIMIT 1');
  const sampleBlob = sampleResult.rows[0].embedding as ArrayBuffer;
  const sampleFloat32 = new Float32Array(sampleBlob);
  const dimensions = sampleFloat32.length;
  console.log(`Embedding dimensions: ${dimensions}`);
  console.log(`Raw embedding size: ${(dimensions * 4 / 1024).toFixed(1)} KB each`);
  console.log(`Expected vectors.db size: ~${(totalChunks * dimensions * 4 / 1024 / 1024).toFixed(1)} MB`);
  console.log('');

  if (dryRun) {
    console.log('DRY RUN — no changes made.');
    db.close();
    return;
  }

  // Initialize vector store
  const vectorStore = new VectorStore(VECTORS_DB, dimensions);
  await vectorStore.initialize();

  // Migrate in batches
  let migrated = 0;
  let offset = 0;

  while (offset < totalChunks) {
    const batchResult = await db.execute({
      sql: 'SELECT id, embedding, model FROM chunks WHERE embedding IS NOT NULL LIMIT ? OFFSET ?',
      args: [BATCH_SIZE, offset],
    });

    if (batchResult.rows.length === 0) break;

    const entries = batchResult.rows.map((row) => {
      const blob = row.embedding as ArrayBuffer;
      const float32 = new Float32Array(blob);
      return {
        chunkId: String(row.id),
        embedding: Array.from(float32),
        model: String(row.model || 'text-embedding-3-large'),
      };
    });

    await vectorStore.storeBatch(entries);
    migrated += entries.length;
    offset += BATCH_SIZE;

    const pct = ((migrated / totalChunks) * 100).toFixed(0);
    process.stdout.write(`\r  Migrated ${migrated}/${totalChunks} (${pct}%)`);
  }

  console.log(''); // newline after progress

  // Verify count
  const vectorCount = vectorStore.count();
  if (vectorCount !== totalChunks) {
    console.error(`WARNING: Count mismatch! Expected ${totalChunks}, got ${vectorCount}`);
  } else {
    console.log(`Verified: ${vectorCount} vectors in vectors.db`);
  }

  // Set migration flag
  await db.execute({
    sql: "INSERT OR REPLACE INTO meta (key, value) VALUES ('vector_migrated', 'true')",
    args: [],
  });
  console.log('Set vector_migrated = true in kitt.db');

  // Print sizes
  vectorStore.close();
  db.close();

  const vectorsSize = fs.existsSync(VECTORS_DB) ? fs.statSync(VECTORS_DB).size : 0;
  console.log('');
  console.log('=== Migration Complete ===');
  console.log(`Source (kitt.db):     ${(sourceSize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Target (vectors.db): ${(vectorsSize / 1024 / 1024).toFixed(1)} MB`);
  console.log('');
  console.log('Next steps:');
  console.log('1. Restart KITT — schema v21 migration will drop the embedding column and VACUUM');
  console.log('2. Run after tests: npx tsx src/cli/test-vector-search.ts --save after');
  console.log('3. Compare: npx tsx src/cli/test-vector-search.ts --compare');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
