/**
 * Database API Routes
 * /api/db/tables, /api/db/stats, /api/db/table/:table, /api/db/query
 */

import type { Express } from 'express';
import type { Client } from '@libsql/client';

interface DbDeps {
  getDb: () => Client;
  dbPath: string;
}

export function registerDbRoutes(app: Express, deps: DbDeps): void {
  const { getDb, dbPath } = deps;

  // Tables list
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

  // Stats
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
        path: dbPath,
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

  // Table data with pagination, search, period filter
  app.get('/api/db/table/:table', async (req, res) => {
    try {
      const database = getDb();
      const table = req.params.table;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = (page - 1) * limit;
      const search = (req.query.search as string) || '';
      const period = (req.query.period as string) || 'all';

      const allowedTables = ['transcripts', 'chunks', 'kitt_tasks', 'foods', 'food_log', 'meta'];
      if (!allowedTables.includes(table)) {
        return res.status(400).json({ error: 'Invalid table name' });
      }

      const whereConditions: string[] = [];
      const args: (string | number)[] = [];

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

      if (search) {
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

      const countQuery = `SELECT COUNT(*) as count FROM ${table} ${whereClause}`;
      const countResult = await database.execute({ sql: countQuery, args });
      const total = Number(countResult.rows[0].count);

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

  // Custom query (read-only)
  app.get('/api/db/query', async (req, res) => {
    try {
      const database = getDb();
      const sql = req.query.sql as string;

      if (!sql) {
        return res.status(400).json({ error: 'Missing sql parameter' });
      }

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
}
