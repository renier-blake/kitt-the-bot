/**
 * Portal Issues & Projects API Routes
 * /api/projects, /api/cycles, /api/labels, /api/issues, /api/issues/:id
 */

import type { Express } from 'express';
import type { Client } from '@libsql/client';

interface IssuesDeps {
  getDb: () => Client;
}

export function registerIssuesRoutes(app: Express, deps: IssuesDeps): void {
  const { getDb } = deps;

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
          i.id, i.identifier, i.title, i.description,
          i.state, i.priority, i.type, i.complexity, i.scope,
          i.project_id, i.cycle_id, i.parent_id, i.position,
          i.due_date, i.scheduled_date,
          i.scheduled_time_start, i.scheduled_time_end, i.scheduled_timezone,
          i.start_date, i.created_by, i.created_at, i.updated_at,
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

      if (project) { sql += ' AND i.project_id = ?'; args.push(Number(project)); }
      if (cycle) { sql += ' AND i.cycle_id = ?'; args.push(Number(cycle)); }
      if (state) { sql += ' AND i.state = ?'; args.push(String(state)); }
      if (priority) { sql += ' AND i.priority = ?'; args.push(String(priority)); }
      if (complexity) { sql += ' AND i.complexity = ?'; args.push(String(complexity)); }
      if (scope) { sql += ' AND i.scope = ?'; args.push(String(scope)); }
      if (parentId) { sql += ' AND i.parent_id = ?'; args.push(Number(parentId)); }
      if (topLevel === 'true') { sql += ' AND i.parent_id IS NULL'; }
      if (search) {
        sql += ' AND (i.title LIKE ? OR i.description LIKE ?)';
        const searchTerm = `%${search}%`;
        args.push(searchTerm, searchTerm);
      }
      if (labels) {
        const labelIds = Array.isArray(labels) ? labels.map(Number) : [Number(labels)];
        const placeholders = labelIds.map(() => '?').join(',');
        sql += ` AND EXISTS (
          SELECT 1 FROM portal_issue_labels il
          WHERE il.issue_id = i.id AND il.label_id IN (${placeholders})
        )`;
        args.push(...labelIds);
      }

      sql += ' ORDER BY i.state, i.position ASC, i.created_at ASC';

      const result = await database.execute({ sql, args });

      // Get labels for all issues (batch)
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
      const result = await database.execute({
        sql: `
          INSERT INTO portal_issues (
            identifier, title, description, state, priority, type,
            project_id, cycle_id, parent_id, position, created_by, created_at, updated_at,
            scheduled_date, scheduled_time_start, scheduled_time_end, scheduled_timezone, due_date, start_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          identifier, title, description || null, 'backlog', priority, type,
          projectId, cycleId || null, parentId || null, newPosition, 'KITT', now, now,
          null, null, null, 'Europe/Amsterdam', null, null,
        ],
      });

      res.status(201).json({
        issue: {
          id: Number(result.lastInsertRowid),
          identifier, title,
          description: description || null,
          state: 'backlog', priority, type,
          projectId, cycleId: cycleId || null,
          parentId: parentId || null, childCount: 0,
          createdBy: 'KITT', createdAt: now, updatedAt: now,
          labels: [],
        },
      });
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

      if (state !== undefined) { updates.push('state = ?'); args.push(state); }
      if (priority !== undefined) { updates.push('priority = ?'); args.push(priority); }
      if (title !== undefined) { updates.push('title = ?'); args.push(title); }
      if (description !== undefined) { updates.push('description = ?'); args.push(description); }
      if (cycleId !== undefined) { updates.push('cycle_id = ?'); args.push(cycleId); }
      if (position !== undefined) { updates.push('position = ?'); args.push(position); }
      if (complexity !== undefined) { updates.push('complexity = ?'); args.push(complexity); }
      if (scope !== undefined) { updates.push('scope = ?'); args.push(scope); }
      if (dueDate !== undefined) { updates.push('due_date = ?'); args.push(dueDate ? Number(dueDate) : null); }
      if (scheduledDate !== undefined) { updates.push('scheduled_date = ?'); args.push(scheduledDate ? Number(scheduledDate) : null); }
      if (scheduledTimeStart !== undefined) { updates.push('scheduled_time_start = ?'); args.push(scheduledTimeStart ? Number(scheduledTimeStart) : null); }
      if (scheduledTimeEnd !== undefined) { updates.push('scheduled_time_end = ?'); args.push(scheduledTimeEnd ? Number(scheduledTimeEnd) : null); }
      if (scheduledTimezone !== undefined) { updates.push('scheduled_timezone = ?'); args.push(scheduledTimezone || null); }
      if (startDate !== undefined) { updates.push('start_date = ?'); args.push(startDate ? Number(startDate) : null); }
      if (parentId !== undefined) { updates.push('parent_id = ?'); args.push(parentId ? Number(parentId) : null); }
      if (projectId !== undefined) { updates.push('project_id = ?'); args.push(Number(projectId)); }

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

  // Update issue labels (replace all)
  app.put('/api/issues/:id/labels', async (req, res) => {
    try {
      const database = getDb();
      const issueId = Number(req.params.id);
      const { labelIds } = req.body as { labelIds: number[] };

      if (!Array.isArray(labelIds)) {
        res.status(400).json({ error: 'labelIds must be an array' });
        return;
      }

      await database.execute({
        sql: 'DELETE FROM portal_issue_labels WHERE issue_id = ?',
        args: [issueId],
      });

      if (labelIds.length > 0) {
        const values = labelIds.map(() => '(?, ?)').join(', ');
        const args = labelIds.flatMap(id => [issueId, id]);
        await database.execute({
          sql: `INSERT INTO portal_issue_labels (issue_id, label_id) VALUES ${values}`,
          args,
        });
      }

      await database.execute({
        sql: 'UPDATE portal_issues SET updated_at = ? WHERE id = ?',
        args: [Date.now(), issueId],
      });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });
}
