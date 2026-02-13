/**
 * KITT Capabilities Registry
 *
 * Unified registry for all agent capabilities (tools + skills).
 * Used for mode-based tool selection and background task routing.
 *
 * @see _prd/kitt-orchestrator-model.md
 */

import { createClient, type Client } from '@libsql/client';
import * as path from 'path';
import { createLogger } from '../bridge/logger.js';

const log = createLogger('capabilities');

const DB_PATH = path.resolve(process.cwd(), 'profile/data/kitt.db');

let dbClient: Client | null = null;

function getDb(): Client {
  if (!dbClient) {
    dbClient = createClient({
      url: `file:${DB_PATH}`,
    });
  }
  return dbClient;
}

// ==========================================
// Types
// ==========================================

export type CapabilityCategory = 'tool' | 'skill';
export type SkillType = 'system' | 'user';
export type ExecutionMode = 'direct' | 'background' | 'inline';
export type AgentMode = 'secure' | 'developer';

export interface Capability {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: CapabilityCategory;
  skillType: SkillType | null;
  execution: ExecutionMode;
  model: string | null;
  path: string | null;
  triggers: string[];
  modes: AgentMode[];
  allowedTools: string[] | null;
  enabled: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface CapabilityInput {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  category: CapabilityCategory;
  skillType?: SkillType;
  execution?: ExecutionMode;
  model?: string;
  path?: string;
  triggers?: string[];
  modes?: AgentMode[];
  enabled?: boolean;
  sortOrder?: number;
}

// ==========================================
// Database Schema
// ==========================================

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS capabilities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  category TEXT NOT NULL,
  skill_type TEXT,
  execution TEXT DEFAULT 'direct',
  model TEXT,
  path TEXT,
  triggers TEXT,
  modes TEXT DEFAULT '["developer"]',
  enabled INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`;

const CREATE_INDEXES_SQL = [
  'CREATE INDEX IF NOT EXISTS idx_capabilities_category ON capabilities(category)',
  'CREATE INDEX IF NOT EXISTS idx_capabilities_enabled ON capabilities(enabled)',
];

// ==========================================
// Database Operations
// ==========================================

/**
 * Initialize the capabilities table
 */
export async function initCapabilitiesTable(): Promise<void> {
  const db = getDb();

  await db.execute(CREATE_TABLE_SQL);

  for (const indexSql of CREATE_INDEXES_SQL) {
    await db.execute(indexSql);
  }

  log.info('Table initialized');
}

/**
 * Map database row to Capability object
 */
function rowToCapability(row: Record<string, unknown>): Capability {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | null,
    icon: row.icon as string | null,
    category: row.category as CapabilityCategory,
    skillType: row.skill_type as SkillType | null,
    execution: (row.execution as ExecutionMode) || 'direct',
    model: row.model as string | null,
    path: row.path as string | null,
    triggers: row.triggers ? JSON.parse(row.triggers as string) : [],
    modes: row.modes ? JSON.parse(row.modes as string) : ['developer'],
    allowedTools: row.allowed_tools ? JSON.parse(row.allowed_tools as string) : null,
    enabled: Boolean(row.enabled),
    sortOrder: (row.sort_order as number) || 0,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

// ==========================================
// CRUD Operations
// ==========================================

/**
 * Get all capabilities
 */
export async function getAllCapabilities(): Promise<Capability[]> {
  const db = getDb();

  const result = await db.execute(
    'SELECT * FROM capabilities ORDER BY category, sort_order, name'
  );

  return result.rows.map((row) => rowToCapability(row as Record<string, unknown>));
}

/**
 * Get capabilities filtered by mode
 */
export async function getCapabilitiesForMode(mode: AgentMode): Promise<Capability[]> {
  const db = getDb();

  // SQLite JSON query to check if mode is in the modes array
  const result = await db.execute({
    sql: `SELECT * FROM capabilities
          WHERE enabled = 1
          AND modes LIKE ?
          ORDER BY category, sort_order, name`,
    args: [`%"${mode}"%`],
  });

  return result.rows.map((row) => rowToCapability(row as Record<string, unknown>));
}

/**
 * Get capabilities by category
 */
export async function getCapabilitiesByCategory(
  category: CapabilityCategory
): Promise<Capability[]> {
  const db = getDb();

  const result = await db.execute({
    sql: 'SELECT * FROM capabilities WHERE category = ? ORDER BY sort_order, name',
    args: [category],
  });

  return result.rows.map((row) => rowToCapability(row as Record<string, unknown>));
}

/**
 * Get a single capability by ID
 */
export async function getCapability(id: string): Promise<Capability | null> {
  const db = getDb();

  const result = await db.execute({
    sql: 'SELECT * FROM capabilities WHERE id = ?',
    args: [id],
  });

  if (result.rows.length === 0) return null;
  return rowToCapability(result.rows[0] as Record<string, unknown>);
}

/**
 * Create or update a capability
 */
export async function upsertCapability(input: CapabilityInput): Promise<Capability> {
  const db = getDb();
  const now = Date.now();

  const existing = await getCapability(input.id);
  const createdAt = existing?.createdAt || now;

  await db.execute({
    sql: `INSERT OR REPLACE INTO capabilities
          (id, name, description, icon, category, skill_type, execution, model, path, triggers, modes, enabled, sort_order, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      input.id,
      input.name,
      input.description || null,
      input.icon || null,
      input.category,
      input.skillType || null,
      input.execution || 'direct',
      input.model || null,
      input.path || null,
      input.triggers ? JSON.stringify(input.triggers) : null,
      JSON.stringify(input.modes || ['developer']),
      input.enabled !== false ? 1 : 0,
      input.sortOrder || 0,
      createdAt,
      now,
    ],
  });

  const capability = await getCapability(input.id);
  if (!capability) throw new Error(`Failed to upsert capability: ${input.id}`);

  log.info(`${existing ? 'Updated' : 'Created'} capability: ${input.id}`);
  return capability;
}

/**
 * Update capability enabled status
 */
export async function setCapabilityEnabled(id: string, enabled: boolean): Promise<void> {
  const db = getDb();

  await db.execute({
    sql: 'UPDATE capabilities SET enabled = ?, updated_at = ? WHERE id = ?',
    args: [enabled ? 1 : 0, Date.now(), id],
  });

  log.info(`${enabled ? 'Enabled' : 'Disabled'} capability: ${id}`);
}

/**
 * Delete a capability
 */
export async function deleteCapability(id: string): Promise<void> {
  const db = getDb();

  await db.execute({
    sql: 'DELETE FROM capabilities WHERE id = ?',
    args: [id],
  });

  log.info(`Deleted capability: ${id}`);
}

// ==========================================
// Mode Management
// ==========================================

/**
 * Get current agent mode from meta table
 */
export async function getAgentMode(): Promise<AgentMode> {
  const db = getDb();

  try {
    const result = await db.execute({
      sql: "SELECT value FROM meta WHERE key = 'agent_mode'",
      args: [],
    });

    if (result.rows.length > 0) {
      const value = result.rows[0].value as string;
      if (value === 'secure' || value === 'developer') {
        return value;
      }
    }
  } catch {
    // Table or key might not exist
  }

  return 'developer'; // Default mode
}

/**
 * Set agent mode
 */
export async function setAgentMode(mode: AgentMode): Promise<void> {
  const db = getDb();

  await db.execute({
    sql: "INSERT OR REPLACE INTO meta (key, value) VALUES ('agent_mode', ?)",
    args: [mode],
  });

  log.info(`Agent mode set to: ${mode}`);
}

// ==========================================
// Generic Meta Table Access
// ==========================================

/**
 * Get a value from the meta table
 */
export async function getMetaValue(key: string): Promise<string | null> {
  const db = getDb();

  try {
    const result = await db.execute({
      sql: 'SELECT value FROM meta WHERE key = ?',
      args: [key],
    });

    if (result.rows.length > 0) {
      return result.rows[0].value as string;
    }
  } catch {
    // Table or key might not exist
  }

  return null;
}

/**
 * Set a value in the meta table
 */
export async function setMetaValue(key: string, value: string): Promise<void> {
  const db = getDb();

  await db.execute({
    sql: 'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
    args: [key, value],
  });
}

/**
 * Delete a value from the meta table
 */
export async function deleteMetaValue(key: string): Promise<void> {
  const db = getDb();

  await db.execute({
    sql: 'DELETE FROM meta WHERE key = ?',
    args: [key],
  });
}

// ==========================================
// Utility Functions
// ==========================================

/**
 * Get tools available for current mode
 */
export async function getAvailableTools(mode?: AgentMode): Promise<Capability[]> {
  const currentMode = mode || (await getAgentMode());
  const capabilities = await getCapabilitiesForMode(currentMode);
  return capabilities.filter((c) => c.category === 'tool');
}

/**
 * Get skills available for current mode
 */
export async function getAvailableSkills(mode?: AgentMode): Promise<Capability[]> {
  const currentMode = mode || (await getAgentMode());
  const capabilities = await getCapabilitiesForMode(currentMode);
  return capabilities.filter((c) => c.category === 'skill');
}

/**
 * Check if a capability is available in the current mode
 */
export async function isCapabilityAvailable(
  id: string,
  mode?: AgentMode
): Promise<boolean> {
  const currentMode = mode || (await getAgentMode());
  const capability = await getCapability(id);

  if (!capability || !capability.enabled) return false;
  return capability.modes.includes(currentMode);
}

/**
 * Get background-capable skills (for task dispatching)
 */
export async function getBackgroundSkills(mode?: AgentMode): Promise<Capability[]> {
  const currentMode = mode || (await getAgentMode());
  const capabilities = await getCapabilitiesForMode(currentMode);
  return capabilities.filter((c) => c.category === 'skill' && (c.execution === 'background' || c.execution === 'inline'));
}
