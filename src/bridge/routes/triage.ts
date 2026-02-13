/**
 * Portal Triage API Routes
 * /api/triage, /api/triage/:id, /api/triage/:id/convert
 */

import type { Express } from 'express';
import type { Client } from '@libsql/client';

interface TriageDeps {
  getDb: () => Client;
}

export function registerTriageRoutes(app: Express, deps: TriageDeps): void {
  const { getDb } = deps;

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

      res.status(201).json({
        item: {
          id: Number(result.lastInsertRowid),
          title,
          description: description || null,
          source,
          processed: false,
          issueId: null,
          snoozedUntil: null,
          labels,
          createdAt: now,
        },
      });
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

      const triageResult = await database.execute({
        sql: 'SELECT * FROM portal_triage WHERE id = ?',
        args: [triageId],
      });

      if (triageResult.rows.length === 0) {
        res.status(404).json({ error: 'Triage item not found' });
        return;
      }

      const triageItem = triageResult.rows[0];

      const projectResult = await database.execute({
        sql: 'SELECT identifier FROM portal_projects WHERE id = ?',
        args: [projectId],
      });

      if (projectResult.rows.length === 0) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const projectIdentifier = String(projectResult.rows[0].identifier);

      const maxResult = await database.execute({
        sql: `SELECT COALESCE(MAX(CAST(SUBSTR(identifier, LENGTH(?) + 2) AS INTEGER)), 0) as max_num
              FROM portal_issues WHERE identifier LIKE ? || '-%'`,
        args: [projectIdentifier, projectIdentifier],
      });

      const issueNumber = Number(maxResult.rows[0].max_num) + 1;
      const identifier = `${projectIdentifier}-${issueNumber}`;

      const positionResult = await database.execute({
        sql: 'SELECT COALESCE(MAX(position), -1) as max_pos FROM portal_issues WHERE state = ?',
        args: ['backlog'],
      });
      const newPosition = Number(positionResult.rows[0].max_pos) + 1000;

      const now = Date.now();
      const issueResult = await database.execute({
        sql: `
          INSERT INTO portal_issues (
            identifier, title, description, state, priority, type,
            project_id, cycle_id, position, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          identifier, triageItem.title, triageItem.description || null,
          'backlog', priority, type, projectId, cycleId || null,
          newPosition, 'KITT', now, now,
        ],
      });

      const issueId = Number(issueResult.lastInsertRowid);

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
}
