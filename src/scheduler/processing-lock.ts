/**
 * KITT Processing Lock
 *
 * Prevents duplicate responses by coordinating between the Telegram chat agent
 * and the Think Loop. When the chat agent is processing a user message,
 * the Think Loop skips its tick to avoid sending a duplicate response.
 *
 * Uses the `meta` table (key: 'agent_processing_since') with a timestamp.
 * A stale lock (> 2 minutes) is automatically ignored to prevent deadlocks.
 */

import type { Client } from '@libsql/client';

const LOCK_KEY = 'agent_processing_since';
const STALE_LOCK_MS = 2 * 60 * 1000; // 2 minutes — if lock is older, ignore it

/**
 * Acquire the processing lock (called before chat agent runs)
 */
export async function acquireProcessingLock(db: Client): Promise<void> {
  await db.execute({
    sql: `INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`,
    args: [LOCK_KEY, String(Date.now())],
  });
}

/**
 * Release the processing lock (called after chat agent finishes)
 */
export async function releaseProcessingLock(db: Client): Promise<void> {
  await db.execute({
    sql: `DELETE FROM meta WHERE key = ?`,
    args: [LOCK_KEY],
  });
}

/**
 * Check if the chat agent is currently processing a message.
 * Returns true if locked (Think Loop should skip), false if free.
 * Stale locks (> 2 min) are automatically released and return false.
 */
export async function isAgentProcessing(db: Client): Promise<boolean> {
  const result = await db.execute({
    sql: `SELECT value FROM meta WHERE key = ?`,
    args: [LOCK_KEY],
  });

  if (result.rows.length === 0) return false;

  const lockedSince = Number(result.rows[0].value);
  const elapsed = Date.now() - lockedSince;

  // Stale lock — agent probably crashed, auto-release
  if (elapsed > STALE_LOCK_MS) {
    console.log(`[processing-lock] ⚠️ Stale lock detected (${Math.round(elapsed / 1000)}s old), releasing`);
    await releaseProcessingLock(db);
    return false;
  }

  return true;
}
