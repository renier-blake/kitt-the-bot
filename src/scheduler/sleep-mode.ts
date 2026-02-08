/**
 * KITT Sleep & DND Modes (F73)
 *
 * Two distinct modes:
 *
 * 1. SLEEP MODE - KITT is completely off
 *    - Think Loop exits early (no processing, no token usage)
 *    - No skills run
 *    - No messages sent
 *
 * 2. DND MODE (Do Not Disturb) - KITT works silently
 *    - Think Loop runs normally
 *    - Skills execute (background tasks)
 *    - NO messages sent to Telegram
 *    - Everything logged to database
 *
 * 3. WAKE REMINDER - Optional wake-up message
 *    - When sleep mode ends at a specific time, send a message
 *    - "Maak me wakker om 6:55" → sleep + wake reminder
 *    - "Ik ga slapen" → sleep without reminder
 *
 * Wake triggers:
 * - Timestamp expires (automatic)
 * - User sends a message (clears ALL modes)
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

// ==========================================
// DND Mode (Do Not Disturb) - F73
// ==========================================

/**
 * Check if KITT is in DND mode
 */
export async function isKittDND(db: Client): Promise<boolean> {
  const result = await db.execute(
    "SELECT value FROM meta WHERE key = 'kitt_dnd_until'"
  );
  if (result.rows.length === 0) return false;
  const dndUntil = Number(result.rows[0].value);
  return dndUntil > Date.now();
}

/**
 * Get DND until timestamp (or null if not in DND)
 */
export async function getDNDUntil(db: Client): Promise<number | null> {
  const result = await db.execute(
    "SELECT value FROM meta WHERE key = 'kitt_dnd_until'"
  );
  if (result.rows.length === 0) return null;
  const dndUntil = Number(result.rows[0].value);
  return dndUntil > Date.now() ? dndUntil : null;
}

/**
 * Put KITT in DND mode (works silently, no messages)
 */
export async function setDND(db: Client, until: number): Promise<void> {
  await db.execute({
    sql: "INSERT OR REPLACE INTO meta (key, value) VALUES ('kitt_dnd_until', ?)",
    args: [String(until)],
  });
}

/**
 * Clear DND mode
 */
export async function clearDND(db: Client): Promise<void> {
  await db.execute("DELETE FROM meta WHERE key = 'kitt_dnd_until'");
}

// ==========================================
// Wake Reminder - F73
// ==========================================

/**
 * Set a wake-up reminder (sends message when sleep ends)
 */
export async function setWakeReminder(db: Client, timestamp: number): Promise<void> {
  await db.execute({
    sql: "INSERT OR REPLACE INTO meta (key, value) VALUES ('kitt_wake_reminder', ?)",
    args: [String(timestamp)],
  });
}

/**
 * Get wake reminder timestamp (or null if none set)
 */
export async function getWakeReminder(db: Client): Promise<number | null> {
  const result = await db.execute(
    "SELECT value FROM meta WHERE key = 'kitt_wake_reminder'"
  );
  if (result.rows.length === 0) return null;
  return Number(result.rows[0].value);
}

/**
 * Clear wake reminder
 */
export async function clearWakeReminder(db: Client): Promise<void> {
  await db.execute("DELETE FROM meta WHERE key = 'kitt_wake_reminder'");
}

// ==========================================
// Helpers - F73
// ==========================================

/**
 * Check if KITT can send messages (not sleeping, not DND)
 */
export async function canSendMessages(db: Client): Promise<boolean> {
  const sleeping = await isKittSleeping(db);
  const dnd = await isKittDND(db);
  return !sleeping && !dnd;
}

/**
 * Clear all modes (called when user sends a message)
 */
export async function clearAllModes(db: Client): Promise<void> {
  await Promise.all([
    clearSleep(db),
    clearDND(db),
    clearWakeReminder(db),
  ]);
}

/**
 * Get current mode status
 */
export async function getModeStatus(db: Client): Promise<{
  mode: 'awake' | 'sleep' | 'dnd';
  until: number | null;
  wakeReminder: number | null;
}> {
  const [sleepUntil, dndUntil, wakeReminder] = await Promise.all([
    getSleepUntil(db),
    getDNDUntil(db),
    getWakeReminder(db),
  ]);

  if (sleepUntil) {
    return { mode: 'sleep', until: sleepUntil, wakeReminder };
  }
  if (dndUntil) {
    return { mode: 'dnd', until: dndUntil, wakeReminder: null };
  }
  return { mode: 'awake', until: null, wakeReminder: null };
}
