/**
 * KITT Portal Server
 * Live logs (WebSocket) + Database viewer (REST API)
 */

import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer, type Server } from 'http';
import path from 'path';
import { createClient, type Client } from '@libsql/client';

const DB_PATH = process.env.KITT_DB_PATH || './profile/memory/kitt.db';
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
  if (content.includes('[think-loop]')) return 'think-loop';
  if (content.includes('[agent]')) return 'agent';
  if (content.includes('[scheduler]')) return 'scheduler';
  if (content.includes('[telegram]')) return 'telegram';
  if (content.startsWith('{"ts":')) return 'structured';
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
export function startLogServer(port = 3000): { server: Server; wss: WebSocketServer } {
  const app = express();

  // Serve portal static files
  const portalPath = path.join(process.cwd(), '.claude', 'portal');
  app.use(express.static(portalPath));

  // Fallback to index.html
  app.get('/', (_req, res) => {
    res.sendFile(path.join(portalPath, 'index.html'));
  });

  // ==========================================
  // Database API routes
  // ==========================================

  // KITT Status endpoint (sleep mode, etc.)
  app.get('/api/status', async (_req, res) => {
    try {
      const database = getDb();

      // Get sleep status
      const sleepResult = await database.execute(
        "SELECT value FROM meta WHERE key = 'kitt_sleep_until'"
      );
      let sleepUntil: number | null = null;
      let isSleeping = false;
      let sleepDisplay = 'Wakker';

      if (sleepResult.rows.length > 0) {
        sleepUntil = Number(sleepResult.rows[0].value);
        isSleeping = sleepUntil > Date.now();

        if (isSleeping) {
          // Format display
          if (sleepUntil >= 9999999999999) {
            sleepDisplay = '😴 Slaapt (onbeperkt)';
          } else {
            const wakeTime = new Date(sleepUntil).toLocaleTimeString('nl-NL', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Europe/Amsterdam',
            });
            sleepDisplay = `😴 Slaapt tot ${wakeTime}`;
          }
        }
      }

      // Get last think loop run
      const lastThinkLoopResult = await database.execute(
        "SELECT created_at FROM transcripts WHERE channel = 'think-loop' ORDER BY created_at DESC LIMIT 1"
      );
      const lastThinkLoop = lastThinkLoopResult.rows.length > 0
        ? Number(lastThinkLoopResult.rows[0].created_at)
        : null;

      res.json({
        sleep: {
          isSleeping,
          sleepUntil,
          display: sleepDisplay,
        },
        thinkLoop: {
          lastRun: lastThinkLoop,
          lastRunDisplay: lastThinkLoop
            ? new Date(lastThinkLoop).toLocaleTimeString('nl-NL', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Europe/Amsterdam',
              })
            : null,
        },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Stats endpoint
  app.get('/api/db/stats', async (_req, res) => {
    try {
      const database = getDb();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [transcripts, transcriptsToday, chunks, tasks, foods, foodLog, foodLogToday] = await Promise.all([
        database.execute('SELECT COUNT(*) as count FROM transcripts'),
        database.execute({ sql: 'SELECT COUNT(*) as count FROM transcripts WHERE created_at >= ?', args: [todayStart.getTime()] }),
        database.execute('SELECT COUNT(*) as count FROM chunks'),
        database.execute('SELECT COUNT(*) as count FROM kitt_tasks'),
        database.execute('SELECT COUNT(*) as count FROM foods'),
        database.execute('SELECT COUNT(*) as count FROM food_log'),
        database.execute("SELECT COUNT(*) as count FROM food_log WHERE logged_date = date('now', 'localtime')"),
      ]);

      res.json({
        path: DB_PATH,
        transcripts: Number(transcripts.rows[0].count),
        transcripts_today: Number(transcriptsToday.rows[0].count),
        chunks: Number(chunks.rows[0].count),
        kitt_tasks: Number(tasks.rows[0].count),
        foods: Number(foods.rows[0].count),
        food_log: Number(foodLog.rows[0].count),
        food_log_today: Number(foodLogToday.rows[0].count),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Table data endpoint
  app.get('/api/db/table/:table', async (req, res) => {
    try {
      const database = getDb();
      const table = req.params.table;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = (page - 1) * limit;

      // Whitelist tables for security
      const allowedTables = ['transcripts', 'chunks', 'kitt_tasks', 'foods', 'food_log', 'meta'];
      if (!allowedTables.includes(table)) {
        return res.status(400).json({ error: 'Invalid table name' });
      }

      // Get total count
      const countResult = await database.execute(`SELECT COUNT(*) as count FROM ${table}`);
      const total = Number(countResult.rows[0].count);

      // Get rows with ordering
      let orderBy = 'ROWID DESC';
      if (table === 'transcripts' || table === 'chunks') orderBy = 'created_at DESC';
      if (table === 'kitt_tasks') orderBy = 'active DESC, CASE priority WHEN \'high\' THEN 1 WHEN \'medium\' THEN 2 ELSE 3 END, id';
      if (table === 'food_log') orderBy = 'logged_date DESC, logged_time DESC';
      if (table === 'foods') orderBy = 'usage_count DESC, name';

      const result = await database.execute(`SELECT * FROM ${table} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`);

      res.json({ rows: result.rows, total, page, limit });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Custom query endpoint (read-only)
  app.get('/api/db/query', async (req, res) => {
    try {
      const database = getDb();
      const sql = req.query.sql as string;

      if (!sql) {
        return res.status(400).json({ error: 'Missing sql parameter' });
      }

      // Block write operations
      const sqlLower = sql.toLowerCase().trim();
      if (sqlLower.startsWith('insert') || sqlLower.startsWith('update') ||
          sqlLower.startsWith('delete') || sqlLower.startsWith('drop') ||
          sqlLower.startsWith('alter') || sqlLower.startsWith('create')) {
        return res.status(400).json({ error: 'Only SELECT queries allowed' });
      }

      const result = await database.execute(sql);
      res.json({ rows: result.rows });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

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
  const actualPort = Number(process.env.LOG_SERVER_PORT) || port;
  server.listen(actualPort, '127.0.0.1', () => {
    originalConsole.log(`[kitt-portal] 🌐 KITT Portal running at http://localhost:${actualPort}`);
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
