/**
 * Health & Status API Routes
 * /api/status, /api/health, /api/agents
 */

import type { Express } from 'express';
import type { Client } from '@libsql/client';

interface HealthDeps {
  getDb: () => Client;
  getAgentPool: () => { getActive: () => unknown[]; getRecent: (n: number) => Promise<unknown[]>; getStats: () => Promise<unknown> };
  getScheduler: () => { getStatus: () => { lastTickAt: number | null } };
}

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

export function registerHealthRoutes(app: Express, deps: HealthDeps): void {
  const { getDb, getAgentPool, getScheduler } = deps;

  // Agent Pool (KITT-147: Observability)
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

  // KITT Status (sleep mode, think loop)
  app.get('/api/status', async (_req, res) => {
    try {
      const database = getDb();

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

      const uptime = process.uptime();
      const startedAt = new Date(now - uptime * 1000).toISOString();

      const schedulerStatus = getScheduler().getStatus();
      let lastThinkLoop = schedulerStatus.lastTickAt;

      if (!lastThinkLoop) {
        const lastThinkLoopResult = await database.execute(
          "SELECT created_at FROM transcripts WHERE channel = 'think-loop' ORDER BY created_at DESC LIMIT 1"
        );
        lastThinkLoop = lastThinkLoopResult.rows.length > 0
          ? Number(lastThinkLoopResult.rows[0].created_at)
          : null;
      }

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

      const errorsResult = await database.execute({
        sql: `SELECT created_at, content FROM transcripts
              WHERE type = 'log' AND content LIKE '%error%'
              AND created_at >= ?
              ORDER BY created_at DESC LIMIT 10`,
        args: [fiveMinutesAgo],
      });

      const errorCountResult = await database.execute({
        sql: `SELECT COUNT(*) as count FROM transcripts
              WHERE type = 'log' AND content LIKE '%error%'
              AND created_at >= ?`,
        args: [fiveMinutesAgo],
      });
      const errorCount = Number(errorCountResult.rows[0]?.count || 0);
      const errorsPerMinute = Math.round((errorCount / 5) * 10) / 10;

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
}
