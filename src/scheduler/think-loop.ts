/**
 * KITT Think Loop - Autonomous Reflection
 *
 * The Think Loop is KITT's autonomous reflection mechanism. Every few minutes,
 * KITT "wakes up" and thinks about what's happening.
 *
 * Philosophy: MINIMAL HARDCODING
 * - We only collect data (transcripts, time, skills metadata)
 * - The agent reads everything and decides what to do
 * - No regex pattern matching, no rigid time windows
 * - The agent is intelligent enough to understand context
 *
 * Skill Trigger Types:
 * - every_time: Runs on every think loop tick (e.g., reminders)
 * - on_demand: Only when user asks (e.g., garmin, nutrition-log)
 * - scheduled: Specific times/frequencies (e.g., daily-reflection, nutrition-reminder)
 */

import type { Client } from '@libsql/client';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  getOpenTasks,
  type KittTask,
} from './task-engine.js';

const execAsync = promisify(exec);

// ==========================================
// Types
// ==========================================

export interface ThinkLoopContext {
  currentTime: string;
  currentHour: number;
  dayOfWeek: string;
  dayOfMonth: number;
  weekOfYear: number;
  transcripts: string;
  messageCount: number;
  lastUserMessage?: {
    content: string;
    time: string;
    minutesAgo: number;
  };
  skills: ThinkLoopSkill[];
  // Task Engine: open tasks
  tasks: KittTask[];
  taskSkippedReasons: Map<number, string>;
  // KITT identity context
  identity?: string;
  soul?: string;
  userInfo?: string;
  workingMemory?: string;
}

export type SkillTrigger = 'every_time' | 'on_demand' | 'scheduled';

export interface ThinkLoopSkill {
  id: string;
  name: string;
  description: string;
  emoji: string;
  trigger: SkillTrigger;
  // For scheduled skills
  frequency?: 'daily' | 'weekly' | 'monthly';
  timesPerDay?: number; // e.g., 3 for nutrition-reminder
  daypart?: 'morning' | 'afternoon' | 'evening' | 'night';
  // For every_time skills: command to fetch data
  fetch?: string;
  // Result of fetch command (populated at runtime)
  fetchResult?: string;
  // NOTE: skillContent removed - too large for think prompt, agent can read SKILL.md if needed
}

export interface ThinkLoopThought {
  shouldAct: boolean;
  action?: 'message' | 'remember' | 'reflect' | 'task';
  message?: string;
  memoryNote?: string;
  reflection?: string;
  reasoning?: string;
  // Task execution (when action === 'task')
  taskId?: number;
  taskTitle?: string;
  // F37: When true, task is completed (Phase 2) — store reflection, don't send to Telegram
  taskComplete?: boolean;
}

// ==========================================
// Skill Discovery
// ==========================================

interface SkillMetadata {
  name?: string;
  description?: string;
  kitt?: {
    emoji?: string;
    trigger?: SkillTrigger;
    // For every_time triggers: command to fetch data
    fetch?: string;
    // For scheduled triggers
    frequency?: 'daily' | 'weekly' | 'monthly';
    timesPerDay?: number;
    daypart?: 'morning' | 'afternoon' | 'evening' | 'night';
    // Legacy support
    schedule?: {
      frequency: 'daily' | 'weekly' | 'monthly';
      daypart?: 'morning' | 'afternoon' | 'evening' | 'night';
    };
  };
}

/**
 * Discover skills for the think loop from SKILL.md files
 * Only includes skills with trigger: every_time or scheduled
 * (on_demand skills are not included - they're user-initiated)
 */
export function discoverThinkLoopSkills(skillsDir: string): ThinkLoopSkill[] {
  const skills: ThinkLoopSkill[] = [];

  if (!fs.existsSync(skillsDir)) {
    return skills;
  }

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillMdPath = path.join(skillsDir, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) continue;

    try {
      const content = fs.readFileSync(skillMdPath, 'utf-8');
      const metadata = parseSkillMetadata(content);

      // Determine trigger type
      let trigger: SkillTrigger | undefined = metadata?.kitt?.trigger;

      // Legacy support: convert schedule to trigger
      if (!trigger && metadata?.kitt?.schedule) {
        trigger = 'scheduled';
      }

      // Only include every_time and scheduled skills
      if (trigger === 'every_time' || trigger === 'scheduled') {
        skills.push({
          id: entry.name,
          name: metadata?.name || entry.name,
          description: metadata?.description || '',
          emoji: metadata?.kitt?.emoji || '📋',
          trigger,
          frequency: metadata?.kitt?.frequency || metadata?.kitt?.schedule?.frequency,
          timesPerDay: metadata?.kitt?.timesPerDay,
          daypart: metadata?.kitt?.daypart || metadata?.kitt?.schedule?.daypart,
          fetch: metadata?.kitt?.fetch,
        });
      }
    } catch {
      // Skip invalid skill files
    }
  }

  return skills;
}

/**
 * Parse SKILL.md frontmatter metadata
 */
function parseSkillMetadata(content: string): SkillMetadata | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const frontmatter = match[1];
  const result: SkillMetadata = {};

  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  if (nameMatch) result.name = nameMatch[1].trim();

  const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
  if (descMatch) result.description = descMatch[1].trim();

  const metadataMatch = frontmatter.match(/^metadata:\s*(\{[\s\S]*?\})$/m);
  if (metadataMatch) {
    try {
      const metadata = JSON.parse(metadataMatch[1]);
      result.kitt = metadata?.kitt;
    } catch {
      // Invalid JSON, ignore
    }
  }

  return result;
}

// ==========================================
// Skill Data Fetching
// ==========================================

/**
 * Execute fetch commands for skills that have them
 * Populates skill.fetchResult with the command output
 */
async function executeSkillFetches(skills: ThinkLoopSkill[]): Promise<void> {
  for (const skill of skills) {
    if (!skill.fetch) continue;

    try {
      const { stdout } = await execAsync(skill.fetch, { timeout: 10000 });
      skill.fetchResult = stdout.trim();
      console.log(`[think-loop] Fetched data for ${skill.id}:`, skill.fetchResult.slice(0, 100));
    } catch (err) {
      console.warn(`[think-loop] Fetch failed for ${skill.id}:`, err instanceof Error ? err.message : String(err));
      skill.fetchResult = undefined;
    }
  }
}

// ==========================================
// Context Building
// ==========================================

const PROFILE_DIR = process.env.KITT_PROFILE_DIR || './profile';

/**
 * Read a file safely, returning empty string on error
 */
function readFileSafe(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Build context for the think loop
 */
export async function buildThinkLoopContext(
  db: Client,
  skillsDir = '.claude/skills'
): Promise<ThinkLoopContext> {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  // Get today's transcripts
  // F53: Include type column for proper role/type distinction
  const todayResult = await db.execute({
    sql: `SELECT role, type, content, created_at
          FROM transcripts
          WHERE created_at >= ?
          ORDER BY created_at ASC`,
    args: [startOfDay.getTime()],
  });

  // Format transcripts for the agent
  // F53: Use type='thought' instead of role='thought'
  const transcripts = todayResult.rows
    .map((row) => {
      const time = new Date(Number(row.created_at)).toLocaleTimeString('nl-NL', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Amsterdam',
      });
      // F53: Check type for thoughts, role for user/kitt
      const type = row.type || 'message';
      const isThought = type === 'thought';
      const isTask = type === 'task';
      const role = row.role === 'user' ? 'Renier'
        : isThought ? '🧠 KITT (gedachte)'
        : isTask ? '📋 KITT (task)'
        : 'KITT';
      const content = String(row.content);
      const preview = content.length > 200 ? content.slice(0, 200) + '...' : content;
      return `[${time}] ${role}: ${preview}`;
    })
    .join('\n');

  // Find last user message
  let lastUserMessage: ThinkLoopContext['lastUserMessage'];
  for (let i = todayResult.rows.length - 1; i >= 0; i--) {
    const row = todayResult.rows[i];
    if (row.role === 'user') {
      const msgTime = new Date(Number(row.created_at));
      const minutesAgo = Math.round((now.getTime() - msgTime.getTime()) / 60000);
      lastUserMessage = {
        content: String(row.content),
        time: msgTime.toLocaleTimeString('nl-NL', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Amsterdam',
        }),
        minutesAgo,
      };
      break;
    }
  }

  // Get skills for think loop (every_time + scheduled only)
  const skills = discoverThinkLoopSkills(skillsDir);

  // Execute fetch commands for skills that have them
  await executeSkillFetches(skills);

  // Load KITT identity context
  const identity = readFileSafe(path.join(PROFILE_DIR, 'identity/IDENTITY.md'));
  const soul = readFileSafe(path.join(PROFILE_DIR, 'identity/SOUL.md'));
  const userInfo = readFileSafe(path.join(PROFILE_DIR, 'user/USER.md'));
  const workingMemory = readFileSafe(path.join(PROFILE_DIR, 'memory/MEMORY.md'));

  // Calculate week of year
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekOfYear = Math.ceil(
    ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  );

  const days = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

  // Get open tasks from Task Engine
  const openTasksResult = await getOpenTasks(db);

  return {
    currentTime: now.toLocaleTimeString('nl-NL', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Amsterdam',
    }),
    currentHour: now.getHours(),
    dayOfWeek: days[now.getDay()],
    dayOfMonth: now.getDate(),
    weekOfYear,
    transcripts: transcripts || 'Geen gesprekken vandaag.',
    messageCount: todayResult.rows.length,
    lastUserMessage,
    skills,
    // Task Engine
    tasks: openTasksResult.tasks,
    taskSkippedReasons: openTasksResult.skippedReasons,
    // KITT identity
    identity: identity || undefined,
    soul: soul || undefined,
    userInfo: userInfo || undefined,
    workingMemory: workingMemory || undefined,
  };
}

// ==========================================
// Prompt Building
// ==========================================

/**
 * Build the think prompt
 */
export function buildThinkPrompt(context: ThinkLoopContext): string {
  // Format skills by trigger type
  const everyTimeSkills = context.skills.filter(s => s.trigger === 'every_time');
  const scheduledSkills = context.skills.filter(s => s.trigger === 'scheduled');

  const formatSkill = (s: ThinkLoopSkill) => {
    let schedule = '';
    if (s.trigger === 'scheduled') {
      if (s.timesPerDay) {
        schedule = `${s.timesPerDay}x per dag`;
      } else if (s.frequency) {
        schedule = s.frequency;
      }
      if (s.daypart) {
        schedule += schedule ? `, ${s.daypart}` : s.daypart;
      }
    }

    // Include fetch result - show "geen items" if fetch ran but returned empty
    let dataSection = '';
    if (s.fetch) {
      // Skill has a fetch command
      dataSection = s.fetchResult
        ? `\n\n**Data:**\n${s.fetchResult}`
        : `\n\n**Data:** ✅ Gecheckt, geen items gevonden`;
    }

    // NOTE: We deliberately do NOT include the full SKILL.md content here
    // The think loop prompt is already large (tasks, transcripts, identity, etc.)
    // Skills are referenced by name - the agent can read SKILL.md if needed via tools

    return `### ${s.emoji} ${s.name}${schedule ? ` (${schedule})` : ''}
${s.description}${dataSection}`;
  };

  const everyTimeSection = everyTimeSkills.length > 0
    ? `### Every-Time Skills (check elke keer)\n\n${everyTimeSkills.map(formatSkill).join('\n\n')}`
    : '';

  const scheduledSection = scheduledSkills.length > 0
    ? `### Scheduled Skills\n\n${scheduledSkills.map(formatSkill).join('\n\n')}`
    : '';

  const skillsSection = everyTimeSection || scheduledSection
    ? [everyTimeSection, scheduledSection].filter(Boolean).join('\n\n---\n\n')
    : 'Geen skills geconfigureerd voor de think loop.';

  // Format tasks from Task Engine (include ID for TASK action)
  const formatTask = (t: KittTask) => {
    const timeWindow = t.time_window_start && t.time_window_end
      ? ` (${t.time_window_start}-${t.time_window_end})`
      : '';
    const skillRef = t.skill_refs.length > 0
      ? ` → skill: ${t.skill_refs.join(', ')}`
      : '';
    return `- **#${t.id}: ${t.title}** [${t.priority}]${timeWindow}${skillRef}${t.description ? `\n  ${t.description}` : ''}`;
  };

  const tasksSection = context.tasks.length > 0
    ? context.tasks.map(formatTask).join('\n')
    : 'Geen open taken op dit moment.';

  // Format skipped tasks (for debugging/visibility)
  const skippedTasks = Array.from(context.taskSkippedReasons.entries());
  const skippedSection = skippedTasks.length > 0
    ? `\n\n**Overgeslagen taken:**\n${skippedTasks.map(([id, reason]) => `- Task #${id}: ${reason}`).join('\n')}`
    : '';

  // User activity
  const activityContext = context.lastUserMessage
    ? `Laatste bericht van Renier: "${context.lastUserMessage.content.slice(0, 100)}${context.lastUserMessage.content.length > 100 ? '...' : ''}" (${context.lastUserMessage.minutesAgo} min geleden)`
    : 'Geen berichten van Renier vandaag.';

  // Build identity section
  const identitySections: string[] = [];
  if (context.identity) {
    identitySections.push(`## Wie Je Bent\n\n${context.identity}`);
  }
  if (context.soul) {
    identitySections.push(`## Je Waarden\n\n${context.soul}`);
  }
  if (context.userInfo) {
    identitySections.push(`## Over Renier\n\n${context.userInfo}`);
  }
  if (context.workingMemory) {
    identitySections.push(`## Je Working Memory\n\n${context.workingMemory}`);
  }
  const identitySection = identitySections.length > 0
    ? identitySections.join('\n\n---\n\n') + '\n\n---\n\n'
    : '';

  return `# KITT Think Loop

${identitySection}## Context

**Tijd:** ${context.currentTime} op ${context.dayOfWeek} (dag ${context.dayOfMonth}, week ${context.weekOfYear})
**Berichten vandaag:** ${context.messageCount}
**${activityContext}**

---

## Gesprekken van vandaag

${context.transcripts}

---

## Open Taken (Task Engine)

${tasksSection}${skippedSection}

---

## Skills

${skillsSection}

---

## Jouw Taak

Denk na over de context hierboven:

1. **Open taken:** Bekijk de taken hierboven. Deze zijn al gefilterd door het systeem:
   - Binnen time window (of geen window gedefinieerd)
   - Niet gesnoozed
   - Nog niet uitgevoerd volgens frequentie (daily/weekly/etc.)
   - Dependencies voldaan
   → Als er open taken zijn, voer ze uit op volgorde van priority (high → medium → low)

2. **Every-time skills:** Check de data van elke skill. Zijn er items die aandacht nodig hebben?
   - Gebruik transcripts om te checken of je al recent hebt herinnerd

3. **Reflectie check:** Kijk of er reflectievragen zijn gestuurd vandaag (ochtend/avond) waar Renier op heeft gereageerd, maar waar nog geen samenvatting voor is (type='reflection'). Zo ja → lees \`.claude/skills/daily-reflection/SKILL.md\` en volg Fase 2 instructies.

4. **Wat is de juiste actie?**
   - Niets doen is vaak de beste keuze
   - Alleen bericht als het echt waardevol is

---

## Memory Search

Zoek in alle gesprekken en memory (semantic search):

\`\`\`bash
npm run search -- "tandarts afspraak"     # Vindt ook "dokter", "kies"
npm run search -- "herinnering" -l 20     # Meer resultaten
npm run search -- "KITT" --exact          # Alleen letterlijke matches
\`\`\`

---

## Response Format

**EERST:** Schrijf kort je reasoning (1-3 zinnen)

**DAN:** Kies één van:

\`\`\`
REASONING: [je korte analyse]
ACTION: OK
\`\`\`

OF voor een open task (gebruik het task ID uit de lijst hierboven):

\`\`\`
REASONING: [je korte analyse]
ACTION: TASK #2
[het bericht dat je wilt sturen voor deze task]
\`\`\`

OF voor een algemeen bericht (niet task-gerelateerd):

\`\`\`
REASONING: [je korte analyse]
ACTION: MESSAGE
[het bericht dat je wilt sturen]
\`\`\`

OF:

\`\`\`
REASONING: [je korte analyse]
ACTION: MEMORY
[wat je wilt onthouden]
\`\`\`

OF:

\`\`\`
REASONING: [je observatie/reflectie]
ACTION: REFLECT
\`\`\`

OF voor het afronden van een twee-fase taak (bijv. reflectie samenvatting opslaan):

\`\`\`
REASONING: [je korte analyse]
ACTION: COMPLETE_TASK #2
[samenvatting/inhoud om intern op te slaan — wordt NIET naar Telegram gestuurd]
\`\`\`

**BELANGRIJK:**
- Gebruik ACTION: TASK #id als je een open task uitvoert. Dit logt de task als uitgevoerd zodat deze niet steeds herhaald wordt.
- Gebruik ACTION: COMPLETE_TASK #id om een eerder gestuurde task af te ronden (bijv. reflectie-samenvatting opslaan nadat Renier heeft gereageerd). Dit stuurt GEEN bericht naar Telegram.`;
}

// ==========================================
// Response Parsing
// ==========================================

/**
 * Parse the agent's response
 */
export function parseThinkResponse(response: string): ThinkLoopThought {
  // Strip markdown bold markers (**) that the agent sometimes adds
  const trimmed = response.trim().replace(/\*\*/g, '');

  // Extract reasoning
  const reasoningMatch = trimmed.match(/REASONING:\s*(.+?)(?=ACTION:|$)/si);
  const reasoning = reasoningMatch ? reasoningMatch[1].trim() : undefined;

  // Check for ACTION: OK
  if (/ACTION:\s*OK/i.test(trimmed)) {
    return {
      shouldAct: false,
      reasoning,
    };
  }

  // F37: Check for ACTION: COMPLETE_TASK #id (Phase 2 — store reflection, no Telegram)
  // Must be checked BEFORE ACTION: TASK to avoid partial match
  const completeTaskMatch = trimmed.match(/ACTION:\s*COMPLETE_TASK\s*#(\d+)\s*\n([\s\S]+)$/i);
  if (completeTaskMatch) {
    return {
      shouldAct: true,
      action: 'task',
      taskId: parseInt(completeTaskMatch[1], 10),
      taskComplete: true,
      message: completeTaskMatch[2].trim(),
      reasoning,
    };
  }

  // Check for ACTION: TASK #id
  const taskMatch = trimmed.match(/ACTION:\s*TASK\s*#(\d+)\s*\n([\s\S]+)$/i);
  if (taskMatch) {
    return {
      shouldAct: true,
      action: 'task',
      taskId: parseInt(taskMatch[1], 10),
      message: taskMatch[2].trim(),
      reasoning,
    };
  }

  // Check for ACTION: MESSAGE
  const messageMatch = trimmed.match(/ACTION:\s*MESSAGE\s*\n([\s\S]+)$/i);
  if (messageMatch) {
    return {
      shouldAct: true,
      action: 'message',
      message: messageMatch[1].trim(),
      reasoning,
    };
  }

  // Check for ACTION: MEMORY
  const memoryMatch = trimmed.match(/ACTION:\s*MEMORY\s*\n([\s\S]+)$/i);
  if (memoryMatch) {
    return {
      shouldAct: true,
      action: 'remember',
      memoryNote: memoryMatch[1].trim(),
      reasoning,
    };
  }

  // Check for ACTION: REFLECT
  if (/ACTION:\s*REFLECT/i.test(trimmed)) {
    return {
      shouldAct: true,
      action: 'reflect',
      reflection: reasoning, // The reasoning IS the reflection
      reasoning,
    };
  }

  // Legacy support: HEARTBEAT_OK
  if (trimmed.toUpperCase().includes('HEARTBEAT_OK') || trimmed.toUpperCase() === 'OK') {
    return {
      shouldAct: false,
      reasoning: reasoning || 'No action needed',
    };
  }

  // Legacy support: MEMORY: prefix
  if (trimmed.toUpperCase().startsWith('MEMORY:')) {
    return {
      shouldAct: true,
      action: 'remember',
      memoryNote: trimmed.slice(7).trim(),
      reasoning,
    };
  }

  // If no format matched but there's content, assume it's a message
  if (trimmed.length > 0 && !trimmed.toUpperCase().includes('OK')) {
    return {
      shouldAct: true,
      action: 'message',
      message: trimmed,
      reasoning,
    };
  }

  return {
    shouldAct: false,
    reasoning: reasoning || 'Could not parse response',
  };
}
