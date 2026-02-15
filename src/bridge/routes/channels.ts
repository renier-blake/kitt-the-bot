/**
 * Channel Management API Routes
 * /api/channels/whatsapp/*, /api/channels/slack/*
 */

import type { Express } from 'express';
import type { Client } from '@libsql/client';
import * as fs from 'fs';
import type { WhatsAppAdapter } from '../adapters/whatsapp.js';
import type { SlackAdapter } from '../adapters/slack.js';
import type { MessageRouter } from '../router.js';

interface ChannelsDeps {
  getDb: () => Client;
  getRouter: () => MessageRouter;
}

export function registerChannelsRoutes(app: Express, deps: ChannelsDeps): void {
  const { getDb, getRouter } = deps;

  // WhatsApp status
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

  // WhatsApp disconnect
  app.post('/api/channels/whatsapp/disconnect', async (req, res) => {
    try {
      const router = getRouter();
      const adapter = router.getAdapter('whatsapp');

      if (adapter) {
        await adapter.stop();
      }

      const authDir = process.env.WHATSAPP_AUTH_DIR || './data/whatsapp-auth';
      if (fs.existsSync(authDir)) {
        fs.rmSync(authDir, { recursive: true, force: true });
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to disconnect WhatsApp' });
    }
  });

  // WhatsApp allowed numbers: get
  app.get('/api/channels/whatsapp/allowed-numbers', async (_req, res) => {
    try {
      const { getMetaValue } = await import('../../capabilities/index.js');
      const value = await getMetaValue('whatsapp_allowed_numbers');
      const numbers = value ? JSON.parse(value) : [];
      res.json({ numbers });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to get allowed numbers' });
    }
  });

  // WhatsApp allowed numbers: set
  app.post('/api/channels/whatsapp/allowed-numbers', async (req, res) => {
    try {
      const { numbers } = req.body;

      if (!Array.isArray(numbers)) {
        res.status(400).json({ error: 'numbers must be an array' });
        return;
      }

      const cleanNumbers = numbers
        .map((n: string) => String(n).replace(/[^\d+]/g, ''))
        .filter((n: string) => n.length >= 8);

      const { setMetaValue } = await import('../../capabilities/index.js');
      await setMetaValue('whatsapp_allowed_numbers', JSON.stringify(cleanNumbers));

      res.json({ success: true, numbers: cleanNumbers });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to set allowed numbers' });
    }
  });

  // WhatsApp allowed numbers: add single
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

      const { getMetaValue, setMetaValue } = await import('../../capabilities/index.js');
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

  // WhatsApp allowed numbers: remove
  app.delete('/api/channels/whatsapp/allowed-numbers/:number', async (req, res) => {
    try {
      const { number } = req.params;

      const { getMetaValue, setMetaValue } = await import('../../capabilities/index.js');
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

  // WhatsApp seen contacts
  app.get('/api/channels/whatsapp/seen-contacts', async (_req, res) => {
    try {
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
  // Slack Permissions API (channel & user matrix)
  // ==========================================

  // Get full permission matrix
  app.get('/api/channels/slack/permissions', async (req, res) => {
    try {
      const { getAllPermissions } = await import('../adapters/slack-permissions.js');
      const adapter = (req.query.adapter as string) || 'slack';
      if (adapter !== 'slack' && adapter !== 'slack-bot') {
        res.status(400).json({ error: 'adapter must be "slack" or "slack-bot"' });
        return;
      }
      const matrix = await getAllPermissions(adapter);
      res.json(matrix);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to get permissions' });
    }
  });

  // Upsert a permission rule
  app.put('/api/channels/slack/permissions', async (req, res) => {
    try {
      const { upsertPermission } = await import('../adapters/slack-permissions.js');
      const { adapter = 'slack', channelId = '', userId = '', permission } = req.body;

      if (adapter !== 'slack' && adapter !== 'slack-bot') {
        res.status(400).json({ error: 'adapter must be "slack" or "slack-bot"' });
        return;
      }
      if (!['respond', 'read-only', 'blocked'].includes(permission)) {
        res.status(400).json({ error: 'permission must be "respond", "read-only", or "blocked"' });
        return;
      }

      await upsertPermission(adapter, channelId, userId, permission);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to upsert permission' });
    }
  });

  // Delete a permission rule
  app.delete('/api/channels/slack/permissions', async (req, res) => {
    try {
      const { deletePermission } = await import('../adapters/slack-permissions.js');
      const { adapter = 'slack', channelId = '', userId = '' } = req.body;

      if (adapter !== 'slack' && adapter !== 'slack-bot') {
        res.status(400).json({ error: 'adapter must be "slack" or "slack-bot"' });
        return;
      }

      await deletePermission(adapter, channelId, userId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete permission' });
    }
  });

  // --- Backwards-compatible legacy endpoints ---

  app.get('/api/channels/slack/allowed-users', async (_req, res) => {
    try {
      const { getAllPermissions } = await import('../adapters/slack-permissions.js');
      const matrix = await getAllPermissions('slack');
      const users: Record<string, string> = {};
      for (const u of matrix.users) { users[u.userId] = u.permission; }
      res.json({ users });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to get allowed users' });
    }
  });

  app.post('/api/channels/slack/allowed-users/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { permission } = req.body;

      if (!['respond', 'read-only', 'blocked'].includes(permission)) {
        res.status(400).json({ error: 'permission must be "respond", "read-only", or "blocked"' });
        return;
      }

      const { upsertPermission, getAllPermissions } = await import('../adapters/slack-permissions.js');
      await upsertPermission('slack', '', userId, permission);
      const matrix = await getAllPermissions('slack');
      const users: Record<string, string> = {};
      for (const u of matrix.users) { users[u.userId] = u.permission; }
      res.json({ success: true, users });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update user permission' });
    }
  });

  app.delete('/api/channels/slack/allowed-users/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { deletePermission, getAllPermissions } = await import('../adapters/slack-permissions.js');
      await deletePermission('slack', '', userId);
      const matrix = await getAllPermissions('slack');
      const users: Record<string, string> = {};
      for (const u of matrix.users) { users[u.userId] = u.permission; }
      res.json({ success: true, users });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to remove user' });
    }
  });

  // Slack seen users & channels (auto-discovered from transcripts)
  app.get('/api/channels/slack/seen', async (_req, res) => {
    try {
      const db = getDb();

      // Get unique users seen in Slack transcripts
      const usersResult = await db.execute({
        sql: `
          SELECT
            json_extract(metadata, '$.userId') as userId,
            json_extract(metadata, '$.displayName') as displayName,
            COUNT(*) as messageCount,
            MAX(created_at) as lastMessageAt
          FROM transcripts
          WHERE channel = 'slack'
            AND role = 'user'
            AND json_extract(metadata, '$.userId') IS NOT NULL
          GROUP BY json_extract(metadata, '$.userId')
          ORDER BY lastMessageAt DESC
        `,
        args: [],
      });

      const users = usersResult.rows
        .filter(row => row.userId)
        .map(row => ({
          userId: String(row.userId),
          displayName: row.displayName ? String(row.displayName) : String(row.userId),
          messageCount: Number(row.messageCount),
          lastMessageAt: Number(row.lastMessageAt),
        }));

      // Get unique channels seen in Slack transcripts
      const channelsResult = await db.execute({
        sql: `
          SELECT
            REPLACE(session_id, 'slack:', '') as channelId,
            json_extract(metadata, '$.isDM') as isDM,
            COUNT(*) as messageCount,
            MAX(created_at) as lastMessageAt
          FROM transcripts
          WHERE channel = 'slack'
            AND session_id LIKE 'slack:%'
          GROUP BY session_id
          ORDER BY lastMessageAt DESC
        `,
        args: [],
      });

      const rawChannels = channelsResult.rows.map(row => ({
        channelId: String(row.channelId),
        isDM: Number(row.isDM) === 1,
        messageCount: Number(row.messageCount),
        lastMessageAt: Number(row.lastMessageAt),
      }));

      // Resolve channel names via Slack API
      const router = getRouter();
      const slackAdapter = router.getAdapter('slack') as SlackAdapter | undefined;
      const channels = await Promise.all(
        rawChannels.map(async (ch) => {
          let channelName: string | null = null;
          if (slackAdapter?.isConnected()) {
            channelName = await slackAdapter.getChannelName(ch.channelId);
          }
          return { ...ch, channelName };
        })
      );

      res.json({ users, channels });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to get seen Slack contacts' });
    }
  });
}
