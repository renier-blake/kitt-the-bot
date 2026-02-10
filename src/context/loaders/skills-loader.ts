/**
 * Skills Loader
 *
 * Loads skills from .claude/skills/ directory.
 * - Chat mode: loads ALL skills
 * - Think mode: loads only 'every_time' and 'scheduled' skills
 */

import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type {
  LoaderContext,
  SkillMetadata,
  LoadedSkill,
  SkillTrigger,
  SkillsLoaderConfig,
} from '../types.js';

const execAsync = promisify(exec);

const SKILLS_DIR = process.env.KITT_SKILLS_DIR || './.claude/skills';

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

/**
 * Strip frontmatter from content
 */
function stripFrontmatter(content: string): string {
  return content.replace(/^---\n[\s\S]*?\n---\n*/, '').trim();
}

/**
 * Discover all skills from the skills directory
 */
export function discoverSkills(filter: 'all' | 'automated' = 'all'): LoadedSkill[] {
  const skills: LoadedSkill[] = [];
  const skillsDir = path.isAbsolute(SKILLS_DIR)
    ? SKILLS_DIR
    : path.join(process.cwd(), SKILLS_DIR);

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
      let trigger: SkillTrigger = metadata?.kitt?.trigger || 'on_demand';

      // Legacy support: convert schedule to trigger
      if (!metadata?.kitt?.trigger && metadata?.kitt?.schedule) {
        trigger = 'scheduled';
      }

      // Filter based on mode
      if (filter === 'automated') {
        // Only include every_time and scheduled skills for think loop
        if (trigger !== 'every_time' && trigger !== 'scheduled') {
          continue;
        }
      }

      const skillContent = stripFrontmatter(content);

      skills.push({
        id: entry.name,
        name: metadata?.name || entry.name,
        description: metadata?.description || '',
        emoji: metadata?.kitt?.emoji || '📋',
        trigger,
        content: skillContent,
        frequency: metadata?.kitt?.frequency || metadata?.kitt?.schedule?.frequency,
        timesPerDay: metadata?.kitt?.timesPerDay,
        daypart: metadata?.kitt?.daypart || metadata?.kitt?.schedule?.daypart,
        fetch: metadata?.kitt?.fetch,
      });
    } catch {
      // Skip invalid skill files
    }
  }

  return skills;
}

/**
 * Execute fetch commands for skills that have them
 */
async function executeSkillFetches(skills: LoadedSkill[]): Promise<void> {
  for (const skill of skills) {
    if (!skill.fetch) continue;

    try {
      const { stdout } = await execAsync(skill.fetch, { timeout: 10000 });
      skill.fetchResult = stdout.trim();
    } catch (err) {
      console.warn(
        `[skills-loader] Fetch failed for ${skill.id}:`,
        err instanceof Error ? err.message : String(err)
      );
      skill.fetchResult = undefined;
    }
  }
}

/**
 * Format skills for chat mode (simple list)
 */
function formatSkillsForChat(skills: LoadedSkill[]): string {
  return skills
    .map((skill) => `## ${skill.name}\n\n${skill.content}`)
    .join('\n\n---\n\n');
}

/**
 * Format skills for think mode (with schedule info and fetch results)
 */
function formatSkillsForThink(skills: LoadedSkill[]): string {
  const everyTimeSkills = skills.filter((s) => s.trigger === 'every_time');
  const scheduledSkills = skills.filter((s) => s.trigger === 'scheduled');

  const formatSkill = (s: LoadedSkill) => {
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

    // Include fetch result
    let dataSection = '';
    if (s.fetch) {
      dataSection = s.fetchResult
        ? `\n\n**Data:**\n${s.fetchResult}`
        : `\n\n**Data:** Gecheckt, geen items gevonden`;
    }

    // Include full skill content
    const skillSection = s.content
      ? `\n\n<skill-instructions>\n${s.content}\n</skill-instructions>`
      : '';

    return `### ${s.emoji} ${s.name}${schedule ? ` (${schedule})` : ''}\n${s.description}${dataSection}${skillSection}`;
  };

  const sections: string[] = [];

  if (everyTimeSkills.length > 0) {
    sections.push(
      `### Every-Time Skills (check elke keer)\n\n${everyTimeSkills.map(formatSkill).join('\n\n')}`
    );
  }

  if (scheduledSkills.length > 0) {
    sections.push(
      `### Scheduled Skills\n\n${scheduledSkills.map(formatSkill).join('\n\n')}`
    );
  }

  return sections.length > 0
    ? sections.join('\n\n---\n\n')
    : 'Geen skills geconfigureerd voor de think loop.';
}

/**
 * Skills loader - main entry point
 */
export async function skillsLoader(context: LoaderContext): Promise<string | null> {
  const config = context.config as SkillsLoaderConfig | undefined;

  // Determine filter based on mode
  const modeConfig = context.mode === 'chat' ? config?.chat : config?.think;
  const filter = modeConfig?.filter || (context.mode === 'chat' ? 'all' : 'automated');

  // Discover skills
  const skills = discoverSkills(filter);

  if (skills.length === 0) {
    return null;
  }

  // For think mode, execute fetch commands
  if (context.mode === 'think') {
    await executeSkillFetches(skills);
    return formatSkillsForThink(skills);
  }

  // For chat mode, simple format
  return formatSkillsForChat(skills);
}
