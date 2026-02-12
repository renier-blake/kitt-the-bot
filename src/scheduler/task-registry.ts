/**
 * KITT Background Task Registry
 *
 * Manages background tasks that run asynchronously while the user
 * can continue chatting. Tasks are stored in the database for
 * tracking, completion notifications, and Think Loop awareness.
 *
 * @see _prd/kitt-orchestrator-model.md
 */

import { createClient, type Client } from '@libsql/client';
import * as path from 'path';
import { randomUUID } from 'crypto';

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

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface BackgroundTask {
  id: string;
  chatId: string;
  channel: string;
  capabilityId: string;
  description: string | null;
  prompt: string;
  status: TaskStatus;
  result: string | null;
  error: string | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
}

export interface CreateTaskInput {
  chatId: string;
  channel: string;
  capabilityId: string;
  description?: string;
  prompt: string;
}

// ==========================================
// Database Schema
// ==========================================

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS background_tasks (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  capability_id TEXT NOT NULL,
  description TEXT,
  prompt TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  result TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER
)`;

const CREATE_INDEXES_SQL = [
  'CREATE INDEX IF NOT EXISTS idx_bg_tasks_status ON background_tasks(status)',
  'CREATE INDEX IF NOT EXISTS idx_bg_tasks_chat ON background_tasks(chat_id, status)',
];

// ==========================================
// Initialization
// ==========================================

/**
 * Initialize the background_tasks table
 */
export async function initTaskRegistry(): Promise<void> {
  const db = getDb();

  await db.execute(CREATE_TABLE_SQL);

  for (const indexSql of CREATE_INDEXES_SQL) {
    await db.execute(indexSql);
  }

  console.log('[task-registry] Table initialized');
}

// ==========================================
// Row Mapping
// ==========================================

function rowToTask(row: Record<string, unknown>): BackgroundTask {
  return {
    id: row.id as string,
    chatId: row.chat_id as string,
    channel: row.channel as string,
    capabilityId: row.capability_id as string,
    description: row.description as string | null,
    prompt: row.prompt as string,
    status: row.status as TaskStatus,
    result: row.result as string | null,
    error: row.error as string | null,
    createdAt: row.created_at as number,
    startedAt: row.started_at as number | null,
    completedAt: row.completed_at as number | null,
  };
}

// ==========================================
// CRUD Operations
// ==========================================

/**
 * Create a new background task
 */
export async function createTask(input: CreateTaskInput): Promise<BackgroundTask> {
  const db = getDb();
  const id = randomUUID();
  const now = Date.now();

  await db.execute({
    sql: `INSERT INTO background_tasks
          (id, chat_id, channel, capability_id, description, prompt, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
    args: [
      id,
      input.chatId,
      input.channel,
      input.capabilityId,
      input.description || null,
      input.prompt,
      now,
    ],
  });

  console.log('[task-registry] Task created', { id, capabilityId: input.capabilityId });

  const task = await getTask(id);
  if (!task) throw new Error(`Failed to create task: ${id}`);
  return task;
}

/**
 * Get a task by ID
 */
export async function getTask(id: string): Promise<BackgroundTask | null> {
  const db = getDb();

  const result = await db.execute({
    sql: 'SELECT * FROM background_tasks WHERE id = ?',
    args: [id],
  });

  if (result.rows.length === 0) return null;
  return rowToTask(result.rows[0] as Record<string, unknown>);
}

/**
 * Get all active tasks (pending or running)
 */
export async function getActiveTasks(): Promise<BackgroundTask[]> {
  const db = getDb();

  const result = await db.execute({
    sql: `SELECT * FROM background_tasks
          WHERE status IN ('pending', 'running')
          ORDER BY created_at ASC`,
    args: [],
  });

  return result.rows.map((row) => rowToTask(row as Record<string, unknown>));
}

/**
 * Get active tasks for a specific chat
 */
export async function getActiveTasksForChat(chatId: string): Promise<BackgroundTask[]> {
  const db = getDb();

  const result = await db.execute({
    sql: `SELECT * FROM background_tasks
          WHERE chat_id = ? AND status IN ('pending', 'running')
          ORDER BY created_at ASC`,
    args: [chatId],
  });

  return result.rows.map((row) => rowToTask(row as Record<string, unknown>));
}

/**
 * Get recent tasks (for Portal view)
 */
export async function getRecentTasks(limit = 20): Promise<BackgroundTask[]> {
  const db = getDb();

  const result = await db.execute({
    sql: `SELECT * FROM background_tasks
          ORDER BY created_at DESC
          LIMIT ?`,
    args: [limit],
  });

  return result.rows.map((row) => rowToTask(row as Record<string, unknown>));
}

/**
 * Mark a task as running
 */
export async function markTaskRunning(id: string): Promise<void> {
  const db = getDb();

  await db.execute({
    sql: `UPDATE background_tasks
          SET status = 'running', started_at = ?
          WHERE id = ?`,
    args: [Date.now(), id],
  });

  console.log('[task-registry] Task started', { id });
}

/**
 * Mark a task as completed with result
 */
export async function completeTask(id: string, result: string): Promise<void> {
  const db = getDb();

  await db.execute({
    sql: `UPDATE background_tasks
          SET status = 'completed', result = ?, completed_at = ?
          WHERE id = ?`,
    args: [result, Date.now(), id],
  });

  console.log('[task-registry] Task completed', { id });
}

/**
 * Mark a task as failed with error
 */
export async function failTask(id: string, error: string): Promise<void> {
  const db = getDb();

  await db.execute({
    sql: `UPDATE background_tasks
          SET status = 'failed', error = ?, completed_at = ?
          WHERE id = ?`,
    args: [error, Date.now(), id],
  });

  console.log('[task-registry] Task failed', { id, error });
}

/**
 * Clean up old completed/failed tasks (keep last 7 days)
 */
export async function cleanupOldTasks(): Promise<number> {
  const db = getDb();
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago

  const result = await db.execute({
    sql: `DELETE FROM background_tasks
          WHERE status IN ('completed', 'failed')
          AND completed_at < ?`,
    args: [cutoff],
  });

  const deleted = result.rowsAffected;
  if (deleted > 0) {
    console.log('[task-registry] Cleaned up old tasks', { deleted });
  }

  return deleted;
}

/**
 * Check if there's already an active task for this capability in this chat
 * (prevents duplicate task spawning)
 */
export async function hasActiveTaskForCapability(
  chatId: string,
  capabilityId: string
): Promise<boolean> {
  const db = getDb();

  const result = await db.execute({
    sql: `SELECT COUNT(*) as count FROM background_tasks
          WHERE chat_id = ? AND capability_id = ? AND status IN ('pending', 'running')`,
    args: [chatId, capabilityId],
  });

  const count = (result.rows[0] as Record<string, unknown>).count as number;
  return count > 0;
}
