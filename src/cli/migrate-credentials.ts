#!/usr/bin/env npx tsx
/**
 * Migrate credentials from .env to encrypted vault.
 *
 * Usage:
 *   npx tsx src/cli/migrate-credentials.ts
 *   npm run migrate-credentials
 *
 * This reads SECRET_KEYS from .env and stores them encrypted in SQLite.
 * The .env file is NOT modified or deleted — it stays as a fallback/reference.
 */

import path from 'node:path';
import dotenv from 'dotenv';

// Load .env before importing credential service
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { migrateFromEnv, listCredentials } from '../credentials/index.js';

async function main() {
  console.log('🔐 KITT Credential Vault — Migration');
  console.log('====================================\n');

  console.log('Migrating secrets from .env to encrypted vault...\n');

  const result = await migrateFromEnv();

  if (result.migrated.length > 0) {
    console.log(`✅ Migrated (${result.migrated.length}):`);
    for (const key of result.migrated) {
      console.log(`   • ${key}`);
    }
    console.log();
  }

  if (result.skipped.length > 0) {
    console.log(`⏭️  Skipped — already in vault (${result.skipped.length}):`);
    for (const key of result.skipped) {
      console.log(`   • ${key}`);
    }
    console.log();
  }

  if (result.failed.length > 0) {
    console.log(`❌ Failed (${result.failed.length}):`);
    for (const { key, error } of result.failed) {
      console.log(`   • ${key}: ${error}`);
    }
    console.log();
  }

  // Show current vault contents
  const credentials = await listCredentials();
  console.log(`\n📋 Vault contains ${credentials.length} credential(s):`);
  for (const cred of credentials) {
    const date = new Date(cred.updatedAt).toISOString().slice(0, 10);
    console.log(`   • ${cred.key} [${cred.category}] — updated ${date}`);
  }

  console.log('\n✅ Done. Your .env file has NOT been modified.');
  console.log('   The vault will be used first, with .env as fallback.');

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
