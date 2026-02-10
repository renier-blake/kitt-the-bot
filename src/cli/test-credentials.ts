#!/usr/bin/env npx tsx
/**
 * Quick test for the credential vault
 */

import dotenv from 'dotenv';
dotenv.config();

import { getCredential, listCredentials } from '../credentials/index.js';

async function main() {
  console.log('🔐 Testing Credential Vault\n');

  // List all credentials
  const creds = await listCredentials();
  console.log(`Vault contains ${creds.length} credentials:\n`);

  for (const cred of creds) {
    // Test decryption by getting the value
    const value = await getCredential(cred.key);
    const envValue = process.env[cred.key];
    const match = value === envValue;
    const preview = value ? value.substring(0, 6) + '...' + value.substring(value.length - 4) : 'NULL';

    console.log(`  ${match ? '✅' : '❌'} ${cred.key} [${cred.category}] → ${preview}`);
  }

  // Test a key that doesn't exist in vault but does in env
  console.log('\n--- Fallback test ---');
  const telegAllowed = await getCredential('TELEGRAM_ALLOWED_USERS');
  console.log(`  TELEGRAM_ALLOWED_USERS (env-only): ${telegAllowed ? '✅ found via fallback' : '❌ not found'}`);

  console.log('\n✅ All tests complete');
}

main().catch(console.error);
