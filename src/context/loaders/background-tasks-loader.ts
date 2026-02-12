/**
 * Background Tasks Loader
 *
 * Loads active background tasks for Think Loop awareness.
 * This prevents the Think Loop from starting duplicate tasks
 * and allows it to report on long-running tasks.
 *
 * Only used in think mode.
 */

import type { LoaderContext } from '../types.js';
import { getActiveTasks, type BackgroundTask } from '../../scheduler/task-registry.js';

/**
 * Format a single task for display
 */
function formatTask(task: BackgroundTask): string {
  const elapsed = Date.now() - task.createdAt;
  const elapsedStr = formatDuration(elapsed);

  const status = task.status === 'running' ? '🔄 Running' : '⏳ Pending';

  return `- **${task.capabilityId}** [${status}] - ${elapsedStr}\n  ${task.description || task.prompt.slice(0, 100)}`;
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

/**
 * Format tasks for think loop prompt
 */
function formatTasks(tasks: BackgroundTask[]): string {
  if (tasks.length === 0) {
    return 'Geen actieve background tasks.';
  }

  const lines = tasks.map(formatTask);

  // Add warning for long-running tasks (> 5 minutes)
  const longRunning = tasks.filter((t) => Date.now() - t.createdAt > 5 * 60 * 1000);
  if (longRunning.length > 0) {
    lines.push(
      `\n**⚠️ Let op:** ${longRunning.length} task(s) draaien langer dan 5 minuten.`
    );
  }

  return lines.join('\n');
}

/**
 * Background tasks loader - main entry point
 */
export async function backgroundTasksLoader(
  _context: LoaderContext
): Promise<string | null> {
  try {
    const tasks = await getActiveTasks();

    if (tasks.length === 0) {
      return null; // Don't include empty section
    }

    return formatTasks(tasks);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.warn('[background-tasks-loader] Failed:', errorMessage);
    return null;
  }
}
