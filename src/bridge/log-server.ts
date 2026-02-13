/**
 * KITT Portal Server
 * Express app + WebSocket live logs
 *
 * All API routes are in src/bridge/routes/
 */

import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer, type Server } from 'http';
import path from 'path';
import { createClient, type Client } from '@libsql/client';
import { getRouter } from './router.js';
import { getAgentPool } from './agent-pool.js';
import { getScheduler } from '../scheduler/index.js';
import type { SlackAdapter } from './adapters/slack.js';
import { registerSlackEventsRoute } from './slack-events.js';

// Route modules
import { registerHealthRoutes } from './routes/health.js';
import { registerDbRoutes } from './routes/db.js';
import { registerTaskRoutes } from './routes/tasks.js';
import { registerSkillsRoutes } from './routes/skills.js';
import { registerIssuesRoutes } from './routes/issues.js';
import { registerContentRoutes } from './routes/content.js';
import { registerTriageRoutes } from './routes/triage.js';
import { registerIntegrationsRoutes } from './routes/integrations.js';
import { registerChannelsRoutes } from './routes/channels.js';

const DB_PATH = process.env.KITT_DB_PATH || './profile/data/kitt.db';
let db: Client | null = null;

function getDb(): Client {
  if (!db) {
    db = createClient({ url: `file:${DB_PATH}` });
  }
  return db;
}

export interface LogEntry {
  ts: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  content: string;
  source?: string;
}

let wss: WebSocketServer | null = null;
let server: Server | null = null;

// Store original console methods
const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

// Buffer to store recent logs for new connections
const LOG_BUFFER_SIZE = 100;
const logBuffer: LogEntry[] = [];

function addToBuffer(entry: LogEntry): void {
  logBuffer.push(entry);
  if (logBuffer.length > LOG_BUFFER_SIZE) {
    logBuffer.shift();
  }
}

function broadcast(entry: LogEntry): void {
  addToBuffer(entry);

  if (!wss) return;

  const message = JSON.stringify(entry);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function detectSource(content: string): string | undefined {
  // Structured JSON from createLogger() — parse source field
  if (content.startsWith('{"ts":')) {
    try {
      const parsed = JSON.parse(content);
      if (parsed.source) return parsed.source;
    } catch { /* not valid JSON, fall through */ }
    return 'structured';
  }
  // Legacy prefix-based tags (will be migrated over time)
  if (content.includes('[agent-pool]')) return 'agent-pool';
  if (content.includes('[think-loop]')) return 'think-loop';
  if (content.includes('[agent]')) return 'agent';
  if (content.includes('[scheduler]')) return 'scheduler';
  if (content.includes('[telegram]')) return 'telegram';
  if (content.includes('[slack]')) return 'slack';
  if (content.includes('[tunnel]')) return 'tunnel';
  return undefined;
}

function formatArgs(...args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(' ');
}

/**
 * Install console interceptors to capture all output
 */
export function installLogInterceptor(): void {
  console.log = (...args: unknown[]) => {
    originalConsole.log(...args);
    const content = formatArgs(...args);
    broadcast({
      ts: Date.now(),
      level: 'info',
      content,
      source: detectSource(content),
    });
  };

  console.warn = (...args: unknown[]) => {
    originalConsole.warn(...args);
    const content = formatArgs(...args);
    broadcast({
      ts: Date.now(),
      level: 'warn',
      content,
      source: detectSource(content),
    });
  };

  console.error = (...args: unknown[]) => {
    originalConsole.error(...args);
    const content = formatArgs(...args);
    broadcast({
      ts: Date.now(),
      level: 'error',
      content,
      source: detectSource(content),
    });
  };
}

/**
 * Start the log server
 */
export function startLogServer(port = 8000): { server: Server; wss: WebSocketServer } {
  const app = express();

  // Parse JSON body — preserve raw body for Slack signature verification
  app.use(express.json({
    verify: (req, _res, buf) => {
      (req as unknown as { rawBody: string }).rawBody = buf.toString();
    },
  }));

  // Register Slack Events API route
  registerSlackEventsRoute(app, () => {
    const router = getRouter();
    return router.getAdapter('slack') as SlackAdapter | undefined;
  });

  // Serve portal static files
  const portalPath = path.join(process.cwd(), 'frontends', 'portal');
  app.use(express.static(portalPath));

  // Fallback to index.html
  app.get('/', (_req, res) => {
    res.sendFile(path.join(portalPath, 'index.html'));
  });

  // Register all route modules
  registerHealthRoutes(app, { getDb, getAgentPool, getScheduler });
  registerDbRoutes(app, { getDb, dbPath: DB_PATH });
  registerTaskRoutes(app, { getDb });
  registerSkillsRoutes(app, { getDb });
  registerIssuesRoutes(app, { getDb });
  registerContentRoutes(app, { getDb });
  registerTriageRoutes(app, { getDb });
  registerIntegrationsRoutes(app, { getDb });
  registerChannelsRoutes(app, { getDb, getRouter });

  // Create HTTP server
  server = createServer(app);

  // Create WebSocket server on same port
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    // Send welcome message
    ws.send(
      JSON.stringify({
        ts: Date.now(),
        level: 'info',
        content: '🚗 Connected to KITT Live Logs',
        source: 'system',
      })
    );

    // Send buffered logs (recent history)
    logBuffer.forEach((entry) => {
      ws.send(JSON.stringify(entry));
    });
  });

  // Start listening - localhost only for security
  const actualPort = Number(process.env.KITT_PORT) || 8000;
  server.listen(actualPort, '127.0.0.1', () => {
    originalConsole.log(`[kitt-bridge] 🌐 KITT Bridge running at http://localhost:${actualPort}`);
  });

  // Install interceptors after server is ready
  installLogInterceptor();

  return { server, wss };
}

/**
 * Stop the log server
 */
export async function stopLogServer(): Promise<void> {
  // Restore original console methods
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;

  if (wss) {
    wss.close();
    wss = null;
  }

  if (server) {
    await new Promise<void>((resolve) => {
      server!.close(() => resolve());
    });
    server = null;
  }
}
