/**
 * KITT Sleep Mode
 *
 * Global sleep/snooze mode for KITT. When sleeping:
 * - Think Loop exits early (no processing, no token usage)
 * - No messages are sent
 * - User's rest is respected
 *
 * Wake triggers:
 * - Timestamp expires (automatic)
 * - User sends a message (clears sleep)
 */

import type { Client } from '@libsql/client';

const FAR_FUTURE = 9999999999999; // ~2286 AD (for indefinite sleep)

/**
 * Check if KITT is sleeping
 */
export async function isKittSleeping(db: Client): Promise<boolean> {
  const result = await db.execute(
    "SELECT value FROM meta WHERE key = 'kitt_sleep_until'"
  );
  if (result.rows.length === 0) return false;
  const sleepUntil = Number(result.rows[0].value);
  return sleepUntil > Date.now();
}

/**
 * Get sleep until timestamp (or null if awake)
 */
export async function getSleepUntil(db: Client): Promise<number | null> {
  const result = await db.execute(
    "SELECT value FROM meta WHERE key = 'kitt_sleep_until'"
  );
  if (result.rows.length === 0) return null;
  const sleepUntil = Number(result.rows[0].value);
  return sleepUntil > Date.now() ? sleepUntil : null;
}

/**
 * Put KITT in sleep mode
 *
 * @param db - Database client
 * @param until - Timestamp (ms) to sleep until, or 'indefinite' for far future
 */
export async function setSleep(
  db: Client,
  until: number | 'indefinite'
): Promise<void> {
  const value = until === 'indefinite' ? FAR_FUTURE : until;
  await db.execute({
    sql: "INSERT OR REPLACE INTO meta (key, value) VALUES ('kitt_sleep_until', ?)",
    args: [String(value)],
  });
}

/**
 * Wake up KITT (clear sleep mode)
 */
export async function clearSleep(db: Client): Promise<void> {
  await db.execute("DELETE FROM meta WHERE key = 'kitt_sleep_until'");
}

/**
 * Format wake time for display
 */
export function formatWakeTime(timestamp: number): string {
  // Check if it's "indefinite" (far future)
  if (timestamp >= FAR_FUTURE) {
    return 'onbeperkt';
  }

  return new Date(timestamp).toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Amsterdam',
  });
}
