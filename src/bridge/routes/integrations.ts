/**
 * Integrations API Routes
 * /api/integrations, /api/auth/callback, /api/config
 */

import type { Express } from 'express';
import type { Client } from '@libsql/client';
import {
  listConnections,
  createConnectSession,
  deleteConnection,
  getConnection,
  registerConnection,
  getDefaultConnection,
} from '../../integrations/nango.js';
import {
  getAllConfig,
  setConfigValue,
  getConnections as getLocalConnections,
  setDefaultConnection,
} from '../../integrations/config.js';
import {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  getOAuthConfig,
  isOAuthConnected,
  disconnectOAuth,
} from '../../integrations/oauth.js';
import { testSlackConnection } from '../../integrations/slack.js';

interface IntegrationsDeps {
  getDb: () => Client;
}

export function registerIntegrationsRoutes(app: Express, deps: IntegrationsDeps): void {
  const { getDb } = deps;

  // List all integrations with auth/connection status
  app.get('/api/integrations', async (_req, res) => {
    try {
      const db = getDb();

      const result = await db.execute(
        'SELECT id, name, description, icon, category, auth_type, provider, auth_config, enabled, sort_order FROM integrations WHERE enabled = 1 ORDER BY category, sort_order'
      );

      let nangoConnections: Array<{ id: string; integrationId: string; createdAt: string }> = [];
      try {
        nangoConnections = await listConnections();
      } catch {
        // Nango might not be configured
      }

      const { listCredentials } = await import('../../credentials/index.js');
      const vaultEntries = await listCredentials();
      const vaultKeys = new Set(vaultEntries.map(e => e.key));

      const { getConfigValue } = await import('../../integrations/config.js');

      const integrations = await Promise.all(result.rows.map(async (row) => {
        const authConfig = row.auth_config ? JSON.parse(row.auth_config as string) : {};
        const authType = row.auth_type as string;
        const provider = row.provider as string;
        const id = row.id as string;

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
          const tokenKey = authConfig.token_key;
          connected = tokenKey ? vaultKeys.has(tokenKey) : false;
        } else if (authType === 'oauth' && provider === 'custom') {
          const keys: string[] = authConfig.credential_keys || [];
          connected = keys.length > 0 && keys.every(k => vaultKeys.has(k) || !!process.env[k]);
        } else if (authType === 'credentials') {
          const credKey = `${id.toUpperCase().replace(/-/g, '_')}_CREDENTIALS`;
          connected = vaultKeys.has(credKey);
        }

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

  // Create OAuth session
  app.post('/api/integrations/:id/connect', async (req, res) => {
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

      if (authType !== 'oauth') {
        res.status(400).json({ error: 'This integration does not use OAuth' });
        return;
      }

      if (provider === 'direct') {
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

  // OAuth callback
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

  // Set auth for non-OAuth integrations
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
      const { setCredential } = await import('../../credentials/index.js');

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

  // Remove auth
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
        const { deleteCredential } = await import('../../credentials/index.js');
        const credKey = authConfig.credential_key;
        if (credKey) await deleteCredential(credKey);
      } else if (authType === 'oauth' && authConfig.credential_keys) {
        const { deleteCredential } = await import('../../credentials/index.js');
        for (const key of authConfig.credential_keys) {
          await deleteCredential(key);
        }
      } else if (authType === 'credentials') {
        const { deleteCredential } = await import('../../credentials/index.js');
        const credKey = `${integrationId.toUpperCase().replace(/-/g, '_')}_CREDENTIALS`;
        await deleteCredential(credKey);
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to remove auth' });
    }
  });

  // Test auth
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
      const { getCredential } = await import('../../credentials/index.js');

      if (authType === 'oauth' && provider === 'direct') {
        const connected = await isOAuthConnected(integrationId);
        if (!connected) {
          res.json({ success: false, error: 'Not connected' });
          return;
        }

        if (integrationId === 'slack') {
          const slackResult = await testSlackConnection();
          res.json(slackResult);
          return;
        }
        if (integrationId === 'asana') {
          const { testAsanaConnection } = await import('../../integrations/asana.js');
          const asanaResult = await testAsanaConnection();
          res.json(asanaResult);
          return;
        }
        if (integrationId === 'notion') {
          const { testNotionConnection } = await import('../../integrations/notion.js');
          const notionResult = await testNotionConnection();
          res.json(notionResult);
          return;
        }

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
          res.json({ success: true, configured: true });
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

  // Disconnect Nango (legacy alias)
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

  // Connection status
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

  // Migrate .env secrets to vault
  app.post('/api/integrations/migrate', async (_req, res) => {
    try {
      const { migrateFromEnv } = await import('../../credentials/index.js');
      const result = await migrateFromEnv();
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Migration failed' });
    }
  });

  // Multi-Account: Get connections
  app.get('/api/integrations/:id/connections', async (req, res) => {
    try {
      const integrationId = req.params.id;
      const connections = await getLocalConnections(integrationId);
      res.json({ connections });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to get connections' });
    }
  });

  // Multi-Account: Register connection
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

  // Multi-Account: Set default connection
  app.post('/api/integrations/:id/connections/:connectionId/default', async (req, res) => {
    try {
      const { id: integrationId, connectionId } = req.params;
      await setDefaultConnection(integrationId, connectionId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to set default' });
    }
  });

  // Config: Get all
  app.get('/api/config', async (_req, res) => {
    try {
      const config = await getAllConfig();
      res.json({ config });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to get config' });
    }
  });

  // Config: Update
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
}
