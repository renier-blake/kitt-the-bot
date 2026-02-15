/**
 * Slack Permission System — Channel & User Permission Matrix
 *
 * Supports per-channel, per-user, and global permissions with resolution order:
 * 1. User × Channel (most specific)
 * 2. User global — user-specific rules beat channel defaults
 * 3. Channel default
 * 4. Global default
 * 5. Fallback: no rules = 'respond' (backwards compat), rules exist = 'blocked'
 */

import { createClient, type Client } from '@libsql/client';
import * as path from 'path';
import { log } from '../logger.js';

// --- Types ---

export type SlackPermission = 'respond' | 'read-only' | 'blocked';
export type SlackAdapterType = 'slack' | 'slack-bot';

export interface PermissionRule {
  id: number;
  adapter: SlackAdapterType;
  channelId: string; // '' = wildcard (all channels)
  userId: string;    // '' = wildcard (all users)
  permission: SlackPermission;
}

export interface PermissionMatrix {
  globalDefault: SlackPermission | null;
  channels: Array<{
    channelId: string;
    default: SlackPermission;
    overrides: Array<{ userId: string; permission: SlackPermission }>;
  }>;
  users: Array<{
    userId: string;
    permission: SlackPermission;
  }>;
}

// --- Database ---

const DB_PATH = path.resolve(process.cwd(), 'profile/data/kitt.db');
let dbClient: Client | null = null;

function getDb(): Client {
  if (!dbClient) {
    dbClient = createClient({ url: `file:${DB_PATH}` });
  }
  return dbClient;
}

// --- Cache ---

interface PermissionCache {
  lookup: Map<string, SlackPermission>;
  ruleCount: number;
  timestamp: number;
}

const CACHE_TTL = 30_000; // 30 seconds
const cacheByAdapter: Map<string, PermissionCache> = new Map();

function cacheKey(channelId: string, userId: string): string {
  return `${channelId}:${userId}`;
}

async function loadCache(adapter: SlackAdapterType): Promise<PermissionCache> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT channel_id, user_id, permission FROM slack_permissions WHERE adapter = ?',
    args: [adapter],
  });

  const lookup = new Map<string, SlackPermission>();
  for (const row of result.rows) {
    const chId = String(row.channel_id ?? '');
    const uId = String(row.user_id ?? '');
    const perm = String(row.permission) as SlackPermission;
    lookup.set(cacheKey(chId, uId), perm);
  }

  const cache: PermissionCache = {
    lookup,
    ruleCount: result.rows.length,
    timestamp: Date.now(),
  };

  cacheByAdapter.set(adapter, cache);
  return cache;
}

function getCache(adapter: SlackAdapterType): PermissionCache | null {
  const cache = cacheByAdapter.get(adapter);
  if (!cache) return null;
  if (Date.now() - cache.timestamp > CACHE_TTL) return null;
  return cache;
}

// --- Resolution ---

export async function resolvePermission(
  adapter: SlackAdapterType,
  userId: string,
  channelId: string,
  ownUserId: string | null,
): Promise<SlackPermission> {
  // Own user always gets respond
  if (userId === ownUserId) return 'respond';

  let cache = getCache(adapter);
  if (!cache) {
    try {
      cache = await loadCache(adapter);
    } catch (err) {
      log.error('Failed to load slack permissions', { error: String(err) });
      return 'respond'; // Fail-open on DB error
    }
  }

  // 1. User × Channel (most specific)
  const specific = cache.lookup.get(cacheKey(channelId, userId));
  if (specific) return specific;

  // 2. User global (channel = wildcard) — user-specific rules beat channel defaults
  const userGlobal = cache.lookup.get(cacheKey('', userId));
  if (userGlobal) return userGlobal;

  // 3. Channel default (user = wildcard)
  const channelDefault = cache.lookup.get(cacheKey(channelId, ''));
  if (channelDefault) return channelDefault;

  // 4. Global default (both wildcard)
  const globalDefault = cache.lookup.get(cacheKey('', ''));
  if (globalDefault) return globalDefault;

  // 5. No rules at all = allow everyone (backwards compat)
  if (cache.ruleCount === 0) return 'respond';

  // Rules exist but user not matched = blocked
  return 'blocked';
}

export function invalidatePermissionCache(adapter?: SlackAdapterType): void {
  if (adapter) {
    cacheByAdapter.delete(adapter);
  } else {
    cacheByAdapter.clear();
  }
}

// --- CRUD ---

export async function getAllPermissions(adapter: SlackAdapterType): Promise<PermissionMatrix> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT id, channel_id, user_id, permission FROM slack_permissions WHERE adapter = ? ORDER BY channel_id, user_id',
    args: [adapter],
  });

  let globalDefault: SlackPermission | null = null;
  const channelMap = new Map<string, { default: SlackPermission | null; overrides: Array<{ userId: string; permission: SlackPermission }> }>();
  const users: Array<{ userId: string; permission: SlackPermission }> = [];

  for (const row of result.rows) {
    const chId = String(row.channel_id ?? '');
    const uId = String(row.user_id ?? '');
    const perm = String(row.permission) as SlackPermission;

    if (chId === '' && uId === '') {
      // Global default
      globalDefault = perm;
    } else if (chId === '' && uId !== '') {
      // Global user permission
      users.push({ userId: uId, permission: perm });
    } else if (chId !== '' && uId === '') {
      // Channel default
      if (!channelMap.has(chId)) channelMap.set(chId, { default: null, overrides: [] });
      channelMap.get(chId)!.default = perm;
    } else {
      // User × Channel override
      if (!channelMap.has(chId)) channelMap.set(chId, { default: null, overrides: [] });
      channelMap.get(chId)!.overrides.push({ userId: uId, permission: perm });
    }
  }

  const channels = Array.from(channelMap.entries()).map(([channelId, data]) => ({
    channelId,
    default: data.default ?? 'read-only',
    overrides: data.overrides,
  }));

  return { globalDefault, channels, users };
}

export async function upsertPermission(
  adapter: SlackAdapterType,
  channelId: string,
  userId: string,
  permission: SlackPermission,
): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO slack_permissions (adapter, channel_id, user_id, permission, updated_at)
          VALUES (?, ?, ?, ?, unixepoch() * 1000)
          ON CONFLICT(adapter, channel_id, user_id) DO UPDATE SET
            permission = excluded.permission,
            updated_at = excluded.updated_at`,
    args: [adapter, channelId, userId, permission],
  });
  invalidatePermissionCache(adapter);
}

export async function deletePermission(
  adapter: SlackAdapterType,
  channelId: string,
  userId: string,
): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: 'DELETE FROM slack_permissions WHERE adapter = ? AND channel_id = ? AND user_id = ?',
    args: [adapter, channelId, userId],
  });
  invalidatePermissionCache(adapter);
}
