/**
 * KITT Agent Pool (Coordinator)
 *
 * Centralized registry for all agent subprocesses.
 * Tracks what's running, enforces timeouts, and provides observability.
 *
 * Every runAgent() call registers here before spawning, and
 * deregisters on completion/failure/timeout.
 *
 * Agent executions are persisted to kitt.db so history survives restarts.
 *
 * @see KITT-146 Agent Pool — registry, timeouts, recovery
 * @see KITT-147 Agent Observability — logging, Portal API, diagnostiek
 */

import { randomUUID } from 'crypto';
import { createClient, type Client } from '@libsql/client';

// ==========================================
// Types
// ==========================================

export type AgentType = 'chat' | 'think' | 'think-sub' | 'background';
export type AgentStatus = 'starting' | 'running' | 'completed' | 'timeout' | 'error';

export interface AgentEntry {
  id: string;
  type: AgentType;
  status: AgentStatus;
  chatId?: string;
  capabilityId?: string;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  resultLength?: number;
  error?: string;
  abortController: AbortController;
}

export interface AgentStats {
  totalToday: number;
  active: number;
  completed: number;
  timeouts: number;
  errors: number;
  byType: Record<AgentType, { total: number; active: number; timeouts: number; errors: number }>;
}

export interface RegisterResult {
  agentId: string;
  abortController: AbortController;
}

// ==========================================
// Default Timeouts
// ==========================================

const DEFAULT_TIMEOUTS: Record<AgentType, number> = {
  'chat': 90_000,        // 90s — text generation, no tools (bumped from 60s: SDK subprocess init overhead)
  'think': 2 * 60_000,   // 2 min — reasoning + response format
  'think-sub': 5 * 60_000, // 5 min — skill execution with tools
  'background': 30 * 60_000, // 30 min — long-running tasks (blog, etc.)
};

// ==========================================
// Database
// ==========================================

const DB_PATH = process.env.KITT_DB_PATH || './profile/data/kitt.db';

let dbClient: Client | null = null;

function getDb(): Client {
  if (!dbClient) {
    dbClient = createClient({ url: `file:${DB_PATH}` });
  }
  return dbClient;
}

/**
 * Persist an agent execution to the database (fire-and-forget).
 */
function persistExecution(entry: AgentEntry): void {
  const db = getDb();
  db.execute({
    sql: `INSERT OR REPLACE INTO agent_executions (id, type, status, chat_id, capability_id, started_at, completed_at, duration_ms, result_length, error)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      entry.id,
      entry.type,
      entry.status,
      entry.chatId || null,
      entry.capabilityId || null,
      entry.startedAt,
      entry.completedAt || null,
      entry.durationMs || null,
      entry.resultLength || null,
      entry.error || null,
    ],
  }).catch((err) => {
    console.error('[agent-pool] Failed to persist execution:', err instanceof Error ? err.message : String(err));
  });
}

// ==========================================
// Agent Pool
// ==========================================

const WATCHDOG_INTERVAL_MS = 5_000;

class AgentPool {
  private active: Map<string, AgentEntry> = new Map();
  private watchdogTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startWatchdog();
  }

  /**
   * Register a new agent before spawning.
   * Returns an agentId and AbortController for timeout/cancel.
   */
  register(type: AgentType, options?: {
    chatId?: string;
    capabilityId?: string;
  }): RegisterResult {
    const agentId = `${type}-${randomUUID().slice(0, 8)}`;
    const abortController = new AbortController();

    const entry: AgentEntry = {
      id: agentId,
      type,
      status: 'starting',
      chatId: options?.chatId,
      capabilityId: options?.capabilityId,
      startedAt: Date.now(),
      abortController,
    };

    this.active.set(agentId, entry);

    console.log(`[agent-pool] 🟢 START  ${agentId}  type=${type}${options?.chatId ? `  chatId=${options.chatId}` : ''}${options?.capabilityId ? `  capability=${options.capabilityId}` : ''}`);

    return { agentId, abortController };
  }

  /**
   * Mark agent as running (received init message from SDK).
   */
  markRunning(agentId: string): void {
    const entry = this.active.get(agentId);
    if (entry) {
      entry.status = 'running';
    }
  }

  /**
   * Mark agent as completed successfully.
   */
  complete(agentId: string, resultLength?: number): void {
    const entry = this.active.get(agentId);
    if (!entry) return;

    entry.status = 'completed';
    entry.completedAt = Date.now();
    entry.durationMs = entry.completedAt - entry.startedAt;
    entry.resultLength = resultLength;

    this.active.delete(agentId);
    persistExecution(entry);

    const duration = this.formatDuration(entry.durationMs);
    console.log(`[agent-pool] ✅ DONE   ${agentId}  type=${entry.type}  duration=${duration}  result=${resultLength || 0}chars`);
  }

  /**
   * Mark agent as failed with an error.
   */
  fail(agentId: string, error: string): void {
    const entry = this.active.get(agentId);
    if (!entry) return;

    entry.status = 'error';
    entry.completedAt = Date.now();
    entry.durationMs = entry.completedAt - entry.startedAt;
    entry.error = error;

    this.active.delete(agentId);
    persistExecution(entry);

    const duration = this.formatDuration(entry.durationMs);
    console.log(`[agent-pool] ❌ ERROR  ${agentId}  type=${entry.type}  duration=${duration}  error="${error.slice(0, 100)}"`);
  }

  /**
   * Get all currently active agents (for Portal API).
   */
  getActive(): Array<{
    id: string;
    type: AgentType;
    status: AgentStatus;
    chatId?: string;
    capabilityId?: string;
    duration: string;
    startedAt: number;
  }> {
    const now = Date.now();
    return Array.from(this.active.values()).map((entry) => ({
      id: entry.id,
      type: entry.type,
      status: entry.status,
      chatId: entry.chatId,
      capabilityId: entry.capabilityId,
      duration: this.formatDuration(now - entry.startedAt),
      startedAt: entry.startedAt,
    }));
  }

  /**
   * Get recent completed/failed agents from DB (persists across restarts).
   */
  async getRecent(limit = 20): Promise<Array<{
    id: string;
    type: AgentType;
    status: AgentStatus;
    chatId?: string;
    capabilityId?: string;
    duration: string;
    resultLength?: number;
    error?: string;
    completedAt?: number;
  }>> {
    try {
      const db = getDb();
      const result = await db.execute({
        sql: `SELECT id, type, status, chat_id, capability_id, started_at, completed_at, duration_ms, result_length, error
              FROM agent_executions
              ORDER BY completed_at DESC
              LIMIT ?`,
        args: [limit],
      });

      return result.rows.map((row) => ({
        id: String(row.id),
        type: String(row.type) as AgentType,
        status: String(row.status) as AgentStatus,
        chatId: row.chat_id ? String(row.chat_id) : undefined,
        capabilityId: row.capability_id ? String(row.capability_id) : undefined,
        duration: this.formatDuration(Number(row.duration_ms) || 0),
        resultLength: row.result_length ? Number(row.result_length) : undefined,
        error: row.error ? String(row.error) : undefined,
        completedAt: row.completed_at ? Number(row.completed_at) : undefined,
      }));
    } catch (err) {
      console.error('[agent-pool] Failed to read recent from DB:', err instanceof Error ? err.message : String(err));
      return [];
    }
  }

  /**
   * Get aggregate stats from DB + in-memory active (for Portal API).
   */
  async getStats(): Promise<AgentStats> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    const byType: AgentStats['byType'] = {
      chat: { total: 0, active: 0, timeouts: 0, errors: 0 },
      think: { total: 0, active: 0, timeouts: 0, errors: 0 },
      'think-sub': { total: 0, active: 0, timeouts: 0, errors: 0 },
      background: { total: 0, active: 0, timeouts: 0, errors: 0 },
    };

    // Count active agents by type (in-memory)
    for (const entry of this.active.values()) {
      byType[entry.type].active++;
    }

    let totalToday = this.active.size;
    let completedToday = 0;
    let timeoutsToday = 0;
    let errorsToday = 0;

    try {
      const db = getDb();

      // Get today's stats from DB
      const statsResult = await db.execute({
        sql: `SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'timeout' THEN 1 ELSE 0 END) as timeouts,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
              FROM agent_executions
              WHERE started_at >= ?`,
        args: [todayMs],
      });

      if (statsResult.rows.length > 0) {
        const row = statsResult.rows[0];
        totalToday += Number(row.total) || 0;
        completedToday = Number(row.completed) || 0;
        timeoutsToday = Number(row.timeouts) || 0;
        errorsToday = Number(row.errors) || 0;
      }

      // Get per-type breakdown from DB (today)
      const typeResult = await db.execute({
        sql: `SELECT type, COUNT(*) as total,
                SUM(CASE WHEN status = 'timeout' THEN 1 ELSE 0 END) as timeouts,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
              FROM agent_executions
              WHERE started_at >= ?
              GROUP BY type`,
        args: [todayMs],
      });

      for (const row of typeResult.rows) {
        const type = String(row.type) as AgentType;
        if (byType[type]) {
          byType[type].total = Number(row.total) || 0;
          byType[type].timeouts = Number(row.timeouts) || 0;
          byType[type].errors = Number(row.errors) || 0;
        }
      }
    } catch (err) {
      console.error('[agent-pool] Failed to read stats from DB:', err instanceof Error ? err.message : String(err));
    }

    return {
      totalToday,
      active: this.active.size,
      completed: completedToday,
      timeouts: timeoutsToday,
      errors: errorsToday,
      byType,
    };
  }

  /**
   * Get the default timeout for an agent type.
   */
  getDefaultTimeout(type: AgentType): number {
    return DEFAULT_TIMEOUTS[type];
  }

  /**
   * Shutdown: stop watchdog, abort all active agents.
   */
  shutdown(): void {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }

    for (const [agentId, entry] of this.active) {
      entry.abortController.abort();
      console.log(`[agent-pool] 🛑 SHUTDOWN abort ${agentId}`);
    }
    this.active.clear();
  }

  // --- Private ---

  private startWatchdog(): void {
    this.watchdogTimer = setInterval(() => {
      this.checkTimeouts();
    }, WATCHDOG_INTERVAL_MS);

    // Don't prevent Node from exiting
    if (this.watchdogTimer.unref) {
      this.watchdogTimer.unref();
    }
  }

  private checkTimeouts(): void {
    const now = Date.now();

    for (const [agentId, entry] of this.active) {
      const maxDuration = DEFAULT_TIMEOUTS[entry.type];
      const elapsed = now - entry.startedAt;

      if (elapsed > maxDuration) {
        // Timeout — abort the agent
        entry.status = 'timeout';
        entry.completedAt = now;
        entry.durationMs = elapsed;
        entry.error = `Timeout after ${this.formatDuration(elapsed)} (max: ${this.formatDuration(maxDuration)})`;

        entry.abortController.abort();

        this.active.delete(agentId);
        persistExecution(entry);

        console.log(`[agent-pool] ⚠️ TIMEOUT ${agentId}  type=${entry.type}  duration=${this.formatDuration(elapsed)}  max=${this.formatDuration(maxDuration)}`);
      }
    }
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60_000).toFixed(1)}m`;
  }
}

// ==========================================
// Singleton
// ==========================================

let instance: AgentPool | null = null;

export function getAgentPool(): AgentPool {
  if (!instance) {
    instance = new AgentPool();
  }
  return instance;
}
