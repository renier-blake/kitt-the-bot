/**
 * Task Engine Loader
 *
 * Loads open tasks from kitt_tasks table for think loop.
 * Only used in think mode.
 *
 * Uses the canonical task engine from scheduler for actual logic.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { LoaderContext } from '../types.js';
import { getOpenTasks } from '../../scheduler/task-engine.js';

// Re-export for convenience
export { getOpenTasks };

// Use KittTask from scheduler for consistency
import type { KittTask as SchedulerKittTask } from '../../scheduler/task-engine.js';

/**
 * Load skill content for a task
 */
function loadSkillContentForTask(skillName: string): string | null {
  const skillPath = path.join(process.cwd(), '.claude/skills', skillName, 'SKILL.md');
  try {
    const content = fs.readFileSync(skillPath, 'utf-8');
    return content.replace(/^---\n[\s\S]*?\n---\n*/, '').trim();
  } catch {
    return null;
  }
}

/**
 * Format tasks for think loop prompt
 */
function formatTasks(
  tasks: SchedulerKittTask[],
  skippedReasons: Map<number, string>
): string {
  if (tasks.length === 0 && skippedReasons.size === 0) {
    return 'Geen open taken op dit moment.';
  }

  const formatTask = (t: SchedulerKittTask) => {
    const timeWindow =
      t.time_window_start && t.time_window_end
        ? ` (${t.time_window_start}-${t.time_window_end})`
        : '';

    // Load skill content for this task
    let skillSection = '';
    if (t.skill_refs.length > 0) {
      const skillContent = loadSkillContentForTask(t.skill_refs[0]);
      if (skillContent) {
        skillSection = `\n\n<skill-instructions for="${t.skill_refs[0]}">\n${skillContent}\n</skill-instructions>`;
      }
    }

    return `- **#${t.id}: ${t.title}** [${t.priority}]${timeWindow}${t.description ? `\n  ${t.description}` : ''}${skillSection}`;
  };

  const tasksList = tasks.length > 0
    ? tasks.map(formatTask).join('\n')
    : 'Geen open taken op dit moment.';

  // Add skipped tasks for visibility
  const skippedSection = skippedReasons.size > 0
    ? `\n\n**Overgeslagen taken:**\n${Array.from(skippedReasons.entries()).map(([id, reason]) => `- Task #${id}: ${reason}`).join('\n')}`
    : '';

  return tasksList + skippedSection;
}

/**
 * Task engine loader - main entry point
 */
export async function taskEngineLoader(
  context: LoaderContext
): Promise<string | null> {
  const { db } = context;

  if (!db) {
    return null;
  }

  try {
    const { tasks, skippedReasons } = await getOpenTasks(db);
    return formatTasks(tasks, skippedReasons);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.warn('[task-engine] Failed:', errorMessage);
    return 'Fout bij laden van taken.';
  }
}
