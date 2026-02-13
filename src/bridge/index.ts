/**
 * KITT Message Bridge
 * Main entry point - connects Telegram to Claude Agent SDK
 *
 * Usage:
 *   npm run bridge       # Development with watch mode
 *   npm run bridge:start # Production mode
 */

import 'dotenv/config';
import { loadSessions, clearAllSessions } from './sessions.js';
import { loadState, saveState } from './state.js';
import { log } from './logger.js';
import { getScheduler } from '../scheduler/index.js';
import { startLogServer, stopLogServer } from './log-server.js';
import { getRouter } from './router.js';
import { createTelegramAdapter } from './adapters/telegram.js';
import { createWhatsAppAdapter } from './adapters/whatsapp.js';
import { createSlackAdapter } from './adapters/slack.js';
import { createSlackBotAdapter } from './adapters/slack-bot.js';
import { startTunnel, stopTunnel } from './tunnel.js';
import { getMemoryService } from '../memory/index.js';
import { getCredential } from '../credentials/index.js';

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

  // Check critical credential
  const telegramToken = await getCredential('TELEGRAM_BOT_TOKEN');
  if (!telegramToken) {
    log.error('TELEGRAM_BOT_TOKEN not set. Add to vault or .env.');
    process.exit(1);
  }

  // Set workspace path
  const workspace = process.env.KITT_WORKSPACE || process.cwd();
  log.info('Workspace', { path: workspace });

  // Load previous state and clear sessions (fresh start picks up new instructions/tools)
  await loadState();
  await loadSessions();
  clearAllSessions();

  // Initialize memory service (enables embedding pipeline for all adapters)
  log.info('Initializing memory service...');
  const memory = getMemoryService();
  const memStatus = await memory.initialize();
  log.info('Memory initialized', {
    fts: memStatus.ftsAvailable,
    vector: memStatus.vectorAvailable,
    version: memStatus.schemaVersion,
  });

  // Initialize scheduler
  log.info('Starting scheduler...');
  const scheduler = getScheduler();
  await scheduler.initialize();

  // Initialize router with adapters
  log.info('Starting message router...');
  const router = getRouter();

  // Register Telegram adapter
  const telegramAdapter = createTelegramAdapter();
  router.registerAdapter(telegramAdapter);

  // Register WhatsApp adapter if enabled
  if (process.env.WHATSAPP_ENABLED === 'true') {
    log.info('WhatsApp adapter enabled');
    const whatsappAdapter = createWhatsAppAdapter();
    router.registerAdapter(whatsappAdapter);
  }

  // Start Cloudflare Tunnel if token is configured (needed for Slack OAuth + Events API)
  await startTunnel();

  // Register Slack adapter if credentials are configured
  const slackToken = await getCredential('SLACK_USER_TOKEN');
  const slackSigningSecret = await getCredential('SLACK_SIGNING_SECRET');
  if (slackToken && slackSigningSecret) {
    log.info('Slack credentials found, enabling adapter');
    const slackAdapter = createSlackAdapter();
    router.registerAdapter(slackAdapter);
  }

  // Register Slack Bot adapter if bot credentials configured (Socket Mode — no tunnel needed)
  const slackBotToken = await getCredential('SLACK_BOT_TOKEN');
  const slackAppToken = await getCredential('SLACK_APP_TOKEN');
  if (slackBotToken && slackAppToken) {
    log.info('Slack Bot credentials found, enabling bot adapter');
    const slackBotAdapter = createSlackBotAdapter();
    router.registerAdapter(slackBotAdapter);
  }

  // Start all adapters
  await router.start();

  log.info('KITT Bridge is running with Agent SDK', {
    workspace,
    mode: 'agent-sdk',
    adapters: router.getAdapters().map(a => a.channel),
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
      log.info('⏰ Think loop tick', { time: now });

      await scheduler.runThinkLoop();

      log.info('✅ Think loop completed');
    } catch (err) {
      log.error('❌ Think loop error', { error: String(err) });
    }
  }, THINK_LOOP_INTERVAL);

  log.info('Think loop started', { intervalMinutes: 5 });

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    log.info('Shutting down...', { signal });

    clearInterval(thinkLoopTimer);
    // Shutdown agent pool first — aborts running agents and logs what was killed
    const { getAgentPool } = await import('./agent-pool.js');
    getAgentPool().shutdown();
    stopTunnel();
    await scheduler.shutdown();
    await router.stop();
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
