/**
 * KITT Message Bridge
 * Main entry point - connects Telegram to Claude Agent SDK
 *
 * Usage:
 *   npm run bridge       # Development with watch mode
 *   npm run bridge:start # Production mode
 */

import 'dotenv/config';
import { startTelegramBot, stopTelegramBot } from './telegram.js';
import { loadSessions } from './sessions.js';
import { loadState, saveState } from './state.js';
import { log } from './logger.js';
import { getScheduler } from '../scheduler/index.js';
import { startLogServer, stopLogServer } from './log-server.js';

const BANNER = `
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   ██╗  ██╗██╗████████╗████████╗                      ║
║   ██║ ██╔╝██║╚══██╔══╝╚══██╔══╝                      ║
║   █████╔╝ ██║   ██║      ██║                         ║
║   ██╔═██╗ ██║   ██║      ██║                         ║
║   ██║  ██╗██║   ██║      ██║                         ║
║   ╚═╝  ╚═╝╚═╝   ╚═╝      ╚═╝                         ║
║                                                       ║
║   Knowledge Interface for Transparent Tasks           ║
║   Message Bridge v0.1.0                               ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
`;

async function main(): Promise<void> {
  // Start log server FIRST (before any other logging)
  startLogServer();

  console.log(BANNER);

  // Load environment
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    log.error('TELEGRAM_BOT_TOKEN not set. Copy .env.example to .env and add your token.');
    process.exit(1);
  }

  // Set workspace path
  const workspace = process.env.KITT_WORKSPACE || process.cwd();
  log.info('Workspace', { path: workspace });

  // Load previous state and sessions
  await loadState();
  await loadSessions();

  // Initialize scheduler
  log.info('Starting scheduler...');
  const scheduler = getScheduler();
  await scheduler.initialize();

  // Start Telegram bot
  log.info('Starting Telegram bot...');
  await startTelegramBot();

  log.info('KITT Bridge is running with Agent SDK', {
    workspace,
    mode: 'agent-sdk',
  });

  // Start Think Loop - autonomous reflection every 5 minutes
  const THINK_LOOP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  const thinkLoopTimer = setInterval(async () => {
    try {
      const now = new Date().toLocaleTimeString('nl-NL', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Amsterdam'
      });
      console.log(`[think-loop] ⏰ Tick at ${now}`);
      log.info('Think loop tick', { time: now });

      await scheduler.runThinkLoop();

      console.log(`[think-loop] ✅ Complete`);
      log.info('Think loop completed');
    } catch (err) {
      console.log(`[think-loop] ❌ Error: ${err}`);
      log.error('Think loop error', { error: String(err) });
    }
  }, THINK_LOOP_INTERVAL);

  log.info('Think loop started', { intervalMinutes: 5 });

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    log.info('Shutting down...', { signal });

    clearInterval(thinkLoopTimer);
    await scheduler.shutdown();
    await stopTelegramBot();
    await saveState();
    await stopLogServer();

    log.info('Goodbye!');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Keep process alive
  process.stdin.resume();
}

main().catch((err) => {
  log.error('Fatal error', { error: String(err) });
  process.exit(1);
});
