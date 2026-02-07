/**
 * KITT Task Engine
 *
 * Manages KITT's mental to-do list - determines WHAT needs to be done and WHEN.
 * Skills remain templates for HOW to do things.
 *
 * Key concepts:
 * - Tasks are stored in kitt_tasks table
 * - Task executions are logged in transcripts with role='task'
 * - Think Loop queries open tasks and decides what to execute
 */

import type { Client } from '@libsql/client';

// ==========================================
// Types
// ==========================================

export type TaskFrequency = 'once' | 'daily' | 'weekly' | 'monthly';
export type TaskPriority = 'high' | 'medium' | 'low';
// F53: task_status values in transcripts table
export type TaskStatus = 'reminder' | 'completed' | 'skipped' | 'deferred';

export interface KittTask {
  id: number;
  title: string;
  description: string | null;
  frequency: TaskFrequency;
  priority: TaskPriority;
  skill_refs: string[]; // Parsed from JSON
  time_window_start: string | null; // 'HH:MM'
  time_window_end: string | null; // 'HH:MM'
  grace_period_minutes: number;
  snoozed_until: number | null; // Unix timestamp ms
  next_run: number | null; // Unix timestamp ms
  depends_on: number[] | null; // Task IDs that must be completed first (F54: changed to array)
  created_by: 'kitt' | 'renier';
  active: boolean;
  created_at: number;
}

export interface TaskExecution {
  task_id: number;
  task_title: string;
  status: TaskStatus;
  notes?: string;
}

export interface OpenTasksResult {
  tasks: KittTask[];
  skippedReasons: Map<number, string>; // task_id -> reason
}

// ==========================================
// Task Queries
// ==========================================

/**
 * Get all open tasks that should be considered for execution
 *
 * A task is "open" if:
 * 1. It's active
 * 2. It's not snoozed
 * 3. It hasn't been executed yet based on its frequency
 * 4. It's within or past its time window (if defined)
 */
export async function getOpenTasks(db: Client): Promise<OpenTasksResult> {
  const now = Date.now();
  const skippedReasons = new Map<number, string>();

  console.log('[task-engine] 📋 Checking open tasks...');

  // Get all active tasks
  const result = await db.execute(`
    SELECT * FROM kitt_tasks
    WHERE active = 1
    ORDER BY
      CASE priority
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
      END,
      created_at ASC
  `);

  const allTasks: KittTask[] = result.rows.map((row) => ({
    id: Number(row.id),
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    frequency: String(row.frequency) as TaskFrequency,
    priority: String(row.priority) as TaskPriority,
    skill_refs: parseSkillRefs(row.skill_refs),
    time_window_start: row.time_window_start ? String(row.time_window_start) : null,
    time_window_end: row.time_window_end ? String(row.time_window_end) : null,
    grace_period_minutes: Number(row.grace_period_minutes || 0),
    snoozed_until: row.snoozed_until ? Number(row.snoozed_until) : null,
    next_run: row.next_run ? Number(row.next_run) : null,
    depends_on: parseDependsOn(row.depends_on),
    created_by: String(row.created_by) as 'kitt' | 'renier',
    active: Boolean(row.active),
    created_at: Number(row.created_at),
  }));

  // Filter tasks
  const openTasks: KittTask[] = [];

  for (const task of allTasks) {
    // Check snooze
    if (task.snoozed_until && task.snoozed_until > now) {
      skippedReasons.set(task.id, `Snoozed until ${new Date(task.snoozed_until).toLocaleString()}`);
      continue;
    }

    // Check next_run (for retry scheduling)
    if (task.next_run && task.next_run > now) {
      skippedReasons.set(task.id, `Scheduled for ${new Date(task.next_run).toLocaleString()}`);
      continue;
    }

    // Check dependencies (F54: supports multiple dependencies)
    if (task.depends_on !== null && task.depends_on.length > 0) {
      const allCompleted = await areDependenciesCompleted(db, task.depends_on);
      if (!allCompleted) {
        // Find which dependencies are not completed for detailed message
        const pendingDeps: number[] = [];
        for (const depId of task.depends_on) {
          const completed = await isDependencyCompleted(db, depId);
          if (!completed) pendingDeps.push(depId);
        }
        // Special case: wake-up task (id=0)
        const reason = pendingDeps.includes(0)
          ? 'Wacht op wake-up (geen user message vandaag)'
          : `Wacht op task(s) #${pendingDeps.join(', #')}`;
        skippedReasons.set(task.id, reason);
        continue;
      }
    }

    // Check time window
    const windowStatus = checkTimeWindow(task);
    if (windowStatus === 'before') {
      skippedReasons.set(task.id, `Time window not started yet (starts at ${task.time_window_start})`);
      continue;
    }
    if (windowStatus === 'after') {
      skippedReasons.set(task.id, `Time window passed (ended at ${task.time_window_end})`);
      continue;
    }

    // Check if already executed based on frequency
    const executed = await hasBeenExecuted(db, task);
    if (executed) {
      skippedReasons.set(task.id, `Already executed (${task.frequency})`);
      continue;
    }

    openTasks.push(task);
  }

  // Log summary
  if (openTasks.length > 0) {
    console.log(`[task-engine] ✅ ${openTasks.length} open task(s):`, openTasks.map(t => t.title).join(', '));
  } else {
    console.log('[task-engine] ⏸️ No open tasks right now');
  }

  if (skippedReasons.size > 0) {
    const skippedSummary = Array.from(skippedReasons.entries())
      .map(([id, reason]) => `#${id}: ${reason}`)
      .join('; ');
    console.log(`[task-engine] ⏭️ Skipped ${skippedReasons.size}: ${skippedSummary}`);
  }

  return { tasks: openTasks, skippedReasons };
}

/**
 * Check if a dependency task has been completed today
 * Used for task chaining (e.g., wake-up task gates other tasks)
 *
 * Special case: wake-up task (id=0) is considered "completed" when:
 * - User has sent any message today (they're awake)
 * - OR the task was explicitly marked completed
 *
 * F53: Uses type='task' and task_id/task_status columns
 */
async function isDependencyCompleted(db: Client, dependsOnId: number): Promise<boolean> {
  // Special case: wake-up task (id=0)
  // User sending a message = they're awake
  if (dependsOnId === 0) {
    const userMessageResult = await db.execute(`
      SELECT 1 FROM transcripts
      WHERE role = 'user'
        AND date(created_at/1000, 'unixepoch', 'localtime') = date('now', 'localtime')
      LIMIT 1
    `);
    if (userMessageResult.rows.length > 0) {
      return true;
    }
  }

  // Standard case: check if task was explicitly completed using F53 columns
  const result = await db.execute({
    sql: `
      SELECT 1 FROM transcripts
      WHERE type = 'task'
        AND task_id = ?
        AND task_status IN ('reminder', 'completed')
        AND date(created_at/1000, 'unixepoch', 'localtime') = date('now', 'localtime')
      LIMIT 1
    `,
    args: [dependsOnId],
  });
  return result.rows.length > 0;
}

/**
 * Check if ALL dependency tasks have been completed today
 * F54: Supports multiple dependencies
 */
async function areDependenciesCompleted(db: Client, dependsOn: number[]): Promise<boolean> {
  for (const depId of dependsOn) {
    const completed = await isDependencyCompleted(db, depId);
    if (!completed) return false;
  }
  return true;
}

/**
 * Check if a task has been executed based on its frequency
 *
 * F53: Uses type='task' and task_id/task_status columns
 */
async function hasBeenExecuted(db: Client, task: KittTask): Promise<boolean> {
  let dateFilter: string;

  switch (task.frequency) {
    case 'daily':
      dateFilter = "date(created_at/1000, 'unixepoch', 'localtime') = date('now', 'localtime')";
      break;
    case 'weekly':
      dateFilter = `strftime('%W', datetime(created_at/1000, 'unixepoch', 'localtime')) = strftime('%W', 'now', 'localtime')
                    AND strftime('%Y', datetime(created_at/1000, 'unixepoch', 'localtime')) = strftime('%Y', 'now', 'localtime')`;
      break;
    case 'monthly':
      dateFilter = `strftime('%m', datetime(created_at/1000, 'unixepoch', 'localtime')) = strftime('%m', 'now', 'localtime')
                    AND strftime('%Y', datetime(created_at/1000, 'unixepoch', 'localtime')) = strftime('%Y', 'now', 'localtime')`;
      break;
    case 'once':
      // For once tasks, check if it's ever been completed
      dateFilter = '1=1';
      break;
    default:
      return false;
  }

  // F53: Use direct columns instead of JSON metadata
  const result = await db.execute({
    sql: `
      SELECT COUNT(*) as count FROM transcripts
      WHERE type = 'task'
        AND task_id = ?
        AND task_status IN ('reminder', 'completed')
        AND ${dateFilter}
    `,
    args: [task.id],
  });

  return Number(result.rows[0].count) > 0;
}

/**
 * Check if current time is within task's time window
 * Returns: 'before' | 'within' | 'after' | 'no-window'
 */
function checkTimeWindow(task: KittTask): 'before' | 'within' | 'after' | 'no-window' {
  if (!task.time_window_start && !task.time_window_end) {
    return 'no-window';
  }

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Add grace period to end time
  let effectiveEnd = task.time_window_end;
  if (effectiveEnd && task.grace_period_minutes > 0) {
    const [endHour, endMin] = effectiveEnd.split(':').map(Number);
    const endDate = new Date();
    endDate.setHours(endHour, endMin + task.grace_period_minutes, 0, 0);
    effectiveEnd = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
  }

  if (task.time_window_start && currentTime < task.time_window_start) {
    return 'before';
  }

  if (effectiveEnd && currentTime > effectiveEnd) {
    return 'after';
  }

  return 'within';
}

// ==========================================
// Task Logging
// ==========================================

/**
 * Log a task execution to the transcripts table
 *
 * F53: Uses dedicated columns instead of JSON metadata:
 * - type = 'task'
 * - role = 'kitt' (KITT is logging the task execution)
 * - task_id = FK to kitt_tasks.id
 * - task_status = 'reminder' | 'completed' | 'skipped' | 'deferred'
 */
export async function logTaskExecution(
  db: Client,
  execution: TaskExecution
): Promise<string> {
  const id = generateId();
  const timestamp = Date.now();

  const content = `Task "${execution.task_title}": ${execution.status}${execution.notes ? ` - ${execution.notes}` : ''}`;

  // F53: Use direct columns for task_id and task_status
  await db.execute({
    sql: `INSERT INTO transcripts (id, session_id, channel, role, type, content, task_id, task_status, metadata, created_at)
          VALUES (?, 'think-loop', 'think-loop', 'kitt', 'task', ?, ?, ?, ?, ?)`,
    args: [
      id,
      content,
      execution.task_id,
      execution.status,
      JSON.stringify({ notes: execution.notes }),
      timestamp,
    ],
  });

  console.log(`[task-engine] 📝 Logged: task #${execution.task_id} "${execution.task_title}" = ${execution.status}`);

  return id;
}

/**
 * Get task execution history for a specific task
 *
 * F53: Uses task_id and task_status columns
 */
export async function getTaskHistory(
  db: Client,
  taskId: number,
  limit = 10
): Promise<Array<{ status: TaskStatus; executed_at: Date; notes?: string }>> {
  const result = await db.execute({
    sql: `
      SELECT
        task_status,
        json_extract(metadata, '$.notes') as notes,
        created_at
      FROM transcripts
      WHERE type = 'task'
        AND task_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `,
    args: [taskId, limit],
  });

  return result.rows.map((row) => ({
    status: String(row.task_status) as TaskStatus,
    executed_at: new Date(Number(row.created_at)),
    notes: row.notes ? String(row.notes) : undefined,
  }));
}

/**
 * Count how many times a task has been executed today
 *
 * F53: Uses task_id column
 */
export async function getTaskAttemptCountToday(db: Client, taskId: number): Promise<number> {
  const result = await db.execute({
    sql: `
      SELECT COUNT(*) as count FROM transcripts
      WHERE type = 'task'
        AND task_id = ?
        AND date(created_at/1000, 'unixepoch', 'localtime') = date('now', 'localtime')
    `,
    args: [taskId],
  });

  return Number(result.rows[0].count);
}

/**
 * Check if a task was executed today with specific status(es)
 *
 * F53: Helper for agent to check task execution status
 *
 * @param taskId - The task ID to check
 * @param statuses - Array of statuses to check for (default: ['reminder', 'completed'])
 * @returns true if task was executed today with one of the statuses
 */
export async function wasTaskExecutedToday(
  db: Client,
  taskId: number,
  statuses: TaskStatus[] = ['reminder', 'completed']
): Promise<boolean> {
  const placeholders = statuses.map(() => '?').join(', ');
  const result = await db.execute({
    sql: `
      SELECT 1 FROM transcripts
      WHERE type = 'task'
        AND task_id = ?
        AND task_status IN (${placeholders})
        AND date(created_at/1000, 'unixepoch', 'localtime') = date('now', 'localtime')
      LIMIT 1
    `,
    args: [taskId, ...statuses],
  });
  return result.rows.length > 0;
}

// ==========================================
// Task Management
// ==========================================

/**
 * Snooze a task until a specific time
 */
export async function snoozeTask(
  db: Client,
  taskId: number,
  untilTimestamp: number
): Promise<void> {
  await db.execute({
    sql: 'UPDATE kitt_tasks SET snoozed_until = ? WHERE id = ?',
    args: [untilTimestamp, taskId],
  });
}

/**
 * Snooze all tasks with a specific skill reference
 */
export async function snoozeTasksBySkill(
  db: Client,
  skillName: string,
  untilTimestamp: number
): Promise<number> {
  const result = await db.execute({
    sql: `UPDATE kitt_tasks SET snoozed_until = ? WHERE skill_refs LIKE ?`,
    args: [untilTimestamp, `%"${skillName}"%`],
  });

  return result.rowsAffected;
}

/**
 * Clear snooze from a task
 */
export async function unsnoozeTask(db: Client, taskId: number): Promise<void> {
  await db.execute({
    sql: 'UPDATE kitt_tasks SET snoozed_until = NULL WHERE id = ?',
    args: [taskId],
  });
}

/**
 * Set next_run timestamp for retry scheduling
 */
export async function setTaskNextRun(
  db: Client,
  taskId: number,
  nextRun: number | null
): Promise<void> {
  await db.execute({
    sql: 'UPDATE kitt_tasks SET next_run = ? WHERE id = ?',
    args: [nextRun, taskId],
  });
}

/**
 * Create a new task (for KITT to create tasks on-the-fly)
 */
export async function createTask(
  db: Client,
  task: {
    title: string;
    description?: string;
    frequency?: TaskFrequency;
    priority?: TaskPriority;
    skill_refs?: string[];
    time_window_start?: string;
    time_window_end?: string;
    created_by?: 'kitt' | 'renier';
  }
): Promise<number> {
  const result = await db.execute({
    sql: `INSERT INTO kitt_tasks (title, description, frequency, priority, skill_refs, time_window_start, time_window_end, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      task.title,
      task.description || null,
      task.frequency || 'once',
      task.priority || 'medium',
      task.skill_refs ? JSON.stringify(task.skill_refs) : null,
      task.time_window_start || null,
      task.time_window_end || null,
      task.created_by || 'kitt',
    ],
  });

  return Number(result.lastInsertRowid);
}

/**
 * Delete a completed "once" task
 */
export async function deleteTask(db: Client, taskId: number): Promise<void> {
  await db.execute({
    sql: 'DELETE FROM kitt_tasks WHERE id = ?',
    args: [taskId],
  });
}

// ==========================================
// Helpers
// ==========================================

function parseSkillRefs(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Parse depends_on from JSON string to number array
 * F54: Supports both legacy INTEGER and new JSON array format
 */
function parseDependsOn(value: unknown): number[] | null {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  // Backwards compat: single number
  if (typeof value === 'number') {
    return [value];
  }
  return null;
}

function generateId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
