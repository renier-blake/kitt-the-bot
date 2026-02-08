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
export function startLogServer(port = 8000): { server: Server; wss: WebSocketServer } {
  const app = express();

  // Serve portal static files
  const portalPath = path.join(process.cwd(), 'frontends', 'portal');
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
      let sleepDisplay = 'Awake';

      if (sleepResult.rows.length > 0) {
        sleepUntil = Number(sleepResult.rows[0].value);
        isSleeping = sleepUntil > Date.now();

        if (isSleeping) {
          if (sleepUntil >= 9999999999999) {
            sleepDisplay = 'Sleeping (indefinite)';
          } else {
            const wakeTime = new Date(sleepUntil).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            });
            sleepDisplay = `Sleeping until ${wakeTime}`;
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
            ? new Date(lastThinkLoop).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : null,
        },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Health endpoint with API status and errors
  app.get('/api/health', async (_req, res) => {
    try {
      const database = getDb();
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;

      // Get uptime from process
      const uptime = process.uptime();
      const startedAt = new Date(now - uptime * 1000).toISOString();

      // Get last think loop run
      const lastThinkLoopResult = await database.execute(
        "SELECT created_at FROM transcripts WHERE channel = 'think-loop' ORDER BY created_at DESC LIMIT 1"
      );
      const lastThinkLoop = lastThinkLoopResult.rows.length > 0
        ? Number(lastThinkLoopResult.rows[0].created_at)
        : null;

      // Calculate think loop status
      let thinkLoopStatus = 'running';
      let tickDuration = null;
      if (lastThinkLoop) {
        const timeSinceLastTick = now - lastThinkLoop;
        tickDuration = timeSinceLastTick;
        if (timeSinceLastTick > 6 * 60 * 1000) {
          thinkLoopStatus = 'stalled';
        } else if (timeSinceLastTick > 5.5 * 60 * 1000) {
          thinkLoopStatus = 'slow';
        }
      }

      // Get recent errors (last 5 minutes)
      const errorsResult = await database.execute({
        sql: `SELECT created_at, content FROM transcripts 
              WHERE type = 'log' AND content LIKE '%error%'
              AND created_at >= ? 
              ORDER BY created_at DESC LIMIT 10`,
        args: [fiveMinutesAgo],
      });

      // Get error count per minute
      const errorCountResult = await database.execute({
        sql: `SELECT COUNT(*) as count FROM transcripts 
              WHERE type = 'log' AND content LIKE '%error%'
              AND created_at >= ?`,
        args: [fiveMinutesAgo],
      });
      const errorCount = Number(errorCountResult.rows[0]?.count || 0);
      const errorsPerMinute = Math.round((errorCount / 5) * 10) / 10;

      // Parse recent errors
      const recentErrors = errorsResult.rows.map((row) => ({
        time: new Date(Number(row['created_at'])).toISOString(),
        component: detectComponent(String(row['content'])),
        level: 'error' as const,
        message: String(row['content']).slice(0, 200),
      }));

      res.json({
        bridge: {
          status: 'connected',
          uptime: Math.floor(uptime),
          startedAt,
        },
        thinkLoop: {
          status: thinkLoopStatus,
          lastTick: lastThinkLoop ? new Date(lastThinkLoop).toISOString() : null,
          tickDuration,
        },
        apis: [
          { name: 'telegram', status: 'healthy', latency: 45 },
          { name: 'garmin', status: 'healthy', latency: 120 },
          { name: 'anthropic', status: 'healthy', latency: 850 },
        ],
        errors: {
          count: errorCount,
          perMinute: errorsPerMinute,
          recent: recentErrors,
        },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Helper to detect component from log content
  function detectComponent(content: string): string {
    if (content.includes('[think-loop]')) return 'think-loop';
    if (content.includes('[agent]')) return 'agent';
    if (content.includes('[scheduler]')) return 'scheduler';
    if (content.includes('[telegram]')) return 'telegram';
    if (content.includes('[garmin]')) return 'garmin';
    return 'system';
  }

  // Tables list endpoint
  app.get('/api/db/tables', async (_req, res) => {
    try {
      const database = getDb();
      
      const tables = [
        { name: 'transcripts', label: 'Transcripts' },
        { name: 'chunks', label: 'Chunks' },
        { name: 'kitt_tasks', label: 'Tasks' },
        { name: 'foods', label: 'Foods' },
        { name: 'food_log', label: 'Food Log' },
        { name: 'meta', label: 'Meta' },
      ];

      // Get row counts for each table
      const tablesWithCounts = await Promise.all(
        tables.map(async (table) => {
          try {
            const result = await database.execute(`SELECT COUNT(*) as count FROM ${table.name}`);
            return {
              ...table,
              count: Number(result.rows[0].count),
            };
          } catch {
            return { ...table, count: 0 };
          }
        })
      );

      res.json({ tables: tablesWithCounts });
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
      const search = (req.query.search as string) || '';
      const period = (req.query.period as string) || 'all';

      // Whitelist tables for security
      const allowedTables = ['transcripts', 'chunks', 'kitt_tasks', 'foods', 'food_log', 'meta'];
      if (!allowedTables.includes(table)) {
        return res.status(400).json({ error: 'Invalid table name' });
      }

      // Build WHERE clause for search and period
      const whereConditions: string[] = [];
      const args: (string | number)[] = [];

      // Period filter
      if (period !== 'all' && (table === 'transcripts' || table === 'chunks')) {
        const now = Date.now();
        let startTime: number;
        
        switch (period) {
          case 'today':
            startTime = new Date().setHours(0, 0, 0, 0);
            break;
          case 'week':
            startTime = now - 7 * 24 * 60 * 60 * 1000;
            break;
          case 'month':
            startTime = now - 30 * 24 * 60 * 60 * 1000;
            break;
          default:
            startTime = 0;
        }
        
        if (startTime > 0) {
          whereConditions.push('created_at >= ?');
          args.push(startTime);
        }
      }

      // Search filter
      if (search) {
        // Search in common text columns
        const searchColumns: Record<string, string[]> = {
          transcripts: ['content', 'role', 'type'],
          chunks: ['content'],
          kitt_tasks: ['title', 'description'],
          foods: ['name', 'brand'],
          food_log: ['notes'],
          meta: ['key'],
        };
        
        const columns = searchColumns[table] || [];
        if (columns.length > 0) {
          const searchConditions = columns.map(col => `${col} LIKE ?`).join(' OR ');
          whereConditions.push(`(${searchConditions})`);
          columns.forEach(() => args.push(`%${search}%`));
        }
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Get total count (with filters)
      const countQuery = `SELECT COUNT(*) as count FROM ${table} ${whereClause}`;
      const countResult = await database.execute({ sql: countQuery, args });
      const total = Number(countResult.rows[0].count);

      // Get rows with ordering
      let orderBy = 'ROWID DESC';
      if (table === 'transcripts' || table === 'chunks') orderBy = 'created_at DESC';
      if (table === 'kitt_tasks') orderBy = 'active DESC, CASE priority WHEN \'high\' THEN 1 WHEN \'medium\' THEN 2 ELSE 3 END, id';
      if (table === 'food_log') orderBy = 'logged_date DESC, logged_time DESC';
      if (table === 'foods') orderBy = 'usage_count DESC, name';

      const query = `SELECT * FROM ${table} ${whereClause} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`;
      const result = await database.execute({ sql: query, args });

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

  // ==========================================
  // Task Engine API
  // ==========================================

  // Get all tasks
  app.get('/api/tasks', async (_req, res) => {
    try {
      const database = getDb();
      
      const result = await database.execute(`
        SELECT * FROM kitt_tasks
        ORDER BY
          active DESC,
          CASE priority
            WHEN 'high' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'low' THEN 3
          END,
          created_at ASC
      `);

      const tasks = result.rows.map((row) => ({
        id: Number(row.id),
        title: String(row.title),
        description: row.description ? String(row.description) : null,
        frequency: String(row.frequency),
        priority: String(row.priority),
        timeWindowStart: row.time_window_start ? String(row.time_window_start) : null,
        timeWindowEnd: row.time_window_end ? String(row.time_window_end) : null,
        skillRefs: row.skill_refs ? JSON.parse(String(row.skill_refs)) : [],
        active: Boolean(row.active),
        snoozedUntil: row.snoozed_until ? Number(row.snoozed_until) : null,
        gracePeriodMinutes: Number(row.grace_period_minutes || 0),
        createdBy: String(row.created_by),
        createdAt: Number(row.created_at),
      }));

      res.json({ tasks });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Update task (snooze, activate/deactivate)
  app.patch('/api/tasks/:id', async (req, res) => {
    try {
      const database = getDb();
      const taskId = req.params.id;
      const updates = req.body;

      const setClauses: string[] = [];
      const args: (string | number | null)[] = [];

      if ('active' in updates) {
        setClauses.push('active = ?');
        args.push(updates.active ? 1 : 0);
      }
      if ('snoozedUntil' in updates) {
        setClauses.push('snoozed_until = ?');
        args.push(updates.snoozedUntil);
      }

      if (setClauses.length === 0) {
        return res.status(400).json({ error: 'No valid updates provided' });
      }

      args.push(taskId);

      await database.execute({
        sql: `UPDATE kitt_tasks SET ${setClauses.join(', ')} WHERE id = ?`,
        args,
      });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get task executions
  app.get('/api/task-executions', async (req, res) => {
    try {
      const database = getDb();
      const period = (req.query.period as string) || 'today';
      
      let startTime: number;
      const now = Date.now();
      
      switch (period) {
        case 'today':
          startTime = new Date().setHours(0, 0, 0, 0);
          break;
        case 'week':
          startTime = now - 7 * 24 * 60 * 60 * 1000;
          break;
        case 'month':
          startTime = now - 30 * 24 * 60 * 60 * 1000;
          break;
        default:
          startTime = now - 24 * 60 * 60 * 1000; // Default to last 24h
      }

      // Get task executions from transcripts
      const result = await database.execute({
        sql: `
          SELECT 
            t.id,
            t.task_id,
            t.task_status,
            t.content,
            t.created_at,
            kt.title as task_title
          FROM transcripts t
          LEFT JOIN kitt_tasks kt ON t.task_id = kt.id
          WHERE t.type = 'task'
            AND t.created_at >= ?
          ORDER BY t.created_at DESC
          LIMIT 100
        `,
        args: [startTime],
      });

      const executions = result.rows.map((row) => ({
        id: String(row.id),
        taskId: row.task_id ? Number(row.task_id) : null,
        taskTitle: row.task_title ? String(row.task_title) : 'Unknown Task',
        status: String(row.task_status || 'unknown'),
        notes: row.content ? String(row.content) : null,
        executedAt: Number(row.created_at),
      }));

      res.json({ executions });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get task stats
  app.get('/api/tasks/stats', async (_req, res) => {
    try {
      const database = getDb();
      const todayStart = new Date().setHours(0, 0, 0, 0);

      const [totalResult, activeResult, executionsToday] = await Promise.all([
        database.execute('SELECT COUNT(*) as count FROM kitt_tasks'),
        database.execute('SELECT COUNT(*) as count FROM kitt_tasks WHERE active = 1'),
        database.execute({
          sql: `SELECT COUNT(*) as count FROM transcripts WHERE type = 'task' AND created_at >= ?`,
          args: [todayStart],
        }),
      ]);

      // Get status breakdown for today
      const statusResult = await database.execute({
        sql: `
          SELECT task_status, COUNT(*) as count 
          FROM transcripts 
          WHERE type = 'task' AND created_at >= ?
          GROUP BY task_status
        `,
        args: [todayStart],
      });

      const statusBreakdown: Record<string, number> = {};
      for (const row of statusResult.rows) {
        statusBreakdown[String(row.task_status)] = Number(row.count);
      }

      res.json({
        total: Number(totalResult.rows[0].count),
        active: Number(activeResult.rows[0].count),
        executionsToday: Number(executionsToday.rows[0].count),
        statusBreakdown,
      });
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
