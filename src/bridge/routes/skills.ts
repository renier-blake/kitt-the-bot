/**
 * Skills Registry API Routes
 * /api/skills, /api/skills/:id, /api/skills/:id/content
 */

import type { Express } from 'express';
import type { Client } from '@libsql/client';
import * as fs from 'fs';
import path from 'path';

interface SkillsDeps {
  getDb: () => Client;
}

export function registerSkillsRoutes(app: Express, deps: SkillsDeps): void {
  const { getDb } = deps;

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
      const stripped = content.replace(/^---\n[\s\S]*?\n---\n*/, '').trim();

      res.json({ content: stripped, raw: content });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });
}
