/**
 * Task Engine API Routes
 * /api/tasks, /api/tasks/:id, /api/task-executions, /api/tasks/stats
 */

import type { Express } from 'express';
import type { Client } from '@libsql/client';

interface TaskDeps {
  getDb: () => Client;
}

export function registerTaskRoutes(app: Express, deps: TaskDeps): void {
  const { getDb } = deps;

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
          startTime = now - 24 * 60 * 60 * 1000;
      }

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
}
