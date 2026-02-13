/**
 * KITT Portal Server
 * Live logs (WebSocket) + Database viewer (REST API)
 */

import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer, type Server } from 'http';
import path from 'path';
import { createClient, type Client } from '@libsql/client';
import {
  listIntegrations,
  listConnections,
  createConnectSession,
  deleteConnection,
  getConnection,
  registerConnection,
  getDefaultConnection,
  type KittConnection,
} from '../integrations/nango.js';
import {
  getAllConfig,
  setConfigValue,
  getConnections as getLocalConnections,
  setDefaultConnection,
} from '../integrations/config.js';
import {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  getOAuthConfig,
  isOAuthConnected,
  disconnectOAuth,
} from '../integrations/oauth.js';
import { testSlackConnection } from '../integrations/slack.js';
import { getRouter } from './router.js';
import { getAgentPool } from './agent-pool.js';
import { getScheduler } from '../scheduler/index.js';
import type { WhatsAppAdapter } from './adapters/whatsapp.js';
import type { SlackAdapter } from './adapters/slack.js';
import { registerSlackEventsRoute } from './slack-events.js';
import * as fs from 'fs';

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
  if (content.includes('[agent-pool]')) return 'agent-pool';
  if (content.includes('[think-loop]')) return 'think-loop';
  if (content.includes('[agent]')) return 'agent';
  if (content.includes('[scheduler]')) return 'scheduler';
  if (content.includes('[telegram]')) return 'telegram';
  if (content.includes('[slack]')) return 'slack';
  if (content.includes('[tunnel]')) return 'tunnel';
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

  // Parse JSON body — preserve raw body for Slack signature verification
  app.use(express.json({
    verify: (req, _res, buf) => {
      (req as unknown as { rawBody: string }).rawBody = buf.toString();
    },
  }));

  // Register Slack Events API route (always — route self-guards via signing secret + adapter check)
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

  // ==========================================
  // Agent Pool API (KITT-147: Observability)
  // ==========================================

  app.get('/api/agents', async (_req, res) => {
    try {
      const pool = getAgentPool();
      const [recent, stats] = await Promise.all([
        pool.getRecent(20),
        pool.getStats(),
      ]);
      res.json({
        active: pool.getActive(),
        recent,
        stats,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
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

      // Get last think loop tick — prefer in-memory (always updated), fallback to DB
      const schedulerStatus = getScheduler().getStatus();
      let lastThinkLoop = schedulerStatus.lastTickAt;

      if (!lastThinkLoop) {
        // Fallback: DB transcript (only written when think loop takes action)
        const lastThinkLoopResult = await database.execute(
          "SELECT created_at FROM transcripts WHERE channel = 'think-loop' ORDER BY created_at DESC LIMIT 1"
        );
        lastThinkLoop = lastThinkLoopResult.rows.length > 0
          ? Number(lastThinkLoopResult.rows[0].created_at)
          : null;
      }

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
    if (content.includes('[slack]')) return 'slack';
    if (content.includes('[tunnel]')) return 'tunnel';
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

  // ==========================================
  // Skills API
  // ==========================================

  // Get all skills from capabilities registry
  app.get('/api/skills', async (_req, res) => {
    try {
      const database = getDb();
      const result = await database.execute(
        "SELECT * FROM capabilities WHERE category = 'skill' ORDER BY sort_order, name"
      );

      const skills = result.rows.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        description: row.description ? String(row.description) : null,
        icon: row.icon ? String(row.icon) : null,
        skillType: row.skill_type ? String(row.skill_type) : 'user',
        execution: String(row.execution || 'direct'),
        model: row.model ? String(row.model) : null,
        path: row.path ? String(row.path) : null,
        triggers: row.triggers ? JSON.parse(String(row.triggers)) : [],
        modes: row.modes ? JSON.parse(String(row.modes)) : [],
        enabled: Boolean(row.enabled),
        sortOrder: Number(row.sort_order || 0),
      }));

      res.json({ skills });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Update skill (enable/disable) - user skills only
  app.patch('/api/skills/:id', async (req, res) => {
    try {
      const database = getDb();
      const { enabled } = req.body;
      const id = req.params.id;

      const existing = await database.execute({
        sql: 'SELECT skill_type FROM capabilities WHERE id = ?',
        args: [id],
      });

      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Skill not found' });
      }

      if (String(existing.rows[0].skill_type) === 'system') {
        return res.status(403).json({ error: 'Cannot modify system skills' });
      }

      await database.execute({
        sql: 'UPDATE capabilities SET enabled = ?, updated_at = ? WHERE id = ?',
        args: [enabled ? 1 : 0, Date.now(), id],
      });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get skill SKILL.md content
  app.get('/api/skills/:id/content', async (req, res) => {
    try {
      const database = getDb();
      const id = req.params.id;

      const result = await database.execute({
        sql: 'SELECT path FROM capabilities WHERE id = ? AND category = ?',
        args: [id, 'skill'],
      });

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Skill not found' });
      }

      const skillPath = String(result.rows[0].path);
      const skillMdPath = path.join(process.cwd(), skillPath, 'SKILL.md');

      if (!fs.existsSync(skillMdPath)) {
        return res.status(404).json({ error: 'SKILL.md not found' });
      }

      const content = fs.readFileSync(skillMdPath, 'utf-8');

      // Strip frontmatter for display
      const stripped = content.replace(/^---\n[\s\S]*?\n---\n*/, '').trim();

      res.json({ content: stripped, raw: content });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ==========================================
  // Portal Project Management API
  // ==========================================

  // Get all projects
  app.get('/api/projects', async (_req, res) => {
    try {
      const database = getDb();
      const result = await database.execute('SELECT * FROM portal_projects ORDER BY identifier ASC');
      const projects = result.rows.map((row) => ({
        id: Number(row.id),
        identifier: String(row.identifier),
        name: String(row.name),
        description: row.description ? String(row.description) : null,
        color: String(row.color),
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at),
      }));
      res.json({ projects });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get all cycles
  app.get('/api/cycles', async (_req, res) => {
    try {
      const database = getDb();
      const result = await database.execute('SELECT * FROM portal_cycles ORDER BY start_date DESC');
      const cycles = result.rows.map((row) => ({
        id: Number(row.id),
        name: String(row.name),
        status: String(row.status),
        startDate: Number(row.start_date),
        endDate: Number(row.end_date),
        createdAt: Number(row.created_at),
      }));
      res.json({ cycles });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get all labels
  app.get('/api/labels', async (_req, res) => {
    try {
      const database = getDb();
      const result = await database.execute('SELECT * FROM portal_labels ORDER BY name ASC');
      const labels = result.rows.map((row) => ({
        id: Number(row.id),
        name: String(row.name),
        color: String(row.color),
        createdAt: Number(row.created_at),
      }));
      res.json({ labels });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get issues with filters
  app.get('/api/issues', async (req, res) => {
    try {
      const database = getDb();
      const { project, cycle, state, priority, complexity, scope, search, parentId, topLevel, labels } = req.query;

      let sql = `
        SELECT
          i.id,
          i.identifier,
          i.title,
          i.description,
          i.state,
          i.priority,
          i.type,
          i.complexity,
          i.scope,
          i.project_id,
          i.cycle_id,
          i.parent_id,
          i.position,
          i.due_date,
          i.scheduled_date,
          i.scheduled_time_start,
          i.scheduled_time_end,
          i.scheduled_timezone,
          i.start_date,
          i.created_by,
          i.created_at,
          i.updated_at,
          p.identifier as project_identifier,
          p.color as project_color,
          c.name as cycle_name,
          (SELECT COUNT(*) FROM portal_issues c2 WHERE c2.parent_id = i.id) as child_count
        FROM portal_issues i
        LEFT JOIN portal_projects p ON i.project_id = p.id
        LEFT JOIN portal_cycles c ON i.cycle_id = c.id
        WHERE 1=1
      `;
      const args: (string | number)[] = [];

      if (project) {
        sql += ' AND i.project_id = ?';
        args.push(Number(project));
      }
      if (cycle) {
        sql += ' AND i.cycle_id = ?';
        args.push(Number(cycle));
      }
      if (state) {
        sql += ' AND i.state = ?';
        args.push(String(state));
      }
      if (priority) {
        sql += ' AND i.priority = ?';
        args.push(String(priority));
      }
      if (complexity) {
        sql += ' AND i.complexity = ?';
        args.push(String(complexity));
      }
      if (scope) {
        sql += ' AND i.scope = ?';
        args.push(String(scope));
      }
      if (parentId) {
        sql += ' AND i.parent_id = ?';
        args.push(Number(parentId));
      }
      if (topLevel === 'true') {
        sql += ' AND i.parent_id IS NULL';
      }
      if (search) {
        sql += ' AND (i.title LIKE ? OR i.description LIKE ?)';
        const searchTerm = `%${search}%`;
        args.push(searchTerm, searchTerm);
      }
      if (labels) {
        const labelIds = Array.isArray(labels) 
          ? labels.map(Number) 
          : [Number(labels)];
        const placeholders = labelIds.map(() => '?').join(',');
        sql += ` AND EXISTS (
          SELECT 1 FROM portal_issue_labels il 
          WHERE il.issue_id = i.id AND il.label_id IN (${placeholders})
        )`;
        args.push(...labelIds);
      }

      sql += ' ORDER BY i.state, i.position ASC, i.created_at ASC';

      const result = await database.execute({ sql, args });

      // Get labels for all issues
      const issueIds = result.rows.map((row) => Number(row.id));
      const labelsMap: Record<number, { id: number; name: string; color: string }[]> = {};

      if (issueIds.length > 0) {
        const placeholders = issueIds.map(() => '?').join(',');
        const labelsResult = await database.execute({
          sql: `
            SELECT il.issue_id, l.id, l.name, l.color
            FROM portal_issue_labels il
            JOIN portal_labels l ON il.label_id = l.id
            WHERE il.issue_id IN (${placeholders})
          `,
          args: issueIds,
        });

        for (const row of labelsResult.rows) {
          const issueId = Number(row.issue_id);
          if (!labelsMap[issueId]) labelsMap[issueId] = [];
          labelsMap[issueId].push({
            id: Number(row.id),
            name: String(row.name),
            color: String(row.color),
          });
        }
      }

      const issues = result.rows.map((row) => ({
        id: Number(row.id),
        identifier: String(row.identifier),
        title: String(row.title),
        description: row.description ? String(row.description) : null,
        state: String(row.state),
        priority: String(row.priority),
        type: String(row.type),
        complexity: row.complexity ? String(row.complexity) : 'medium',
        scope: row.scope ? String(row.scope) : 'isolated',
        projectId: Number(row.project_id),
        cycleId: row.cycle_id ? Number(row.cycle_id) : null,
        parentId: row.parent_id ? Number(row.parent_id) : null,
        childCount: Number(row.child_count) || 0,
        position: row.position ? Number(row.position) : 0,
        createdBy: String(row.created_by),
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at),
        project: row.project_identifier
          ? { identifier: String(row.project_identifier), color: String(row.project_color) }
          : null,
        cycle: row.cycle_name ? { name: String(row.cycle_name) } : null,
        labels: labelsMap[Number(row.id)] || [],
      }));

      res.json({ issues });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Create new issue
  app.post('/api/issues', async (req, res) => {
    try {
      const database = getDb();
      const { title, description, projectId, priority = 'medium', type = 'feature', cycleId, parentId } = req.body;

      if (!title || !projectId) {
        res.status(400).json({ error: 'Title and projectId are required' });
        return;
      }

      // Get project identifier for generating issue number
      const projectResult = await database.execute({
        sql: 'SELECT identifier FROM portal_projects WHERE id = ?',
        args: [projectId],
      });

      if (projectResult.rows.length === 0) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const projectIdentifier = String(projectResult.rows[0].identifier);

      // Get next issue number by prefix (search ALL issues with this prefix, not just this project)
      const maxResult = await database.execute({
        sql: `SELECT COALESCE(MAX(CAST(SUBSTR(identifier, LENGTH(?) + 2) AS INTEGER)), 0) as max_num
              FROM portal_issues WHERE identifier LIKE ? || '-%'`,
        args: [projectIdentifier, projectIdentifier],
      });

      const issueNumber = Number(maxResult.rows[0].max_num) + 1;
      const identifier = `${projectIdentifier}-${issueNumber}`;

      // Get max position in backlog to append at the end
      const positionResult = await database.execute({
        sql: 'SELECT COALESCE(MAX(position), -1) as max_pos FROM portal_issues WHERE state = ?',
        args: ['backlog'],
      });
      const newPosition = Number(positionResult.rows[0].max_pos) + 1000;

      const now = Date.now();
      const result = await database.execute({
        sql: `
          INSERT INTO portal_issues (
            identifier, title, description, state, priority, type,
            project_id, cycle_id, parent_id, position, created_by, created_at, updated_at,
            scheduled_date, scheduled_time_start, scheduled_time_end, scheduled_timezone, due_date, start_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          identifier,
          title,
          description || null,
          'backlog',
          priority,
          type,
          projectId,
          cycleId || null,
          parentId || null,
          newPosition,
          'KITT',
          now,
          now,
          null, // scheduled_date
          null, // scheduled_time_start
          null, // scheduled_time_end
          'Europe/Amsterdam', // scheduled_timezone
          null, // due_date
          null, // start_date
        ],
      });

      const newIssue = {
        id: Number(result.lastInsertRowid),
        identifier,
        title,
        description: description || null,
        state: 'backlog',
        priority,
        type,
        projectId,
        cycleId: cycleId || null,
        parentId: parentId || null,
        childCount: 0,
        createdBy: 'KITT',
        createdAt: now,
        updatedAt: now,
        labels: [],
      };

      res.status(201).json({ issue: newIssue });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Update issue
  app.patch('/api/issues/:id', async (req, res) => {
    try {
      const database = getDb();
      const issueId = Number(req.params.id);
      const {
        state, priority, title, description, cycleId, position, complexity, scope,
        dueDate, scheduledDate, scheduledTimeStart, scheduledTimeEnd, scheduledTimezone, startDate,
        parentId, projectId
      } = req.body;

      const updates: string[] = [];
      const args: (string | number | null)[] = [];

      if (state !== undefined) {
        updates.push('state = ?');
        args.push(state);
      }
      if (priority !== undefined) {
        updates.push('priority = ?');
        args.push(priority);
      }
      if (title !== undefined) {
        updates.push('title = ?');
        args.push(title);
      }
      if (description !== undefined) {
        updates.push('description = ?');
        args.push(description);
      }
      if (cycleId !== undefined) {
        updates.push('cycle_id = ?');
        args.push(cycleId);
      }
      if (position !== undefined) {
        updates.push('position = ?');
        args.push(position);
      }
      if (complexity !== undefined) {
        updates.push('complexity = ?');
        args.push(complexity);
      }
      if (scope !== undefined) {
        updates.push('scope = ?');
        args.push(scope);
      }
      if (dueDate !== undefined) {
        updates.push('due_date = ?');
        args.push(dueDate ? Number(dueDate) : null);
      }
      if (scheduledDate !== undefined) {
        updates.push('scheduled_date = ?');
        args.push(scheduledDate ? Number(scheduledDate) : null);
      }
      if (scheduledTimeStart !== undefined) {
        updates.push('scheduled_time_start = ?');
        args.push(scheduledTimeStart ? Number(scheduledTimeStart) : null);
      }
      if (scheduledTimeEnd !== undefined) {
        updates.push('scheduled_time_end = ?');
        args.push(scheduledTimeEnd ? Number(scheduledTimeEnd) : null);
      }
      if (scheduledTimezone !== undefined) {
        updates.push('scheduled_timezone = ?');
        args.push(scheduledTimezone || null);
      }
      if (startDate !== undefined) {
        updates.push('start_date = ?');
        args.push(startDate ? Number(startDate) : null);
      }
      if (parentId !== undefined) {
        updates.push('parent_id = ?');
        args.push(parentId ? Number(parentId) : null);
      }
      if (projectId !== undefined) {
        updates.push('project_id = ?');
        args.push(Number(projectId));
      }

      if (updates.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      updates.push('updated_at = ?');
      args.push(Date.now());
      args.push(issueId);

      await database.execute({
        sql: `UPDATE portal_issues SET ${updates.join(', ')} WHERE id = ?`,
        args,
      });

      // Add history entry for state changes
      if (state) {
        await database.execute({
          sql: `
            INSERT INTO portal_issue_history (issue_id, type, old_value, new_value, created_by, created_at)
            SELECT ?, 'state_change', state, ?, 'KITT', ? FROM portal_issues WHERE id = ?
          `,
          args: [issueId, state, Date.now(), issueId],
        });
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Update issue labels (replace all labels)
  app.put('/api/issues/:id/labels', async (req, res) => {
    try {
      const database = getDb();
      const issueId = Number(req.params.id);
      const { labelIds } = req.body as { labelIds: number[] };

      if (!Array.isArray(labelIds)) {
        res.status(400).json({ error: 'labelIds must be an array' });
        return;
      }

      // Delete existing labels
      await database.execute({
        sql: 'DELETE FROM portal_issue_labels WHERE issue_id = ?',
        args: [issueId],
      });

      // Insert new labels
      for (const labelId of labelIds) {
        await database.execute({
          sql: 'INSERT INTO portal_issue_labels (issue_id, label_id) VALUES (?, ?)',
          args: [issueId, labelId],
        });
      }

      // Update timestamp
      await database.execute({
        sql: 'UPDATE portal_issues SET updated_at = ? WHERE id = ?',
        args: [Date.now(), issueId],
      });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ==========================================
  // Content Calendar API (KITT-168)
  // ==========================================

  // Get content projects
  app.get('/api/content/projects', async (_req, res) => {
    try {
      const database = getDb();
      const result = await database.execute('SELECT * FROM content_projects ORDER BY identifier ASC');
      const projects = result.rows.map((row) => ({
        id: Number(row.id),
        identifier: String(row.identifier),
        name: String(row.name),
        description: row.description ? String(row.description) : null,
        color: String(row.color),
        createdAt: Number(row.created_at),
      }));
      res.json({ projects });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get content labels
  app.get('/api/content/labels', async (_req, res) => {
    try {
      const database = getDb();
      const result = await database.execute('SELECT * FROM content_labels ORDER BY name ASC');
      const labels = result.rows.map((row) => ({
        id: Number(row.id),
        name: String(row.name),
        color: String(row.color),
        createdAt: Number(row.created_at),
      }));
      res.json({ labels });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get content items with filters
  app.get('/api/content/items', async (req, res) => {
    try {
      const database = getDb();
      const { project, state, contentType, priority, search, labels } = req.query;

      let sql = `
        SELECT
          i.id, i.identifier, i.title, i.description,
          i.content_type, i.topic, i.angle, i.hook, i.script, i.image_urls,
          i.state, i.priority,
          i.project_id, i.position,
          i.due_date, i.scheduled_date, i.publish_date, i.published_url,
          i.created_by, i.created_at, i.updated_at,
          p.identifier as project_identifier,
          p.color as project_color
        FROM content_items i
        LEFT JOIN content_projects p ON i.project_id = p.id
        WHERE 1=1
      `;
      const args: (string | number)[] = [];

      if (project) { sql += ' AND i.project_id = ?'; args.push(Number(project)); }
      if (state) { sql += ' AND i.state = ?'; args.push(String(state)); }
      if (contentType) { sql += ' AND i.content_type = ?'; args.push(String(contentType)); }
      if (priority) { sql += ' AND i.priority = ?'; args.push(String(priority)); }
      if (search) {
        sql += ' AND (i.title LIKE ? OR i.description LIKE ? OR i.topic LIKE ?)';
        const searchTerm = `%${search}%`;
        args.push(searchTerm, searchTerm, searchTerm);
      }
      if (labels) {
        const labelIds = Array.isArray(labels) ? labels.map(Number) : [Number(labels)];
        const placeholders = labelIds.map(() => '?').join(',');
        sql += ` AND EXISTS (
          SELECT 1 FROM content_item_labels il
          WHERE il.item_id = i.id AND il.label_id IN (${placeholders})
        )`;
        args.push(...labelIds);
      }

      sql += ' ORDER BY i.state, i.position ASC, i.created_at ASC';

      const result = await database.execute({ sql, args });

      // Get labels for all items
      const itemIds = result.rows.map((row) => Number(row.id));
      const labelsMap: Record<number, { id: number; name: string; color: string }[]> = {};

      if (itemIds.length > 0) {
        const placeholders = itemIds.map(() => '?').join(',');
        const labelsResult = await database.execute({
          sql: `
            SELECT il.item_id, l.id, l.name, l.color
            FROM content_item_labels il
            JOIN content_labels l ON il.label_id = l.id
            WHERE il.item_id IN (${placeholders})
          `,
          args: itemIds,
        });
        for (const row of labelsResult.rows) {
          const itemId = Number(row.item_id);
          if (!labelsMap[itemId]) labelsMap[itemId] = [];
          labelsMap[itemId].push({
            id: Number(row.id),
            name: String(row.name),
            color: String(row.color),
          });
        }
      }

      const items = result.rows.map((row) => ({
        id: Number(row.id),
        identifier: String(row.identifier),
        title: String(row.title),
        description: row.description ? String(row.description) : null,
        contentType: String(row.content_type),
        topic: row.topic ? String(row.topic) : null,
        angle: row.angle ? String(row.angle) : null,
        hook: row.hook ? String(row.hook) : null,
        script: row.script ? String(row.script) : null,
        imageUrls: row.image_urls ? String(row.image_urls) : null,
        state: String(row.state),
        priority: String(row.priority),
        projectId: row.project_id ? Number(row.project_id) : null,
        position: row.position ? Number(row.position) : 0,
        dueDate: row.due_date ? Number(row.due_date) : null,
        scheduledDate: row.scheduled_date ? Number(row.scheduled_date) : null,
        publishDate: row.publish_date ? Number(row.publish_date) : null,
        publishedUrl: row.published_url ? String(row.published_url) : null,
        createdBy: String(row.created_by),
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at),
        project: row.project_identifier
          ? { identifier: String(row.project_identifier), color: String(row.project_color) }
          : null,
        labels: labelsMap[Number(row.id)] || [],
      }));

      res.json({ items });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Create content item
  app.post('/api/content/items', async (req, res) => {
    try {
      const database = getDb();
      const { title, description, projectId, priority = 'medium', contentType = 'blogpost', topic, angle, hook } = req.body;

      if (!title) {
        res.status(400).json({ error: 'Title is required' });
        return;
      }

      // Generate identifier
      let identifier: string;
      if (projectId) {
        const projectResult = await database.execute({
          sql: 'SELECT identifier FROM content_projects WHERE id = ?',
          args: [projectId],
        });
        if (projectResult.rows.length === 0) {
          res.status(404).json({ error: 'Project not found' });
          return;
        }
        const projectIdentifier = String(projectResult.rows[0].identifier);
        const maxResult = await database.execute({
          sql: `SELECT COALESCE(MAX(CAST(SUBSTR(identifier, LENGTH(?) + 4) AS INTEGER)), 0) as max_num
                FROM content_items WHERE identifier LIKE ? || '-C%'`,
          args: [projectIdentifier, projectIdentifier],
        });
        const itemNumber = Number(maxResult.rows[0].max_num) + 1;
        identifier = `${projectIdentifier}-C${itemNumber}`;
      } else {
        const maxResult = await database.execute(
          "SELECT COALESCE(MAX(CAST(SUBSTR(identifier, 3) AS INTEGER)), 0) as max_num FROM content_items WHERE identifier LIKE 'C-%'"
        );
        const itemNumber = Number(maxResult.rows[0].max_num) + 1;
        identifier = `C-${itemNumber}`;
      }

      // Get max position in backlog
      const positionResult = await database.execute({
        sql: 'SELECT COALESCE(MAX(position), -1) as max_pos FROM content_items WHERE state = ?',
        args: ['backlog'],
      });
      const newPosition = Number(positionResult.rows[0].max_pos) + 1000;

      const now = Date.now();
      const result = await database.execute({
        sql: `
          INSERT INTO content_items (
            identifier, title, description, content_type, topic, angle, hook,
            state, priority, project_id, position, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          identifier, title, description || null, contentType,
          topic || null, angle || null, hook || null,
          'backlog', priority,
          projectId || null, newPosition, 'renier', now, now,
        ],
      });

      res.status(201).json({
        item: {
          id: Number(result.lastInsertRowid),
          identifier, title,
          description: description || null,
          contentType, state: 'backlog', priority,
          topic: topic || null, angle: angle || null, hook: hook || null,
          script: null, imageUrls: null,
          projectId: projectId || null,
          position: newPosition,
          dueDate: null, scheduledDate: null, publishDate: null, publishedUrl: null,
          createdBy: 'renier',
          createdAt: now, updatedAt: now,
          project: null,
          labels: [],
        },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Update content item
  app.patch('/api/content/items/:id', async (req, res) => {
    try {
      const database = getDb();
      const itemId = Number(req.params.id);
      const {
        state, priority, title, description, contentType, position,
        topic, angle, hook, script, imageUrls,
        dueDate, scheduledDate, publishDate, publishedUrl, projectId,
      } = req.body;

      const updates: string[] = [];
      const args: (string | number | null)[] = [];

      if (state !== undefined) { updates.push('state = ?'); args.push(state); }
      if (priority !== undefined) { updates.push('priority = ?'); args.push(priority); }
      if (title !== undefined) { updates.push('title = ?'); args.push(title); }
      if (description !== undefined) { updates.push('description = ?'); args.push(description); }
      if (contentType !== undefined) { updates.push('content_type = ?'); args.push(contentType); }
      if (position !== undefined) { updates.push('position = ?'); args.push(position); }
      if (topic !== undefined) { updates.push('topic = ?'); args.push(topic || null); }
      if (angle !== undefined) { updates.push('angle = ?'); args.push(angle || null); }
      if (hook !== undefined) { updates.push('hook = ?'); args.push(hook || null); }
      if (script !== undefined) { updates.push('script = ?'); args.push(script || null); }
      if (imageUrls !== undefined) { updates.push('image_urls = ?'); args.push(imageUrls || null); }
      if (dueDate !== undefined) { updates.push('due_date = ?'); args.push(dueDate ? Number(dueDate) : null); }
      if (scheduledDate !== undefined) { updates.push('scheduled_date = ?'); args.push(scheduledDate ? Number(scheduledDate) : null); }
      if (publishDate !== undefined) { updates.push('publish_date = ?'); args.push(publishDate ? Number(publishDate) : null); }
      if (publishedUrl !== undefined) { updates.push('published_url = ?'); args.push(publishedUrl || null); }
      if (projectId !== undefined) { updates.push('project_id = ?'); args.push(projectId ? Number(projectId) : null); }

      if (updates.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      updates.push('updated_at = ?');
      args.push(Date.now());
      args.push(itemId);

      await database.execute({
        sql: `UPDATE content_items SET ${updates.join(', ')} WHERE id = ?`,
        args,
      });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Update content item labels (replace all)
  app.put('/api/content/items/:id/labels', async (req, res) => {
    try {
      const database = getDb();
      const itemId = Number(req.params.id);
      const { labelIds } = req.body as { labelIds: number[] };

      if (!Array.isArray(labelIds)) {
        res.status(400).json({ error: 'labelIds must be an array' });
        return;
      }

      await database.execute({ sql: 'DELETE FROM content_item_labels WHERE item_id = ?', args: [itemId] });

      for (const labelId of labelIds) {
        await database.execute({
          sql: 'INSERT INTO content_item_labels (item_id, label_id) VALUES (?, ?)',
          args: [itemId, labelId],
        });
      }

      await database.execute({
        sql: 'UPDATE content_items SET updated_at = ? WHERE id = ?',
        args: [Date.now(), itemId],
      });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ==========================================
  // Portal Triage API
  // ==========================================

  // Get triage items
  app.get('/api/triage', async (req, res) => {
    try {
      const database = getDb();
      const { processed = 'false' } = req.query;

      let sql = 'SELECT * FROM portal_triage WHERE 1=1';
      const args: (string | number)[] = [];

      if (processed === 'false') {
        sql += ' AND processed = 0 AND (snoozed_until IS NULL OR snoozed_until <= ?)';
        args.push(Date.now());
      } else if (processed === 'true') {
        sql += ' AND (processed = 1 OR snoozed_until > ?)';
        args.push(Date.now());
      }

      sql += ' ORDER BY created_at DESC';

      const result = await database.execute({ sql, args });

      const items = result.rows.map((row) => ({
        id: Number(row.id),
        title: String(row.title),
        description: row.description ? String(row.description) : null,
        source: row.source ? String(row.source) : null,
        processed: Boolean(row.processed),
        issueId: row.issue_id ? Number(row.issue_id) : null,
        snoozedUntil: row.snoozed_until ? Number(row.snoozed_until) : null,
        labels: row.labels ? JSON.parse(String(row.labels)) : [],
        createdAt: Number(row.created_at),
      }));

      res.json({ items });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Create triage item
  app.post('/api/triage', async (req, res) => {
    try {
      const database = getDb();
      const { title, description, source = 'manual', labels = [] } = req.body;

      if (!title) {
        res.status(400).json({ error: 'Title is required' });
        return;
      }

      const now = Date.now();
      const labelsJson = JSON.stringify(labels);
      const result = await database.execute({
        sql: `
          INSERT INTO portal_triage (title, description, source, labels, processed, created_at)
          VALUES (?, ?, ?, ?, 0, ?)
        `,
        args: [title, description || null, source, labelsJson, now],
      });

      const newItem = {
        id: Number(result.lastInsertRowid),
        title,
        description: description || null,
        source,
        processed: false,
        issueId: null,
        snoozedUntil: null,
        labels,
        createdAt: now,
      };

      res.status(201).json({ item: newItem });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Convert triage item to issue
  app.post('/api/triage/:id/convert', async (req, res) => {
    try {
      const database = getDb();
      const triageId = Number(req.params.id);
      const { projectId, priority = 'medium', type = 'feature', cycleId } = req.body;

      if (!projectId) {
        res.status(400).json({ error: 'projectId is required' });
        return;
      }

      // Get triage item
      const triageResult = await database.execute({
        sql: 'SELECT * FROM portal_triage WHERE id = ?',
        args: [triageId],
      });

      if (triageResult.rows.length === 0) {
        res.status(404).json({ error: 'Triage item not found' });
        return;
      }

      const triageItem = triageResult.rows[0];

      // Get project identifier for generating issue number
      const projectResult = await database.execute({
        sql: 'SELECT identifier FROM portal_projects WHERE id = ?',
        args: [projectId],
      });

      if (projectResult.rows.length === 0) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const projectIdentifier = String(projectResult.rows[0].identifier);

      // Get next issue number by prefix (search ALL issues with this prefix, not just this project)
      const maxResult = await database.execute({
        sql: `SELECT COALESCE(MAX(CAST(SUBSTR(identifier, LENGTH(?) + 2) AS INTEGER)), 0) as max_num
              FROM portal_issues WHERE identifier LIKE ? || '-%'`,
        args: [projectIdentifier, projectIdentifier],
      });

      const issueNumber = Number(maxResult.rows[0].max_num) + 1;
      const identifier = `${projectIdentifier}-${issueNumber}`;

      // Get max position in backlog
      const positionResult = await database.execute({
        sql: 'SELECT COALESCE(MAX(position), -1) as max_pos FROM portal_issues WHERE state = ?',
        args: ['backlog'],
      });
      const newPosition = Number(positionResult.rows[0].max_pos) + 1000;

      // Create the issue
      const now = Date.now();
      const issueResult = await database.execute({
        sql: `
          INSERT INTO portal_issues (
            identifier, title, description, state, priority, type,
            project_id, cycle_id, position, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          identifier,
          triageItem.title,
          triageItem.description || null,
          'backlog',
          priority,
          type,
          projectId,
          cycleId || null,
          newPosition,
          'KITT',
          now,
          now,
        ],
      });

      const issueId = Number(issueResult.lastInsertRowid);

      // Mark triage item as processed and link to issue
      await database.execute({
        sql: 'UPDATE portal_triage SET processed = 1, issue_id = ? WHERE id = ?',
        args: [issueId, triageId],
      });

      res.json({ issueId, identifier });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Update triage item (snooze, archive)
  app.patch('/api/triage/:id', async (req, res) => {
    try {
      const database = getDb();
      const triageId = Number(req.params.id);
      const { processed, snoozedUntil } = req.body;

      const updates: string[] = [];
      const args: (string | number | null)[] = [];

      if (processed !== undefined) {
        updates.push('processed = ?');
        args.push(processed ? 1 : 0);
      }
      if (snoozedUntil !== undefined) {
        updates.push('snoozed_until = ?');
        args.push(snoozedUntil);
      }

      if (updates.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      args.push(triageId);

      await database.execute({
        sql: `UPDATE portal_triage SET ${updates.join(', ')} WHERE id = ?`,
        args,
      });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ==========================================
  // Integrations API (Nango)
  // ==========================================

  // List all integrations from DB with auth/connection status
  app.get('/api/integrations', async (_req, res) => {
    try {
      const db = getDb();

      // Get all integrations from registry
      const result = await db.execute(
        'SELECT id, name, description, icon, category, auth_type, provider, auth_config, enabled, sort_order FROM integrations WHERE enabled = 1 ORDER BY category, sort_order'
      );

      // Get Nango connections (for oauth integrations)
      let nangoConnections: Array<{ id: string; integrationId: string; createdAt: string }> = [];
      try {
        nangoConnections = await listConnections();
      } catch {
        // Nango might not be configured yet
      }

      // Get vault credentials (for api_key/token/credentials integrations)
      const { listCredentials } = await import('../credentials/index.js');
      const vaultEntries = await listCredentials();
      const vaultKeys = new Set(vaultEntries.map(e => e.key));

      const { getConfigValue } = await import('../integrations/config.js');

      const integrations = await Promise.all(result.rows.map(async (row) => {
        const authConfig = row.auth_config ? JSON.parse(row.auth_config as string) : {};
        const authType = row.auth_type as string;
        const provider = row.provider as string;
        const id = row.id as string;

        // Determine connected status based on auth_type
        let connected = false;
        let connection: { id: string; createdAt: string } | null = null;

        if (authType === 'oauth' && provider === 'nango') {
          const nangoId = authConfig.nango_id || id;
          const nangoConn = nangoConnections.find(c => c.integrationId === nangoId);
          connected = !!nangoConn;
          connection = nangoConn ? { id: nangoConn.id, createdAt: nangoConn.createdAt } : null;
        } else if (authType === 'api_key' || authType === 'token') {
          const credKey = authConfig.credential_key;
          connected = credKey ? (vaultKeys.has(credKey) || !!process.env[credKey]) : false;
        } else if (authType === 'oauth' && provider === 'direct') {
          // Direct OAuth (own framework): check if token_key is in vault
          const tokenKey = authConfig.token_key;
          connected = tokenKey ? vaultKeys.has(tokenKey) : false;
        } else if (authType === 'oauth' && provider === 'custom') {
          // Custom OAuth (Podbean, Google OAuth app): check if all credential_keys are set
          const keys: string[] = authConfig.credential_keys || [];
          connected = keys.length > 0 && keys.every(k => vaultKeys.has(k) || !!process.env[k]);
        } else if (authType === 'credentials') {
          // Username/password: check vault for integration-specific key
          const credKey = `${id.toUpperCase().replace(/-/g, '_')}_CREDENTIALS`;
          connected = vaultKeys.has(credKey);
        }

        // Load settings values from kitt_config for integrations with settings
        let settings_values: Record<string, string> | undefined;
        const settings = authConfig.settings as Array<{ key: string }> | undefined;
        if (settings?.length) {
          settings_values = {};
          for (const s of settings) {
            const val = await getConfigValue(s.key);
            if (val) settings_values[s.key] = val;
          }
        }

        return {
          id,
          name: row.name as string,
          description: row.description as string,
          icon: row.icon as string,
          category: row.category as string,
          auth_type: authType,
          provider,
          auth_config: authConfig,
          connected,
          connection,
          settings_values,
        };
      }));

      res.json({ integrations });
    } catch (err) {
      console.error('[integrations] Failed to list:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list integrations' });
    }
  });

  // Create Nango connect session for OAuth integrations
  app.post('/api/integrations/:id/connect', async (req, res) => {
    try {
      const integrationId = req.params.id;
      const db = getDb();

      // Look up integration in DB
      const result = await db.execute({
        sql: 'SELECT auth_type, provider, auth_config FROM integrations WHERE id = ?',
        args: [integrationId],
      });
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Integration not found' });
        return;
      }

      const row = result.rows[0];
      const authType = row.auth_type as string;
      const provider = row.provider as string;

      if (authType !== 'oauth') {
        res.status(400).json({ error: 'This integration does not use OAuth' });
        return;
      }

      if (provider === 'direct') {
        // Direct OAuth: build authorize URL using our own framework
        // Use config override (e.g. tunnel URL for HTTPS-only providers) or dynamic URI
        const oauthConfig = await getOAuthConfig(integrationId);
        const redirectUri = oauthConfig?.redirectUri || `${req.protocol}://${req.get('host')}/api/auth/callback`;
        const url = await buildAuthorizeUrl(integrationId, redirectUri);
        res.json({ url, provider: 'direct' });
        return;
      }

      if (provider !== 'nango') {
        res.status(400).json({ error: 'Unsupported OAuth provider' });
        return;
      }

      const authConfig = row.auth_config ? JSON.parse(row.auth_config as string) : {};
      const nangoId = authConfig.nango_id || integrationId;

      const session = await createConnectSession(nangoId);
      res.json({ token: session.token, expiresAt: session.expiresAt });
    } catch (err) {
      console.error('[integrations] Failed to create session:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create connect session' });
    }
  });

  // Generic OAuth callback — handles all provider="direct" integrations
  app.get('/api/auth/callback', async (req, res) => {
    try {
      const { state, code, error } = req.query as Record<string, string | undefined>;

      if (error) {
        console.error(`[oauth] Callback error: ${error}`);
        res.redirect(`/#/integrations?oauth_error=${encodeURIComponent(error)}`);
        return;
      }

      if (!state || !code) {
        res.redirect('/#/integrations?oauth_error=missing_params');
        return;
      }

      const integrationId = state;
      // Use config override (must match what was sent in authorize) or dynamic URI
      const oauthConfig = await getOAuthConfig(integrationId);
      const redirectUri = oauthConfig?.redirectUri || `${req.protocol}://${req.get('host')}/api/auth/callback`;

      console.log(`[oauth] Callback received for ${integrationId}`);
      const result = await exchangeCodeForTokens(integrationId, code, redirectUri);

      if (result.success) {
        console.log(`[oauth] ${integrationId} connected successfully`);
        res.redirect(`/#/integrations?oauth_success=${encodeURIComponent(integrationId)}`);
      } else {
        console.error(`[oauth] ${integrationId} connection failed: ${result.error}`);
        res.redirect(`/#/integrations?oauth_error=${encodeURIComponent(result.error || 'unknown')}`);
      }
    } catch (err) {
      console.error('[oauth] Callback error:', err);
      res.redirect(`/#/integrations?oauth_error=${encodeURIComponent(err instanceof Error ? err.message : 'callback_failed')}`);
    }
  });

  // Set auth for non-OAuth integrations (API key, token, credentials)
  app.post('/api/integrations/:id/auth', async (req, res) => {
    try {
      const integrationId = req.params.id;
      const db = getDb();

      const result = await db.execute({
        sql: 'SELECT auth_type, auth_config FROM integrations WHERE id = ?',
        args: [integrationId],
      });
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Integration not found' });
        return;
      }

      const row = result.rows[0];
      const authType = row.auth_type as string;
      const authConfig = row.auth_config ? JSON.parse(row.auth_config as string) : {};
      const { setCredential } = await import('../credentials/index.js');

      if (authType === 'api_key' || authType === 'token') {
        const { value } = req.body;
        if (!value) {
          res.status(400).json({ error: 'value is required' });
          return;
        }
        const credKey = authConfig.credential_key;
        if (!credKey) {
          res.status(500).json({ error: 'No credential_key configured for this integration' });
          return;
        }
        await setCredential(credKey, value, authType, `${integrationId} auth`);
        res.json({ success: true });

      } else if (authType === 'oauth' && authConfig.credential_keys) {
        // Custom OAuth with multiple keys (Podbean, Google OAuth)
        const { values } = req.body;
        if (!values || typeof values !== 'object') {
          res.status(400).json({ error: 'values object is required with keys: ' + (authConfig.credential_keys || []).join(', ') });
          return;
        }
        for (const key of authConfig.credential_keys) {
          if (values[key]) {
            await setCredential(key, values[key], 'oauth', `${integrationId} auth`);
          }
        }
        res.json({ success: true });

      } else if (authType === 'credentials') {
        const { username, password } = req.body;
        if (!username || !password) {
          res.status(400).json({ error: 'username and password are required' });
          return;
        }
        const credKey = `${integrationId.toUpperCase().replace(/-/g, '_')}_CREDENTIALS`;
        await setCredential(credKey, JSON.stringify({ username, password }), 'credentials', `${integrationId} login`);
        res.json({ success: true });

      } else {
        res.status(400).json({ error: `Auth type '${authType}' does not support manual auth. Use /connect for OAuth.` });
      }
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to set auth' });
    }
  });

  // Remove auth for an integration
  app.delete('/api/integrations/:id/auth', async (req, res) => {
    try {
      const integrationId = req.params.id;
      const db = getDb();

      const result = await db.execute({
        sql: 'SELECT auth_type, provider, auth_config FROM integrations WHERE id = ?',
        args: [integrationId],
      });
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Integration not found' });
        return;
      }

      const row = result.rows[0];
      const authType = row.auth_type as string;
      const provider = row.provider as string;
      const authConfig = row.auth_config ? JSON.parse(row.auth_config as string) : {};

      if (authType === 'oauth' && provider === 'direct') {
        await disconnectOAuth(integrationId);
      } else if (authType === 'oauth' && provider === 'nango') {
        const nangoId = authConfig.nango_id || integrationId;
        await deleteConnection(nangoId);
      } else if (authType === 'api_key' || authType === 'token') {
        const { deleteCredential } = await import('../credentials/index.js');
        const credKey = authConfig.credential_key;
        if (credKey) await deleteCredential(credKey);
      } else if (authType === 'oauth' && authConfig.credential_keys) {
        const { deleteCredential } = await import('../credentials/index.js');
        for (const key of authConfig.credential_keys) {
          await deleteCredential(key);
        }
      } else if (authType === 'credentials') {
        const { deleteCredential } = await import('../credentials/index.js');
        const credKey = `${integrationId.toUpperCase().replace(/-/g, '_')}_CREDENTIALS`;
        await deleteCredential(credKey);
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to remove auth' });
    }
  });

  // Test auth for an integration
  app.post('/api/integrations/:id/test', async (req, res) => {
    try {
      const integrationId = req.params.id;
      const db = getDb();

      const result = await db.execute({
        sql: 'SELECT auth_type, provider, auth_config FROM integrations WHERE id = ?',
        args: [integrationId],
      });
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Integration not found' });
        return;
      }

      const row = result.rows[0];
      const authType = row.auth_type as string;
      const provider = row.provider as string;
      const authConfig = row.auth_config ? JSON.parse(row.auth_config as string) : {};
      const { getCredential } = await import('../credentials/index.js');

      if (authType === 'oauth' && provider === 'direct') {
        // Direct OAuth: check token exists + run provider-specific test
        const connected = await isOAuthConnected(integrationId);
        if (!connected) {
          res.json({ success: false, error: 'Not connected' });
          return;
        }

        // Provider-specific tests
        if (integrationId === 'slack') {
          const slackResult = await testSlackConnection();
          res.json(slackResult);
          return;
        }
        if (integrationId === 'asana') {
          const { testAsanaConnection } = await import('../integrations/asana.js');
          const asanaResult = await testAsanaConnection();
          res.json(asanaResult);
          return;
        }
        if (integrationId === 'notion') {
          const { testNotionConnection } = await import('../integrations/notion.js');
          const notionResult = await testNotionConnection();
          res.json(notionResult);
          return;
        }

        // Generic: just check token exists
        res.json({ success: true });
      } else if (authType === 'oauth' && provider === 'nango') {
        const nangoId = authConfig.nango_id || integrationId;
        const connection = await getConnection(nangoId);
        res.json({ success: !!connection, provider: connection?.provider });
      } else if (authType === 'api_key' || authType === 'token') {
        const credKey = authConfig.credential_key;
        const value = credKey ? await getCredential(credKey) : null;
        if (!value) {
          res.json({ success: false, error: 'Not configured' });
        } else {
          res.json({
            success: true,
            configured: true,
          });
        }
      } else if (authType === 'oauth' && authConfig.credential_keys) {
        const keys: string[] = authConfig.credential_keys;
        const results: Record<string, boolean> = {};
        for (const key of keys) {
          results[key] = !!(await getCredential(key));
        }
        const allSet = Object.values(results).every(Boolean);
        res.json({ success: allSet, keys: results });
      } else if (authType === 'credentials') {
        const credKey = `${integrationId.toUpperCase().replace(/-/g, '_')}_CREDENTIALS`;
        const value = await getCredential(credKey);
        res.json({ success: !!value });
      } else {
        res.json({ success: false, error: 'Unknown auth type' });
      }
    } catch (err) {
      res.json({ success: false, error: err instanceof Error ? err.message : 'Test failed' });
    }
  });

  // Disconnect Nango OAuth integration (legacy compat alias)
  app.delete('/api/integrations/:id/disconnect', async (req, res) => {
    try {
      const integrationId = req.params.id;
      const connection = await getConnection(integrationId);
      if (!connection) {
        res.status(404).json({ error: 'Not connected' });
        return;
      }
      await deleteConnection(integrationId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to disconnect' });
    }
  });

  // Get connection details
  app.get('/api/integrations/:id/status', async (req, res) => {
    try {
      const integrationId = req.params.id;
      const connection = await getConnection(integrationId);
      if (!connection) {
        res.json({ connected: false });
        return;
      }
      res.json({ connected: true, provider: connection.provider });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to get status' });
    }
  });

  // Migrate .env secrets to vault under their integration credential keys
  app.post('/api/integrations/migrate', async (_req, res) => {
    try {
      const { migrateFromEnv } = await import('../credentials/index.js');
      const result = await migrateFromEnv();
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Migration failed' });
    }
  });

  // ============================================================
  // Multi-Account Connection Endpoints
  // ============================================================

  // Get all local connections for an integration (with labels)
  app.get('/api/integrations/:id/connections', async (req, res) => {
    try {
      const integrationId = req.params.id;
      const connections = await getLocalConnections(integrationId);
      res.json({ connections });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to get connections' });
    }
  });

  // Register a connection after OAuth (with label)
  app.post('/api/integrations/:id/register', async (req, res) => {
    try {
      const integrationId = req.params.id;
      const { connectionId, label, accountEmail, isDefault } = req.body;

      if (!connectionId || !label) {
        res.status(400).json({ error: 'connectionId and label are required' });
        return;
      }

      await registerConnection(integrationId, connectionId, label, accountEmail, isDefault);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to register connection' });
    }
  });

  // Set a connection as default
  app.post('/api/integrations/:id/connections/:connectionId/default', async (req, res) => {
    try {
      const { id: integrationId, connectionId } = req.params;
      await setDefaultConnection(integrationId, connectionId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to set default' });
    }
  });

  // ============================================================
  // Config Endpoints
  // ============================================================

  // Get all config values
  app.get('/api/config', async (_req, res) => {
    try {
      const config = await getAllConfig();
      res.json({ config });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to get config' });
    }
  });

  // Update a config value
  app.post('/api/config', async (req, res) => {
    try {
      const { key, value, description } = req.body;

      if (!key || value === undefined) {
        res.status(400).json({ error: 'key and value are required' });
        return;
      }

      await setConfigValue(key, value, description);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update config' });
    }
  });

  // (Credential endpoints removed — auth is now managed via /api/integrations/:id/auth)

  // ============================================================
  // Channel Endpoints (WhatsApp)
  // ============================================================

  // Get WhatsApp status (including QR code for Portal UI)
  app.get('/api/channels/whatsapp/status', (_req, res) => {
    try {
      const router = getRouter();
      const adapter = router.getAdapter('whatsapp') as WhatsAppAdapter | undefined;

      if (!adapter) {
        return res.json({
          enabled: process.env.WHATSAPP_ENABLED === 'true',
          connected: false,
          status: 'disabled',
        });
      }

      const status = adapter.getStatus();
      const qrData = adapter.getQrCode();

      // Determine status string
      let statusString = 'disconnected';
      if (status.connected) {
        statusString = 'connected';
      } else if (qrData) {
        statusString = 'awaiting_scan';
      }

      res.json({
        enabled: true,
        connected: status.connected,
        status: statusString,
        user: status.details || null,
        qrCode: qrData?.qr || null,
        qrCodeGeneratedAt: qrData?.generatedAt || null,
        lastError: status.lastError || null,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to get WhatsApp status' });
    }
  });

  // Disconnect WhatsApp and clear auth
  app.post('/api/channels/whatsapp/disconnect', async (req, res) => {
    try {
      const router = getRouter();
      const adapter = router.getAdapter('whatsapp');

      if (adapter) {
        await adapter.stop();
      }

      // Clear auth state directory
      const authDir = process.env.WHATSAPP_AUTH_DIR || './data/whatsapp-auth';
      if (fs.existsSync(authDir)) {
        fs.rmSync(authDir, { recursive: true, force: true });
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to disconnect WhatsApp' });
    }
  });

  // Get WhatsApp allowed numbers
  app.get('/api/channels/whatsapp/allowed-numbers', async (_req, res) => {
    try {
      const { getMetaValue } = await import('../capabilities/index.js');
      const value = await getMetaValue('whatsapp_allowed_numbers');
      const numbers = value ? JSON.parse(value) : [];
      res.json({ numbers });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to get allowed numbers' });
    }
  });

  // Set WhatsApp allowed numbers
  app.post('/api/channels/whatsapp/allowed-numbers', async (req, res) => {
    try {
      const { numbers } = req.body;

      if (!Array.isArray(numbers)) {
        res.status(400).json({ error: 'numbers must be an array' });
        return;
      }

      // Validate and clean numbers (remove non-digits except +)
      const cleanNumbers = numbers
        .map((n: string) => String(n).replace(/[^\d+]/g, ''))
        .filter((n: string) => n.length >= 8); // At least 8 digits

      const { setMetaValue } = await import('../capabilities/index.js');
      await setMetaValue('whatsapp_allowed_numbers', JSON.stringify(cleanNumbers));

      res.json({ success: true, numbers: cleanNumbers });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to set allowed numbers' });
    }
  });

  // Add a number to WhatsApp allowlist
  app.post('/api/channels/whatsapp/allowed-numbers/add', async (req, res) => {
    try {
      const { number } = req.body;

      if (!number || typeof number !== 'string') {
        res.status(400).json({ error: 'number is required' });
        return;
      }

      const cleanNumber = number.replace(/[^\d+]/g, '');
      if (cleanNumber.length < 8) {
        res.status(400).json({ error: 'Invalid phone number' });
        return;
      }

      const { getMetaValue, setMetaValue } = await import('../capabilities/index.js');
      const value = await getMetaValue('whatsapp_allowed_numbers');
      const numbers: string[] = value ? JSON.parse(value) : [];

      if (!numbers.includes(cleanNumber)) {
        numbers.push(cleanNumber);
        await setMetaValue('whatsapp_allowed_numbers', JSON.stringify(numbers));
      }

      res.json({ success: true, numbers });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to add number' });
    }
  });

  // Remove a number from WhatsApp allowlist
  app.delete('/api/channels/whatsapp/allowed-numbers/:number', async (req, res) => {
    try {
      const { number } = req.params;

      const { getMetaValue, setMetaValue } = await import('../capabilities/index.js');
      const value = await getMetaValue('whatsapp_allowed_numbers');
      const numbers: string[] = value ? JSON.parse(value) : [];

      const cleanNumber = number.replace(/[^\d+]/g, '');
      const newNumbers = numbers.filter((n) => n !== cleanNumber);

      await setMetaValue('whatsapp_allowed_numbers', JSON.stringify(newNumbers));

      res.json({ success: true, numbers: newNumbers });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to remove number' });
    }
  });

  // Get seen WhatsApp contacts (people who messaged but aren't in allowlist)
  app.get('/api/channels/whatsapp/seen-contacts', async (_req, res) => {
    try {
      // Get connected user's name to filter out own outgoing messages
      const router = getRouter();
      const adapter = router.getAdapter('whatsapp') as WhatsAppAdapter | undefined;
      const details = adapter?.getStatus()?.details as { name?: string } | undefined;
      const connectedName: string | null = details?.name ?? null;

      const db = getDb();
      const result = await db.execute({
        sql: `
          WITH filtered AS (
            SELECT
              COALESCE(json_extract(metadata, '$.fromNumber'), REPLACE(session_id, 'whatsapp:', '')) as identifier,
              json_extract(metadata, '$.displayName') as displayName,
              created_at
            FROM transcripts
            WHERE channel = 'whatsapp'
              AND role = 'user'
              AND json_extract(metadata, '$.readOnly') = 1
              AND COALESCE(json_extract(metadata, '$.fromMe'), 0) != 1
              AND ($1 IS NULL OR json_extract(metadata, '$.displayName') != $1)
              AND session_id NOT LIKE '%@g.us'
          )
          SELECT
            identifier,
            -- Pick displayName from most recent message
            (SELECT f2.displayName FROM filtered f2 WHERE f2.identifier = f.identifier ORDER BY f2.created_at DESC LIMIT 1) as displayName,
            COUNT(*) as messageCount,
            MAX(created_at) as lastMessageAt
          FROM filtered f
          GROUP BY identifier
          ORDER BY lastMessageAt DESC
        `,
        args: [connectedName],
      });

      const contacts = result.rows.map((row) => ({
        identifier: String(row.identifier),
        displayName: row.displayName ? String(row.displayName) : null,
        messageCount: Number(row.messageCount),
        lastMessageAt: Number(row.lastMessageAt),
      }));

      res.json({ contacts });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to get seen contacts' });
    }
  });

  // ==========================================
  // Slack allowed users API
  // ==========================================

  // Get Slack allowed users config
  // Format: { "U12345": "respond", "U67890": "read-only" }
  app.get('/api/channels/slack/allowed-users', async (_req, res) => {
    try {
      const { getMetaValue } = await import('../capabilities/index.js');
      const value = await getMetaValue('slack_allowed_users');
      const users: Record<string, string> = value ? JSON.parse(value) : {};
      res.json({ users });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to get allowed users' });
    }
  });

  // Set Slack allowed users config (full replace)
  app.put('/api/channels/slack/allowed-users', async (req, res) => {
    try {
      const { users } = req.body;

      if (users !== null && typeof users !== 'object') {
        res.status(400).json({ error: 'users must be an object or null' });
        return;
      }

      const { setMetaValue } = await import('../capabilities/index.js');

      if (users === null || Object.keys(users).length === 0) {
        // Clear config = allow all (backwards compatible)
        await setMetaValue('slack_allowed_users', '');
      } else {
        await setMetaValue('slack_allowed_users', JSON.stringify(users));
      }

      res.json({ success: true, users: users || {} });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to set allowed users' });
    }
  });

  // Add or update a single Slack user's permission
  app.post('/api/channels/slack/allowed-users/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { permission } = req.body;

      if (!['respond', 'read-only', 'blocked'].includes(permission)) {
        res.status(400).json({ error: 'permission must be "respond", "read-only", or "blocked"' });
        return;
      }

      const { getMetaValue, setMetaValue } = await import('../capabilities/index.js');
      const value = await getMetaValue('slack_allowed_users');
      const users: Record<string, string> = value ? JSON.parse(value) : {};

      users[userId] = permission;
      await setMetaValue('slack_allowed_users', JSON.stringify(users));

      res.json({ success: true, users });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update user permission' });
    }
  });

  // Remove a user from Slack allowlist
  app.delete('/api/channels/slack/allowed-users/:userId', async (req, res) => {
    try {
      const { userId } = req.params;

      const { getMetaValue, setMetaValue } = await import('../capabilities/index.js');
      const value = await getMetaValue('slack_allowed_users');
      const users: Record<string, string> = value ? JSON.parse(value) : {};

      delete users[userId];
      await setMetaValue('slack_allowed_users', JSON.stringify(users));

      res.json({ success: true, users });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to remove user' });
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
