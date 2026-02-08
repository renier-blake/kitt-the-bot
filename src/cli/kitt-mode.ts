#!/usr/bin/env tsx
/**
 * KITT Mode CLI (F73)
 * Control sleep and DND modes
 *
 * Usage:
 *   npm run mode -- status              # Show current mode
 *   npm run mode -- sleep               # Sleep indefinitely
 *   npm run mode -- sleep 6:55          # Sleep until 6:55 with wake-up message
 *   npm run mode -- sleep 6:55 --no-wake  # Sleep until 6:55, no wake message
 *   npm run mode -- dnd 2h              # DND for 2 hours
 *   npm run mode -- dnd 14:00           # DND until 14:00
 *   npm run mode -- wake                # Clear all modes (wake up)
 *
 * Examples:
 *   npm run mode -- sleep 7:00          # "Maak me wakker om 7:00"
 *   npm run mode -- dnd 1h              # "Wees stil voor een uur"
 */

import 'dotenv/config';
import { getMemoryService } from '../memory/index.js';
import {
  setSleep,
  setDND,
  setWakeReminder,
  clearAllModes,
  getModeStatus,
  formatWakeTime,
} from '../scheduler/sleep-mode.js';

const FAR_FUTURE = 9999999999999;

/**
 * Parse time string to timestamp
 * Supports: "6:55", "14:00", "2h", "30m"
 */
function parseTime(input: string): number {
  const now = new Date();

  // Check for duration format (2h, 30m)
  const durationMatch = input.match(/^(\d+)(h|m)$/);
  if (durationMatch) {
    const value = parseInt(durationMatch[1], 10);
    const unit = durationMatch[2];
    const ms = unit === 'h' ? value * 60 * 60 * 1000 : value * 60 * 1000;
    return now.getTime() + ms;
  }

  // Check for time format (HH:MM)
  const timeMatch = input.match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);

    const target = new Date(now);
    target.setHours(hours, minutes, 0, 0);

    // If time is in the past, assume tomorrow
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }

    return target.getTime();
  }

  throw new Error(`Invalid time format: ${input}. Use HH:MM or Nh/Nm (e.g., 6:55, 2h, 30m)`);
}

/**
 * Format timestamp for display
 */
function formatTime(timestamp: number): string {
  if (timestamp >= FAR_FUTURE) {
    return 'indefinite';
  }
  return new Date(timestamp).toLocaleString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Europe/Amsterdam',
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  // Initialize memory service
  const memory = getMemoryService();
  await memory.initialize();

  const db = memory.getDb();
  if (!db) {
    console.error('❌ Could not connect to database');
    process.exit(1);
  }

  try {
    switch (command) {
      case 'status': {
        const status = await getModeStatus(db);
        console.log('🚗 KITT Mode Status');
        console.log('==================');
        console.log(`Mode: ${status.mode.toUpperCase()}`);
        if (status.until) {
          console.log(`Until: ${formatTime(status.until)}`);
        }
        if (status.wakeReminder) {
          console.log(`Wake reminder: ${formatTime(status.wakeReminder)}`);
        }
        break;
      }

      case 'sleep': {
        const timeArg = args[1];
        const noWake = args.includes('--no-wake');

        if (!timeArg) {
          // Indefinite sleep
          await setSleep(db, 'indefinite');
          console.log('😴 KITT is now sleeping indefinitely');
          console.log('   Send a message to wake up');
        } else {
          // Sleep until specific time
          const until = parseTime(timeArg);
          await setSleep(db, until);

          if (!noWake) {
            // Set wake reminder
            await setWakeReminder(db, until);
            console.log(`😴 KITT is sleeping until ${formatTime(until)}`);
            console.log('   Wake-up message will be sent');
          } else {
            console.log(`😴 KITT is sleeping until ${formatTime(until)}`);
            console.log('   No wake-up message');
          }
        }
        break;
      }

      case 'dnd': {
        const timeArg = args[1];

        if (!timeArg) {
          console.error('❌ DND requires a duration or time');
          console.error('   Usage: npm run mode -- dnd 2h');
          console.error('   Usage: npm run mode -- dnd 14:00');
          process.exit(1);
        }

        const until = parseTime(timeArg);
        await setDND(db, until);
        console.log(`🔕 KITT is in DND mode until ${formatTime(until)}`);
        console.log('   Skills will run, but no messages sent');
        break;
      }

      case 'wake': {
        await clearAllModes(db);
        console.log('☀️ KITT is awake!');
        console.log('   All modes cleared');
        break;
      }

      default: {
        console.log('KITT Mode CLI (F73)');
        console.log('');
        console.log('Usage:');
        console.log('  npm run mode -- status              Show current mode');
        console.log('  npm run mode -- sleep               Sleep indefinitely');
        console.log('  npm run mode -- sleep 6:55          Sleep until 6:55 with wake message');
        console.log('  npm run mode -- sleep 6:55 --no-wake  Sleep without wake message');
        console.log('  npm run mode -- dnd 2h              DND for 2 hours');
        console.log('  npm run mode -- dnd 14:00           DND until 14:00');
        console.log('  npm run mode -- wake                Clear all modes');
        process.exit(0);
      }
    }
  } catch (err) {
    console.error('❌ Error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
