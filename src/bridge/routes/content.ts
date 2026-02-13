/**
 * Content Calendar API Routes
 * /api/content/projects, /api/content/labels, /api/content/items
 */

import type { Express } from 'express';
import type { Client } from '@libsql/client';

interface ContentDeps {
  getDb: () => Client;
}

export function registerContentRoutes(app: Express, deps: ContentDeps): void {
  const { getDb } = deps;

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

      // Get labels for all items (batch)
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

      if (labelIds.length > 0) {
        const values = labelIds.map(() => '(?, ?)').join(', ');
        const args = labelIds.flatMap(id => [itemId, id]);
        await database.execute({
          sql: `INSERT INTO content_item_labels (item_id, label_id) VALUES ${values}`,
          args,
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
}
