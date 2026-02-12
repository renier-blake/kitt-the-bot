/**
 * Skills Loader
 *
 * Loads skills from .claude/skills/ directory.
 * - Chat mode: loads ALL skills
 * - Think mode: loads only 'every_time' and 'scheduled' skills
 *
 * Skills metadata is enriched from the capabilities database when available.
 * The SKILL.md file remains the source of truth for actual skill instructions.
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
import {
  getCapabilitiesByCategory,
  getAgentMode,
  type Capability,
} from '../../capabilities/index.js';

const execAsync = promisify(exec);

const SKILLS_DIR = process.env.KITT_SKILLS_DIR || './.claude/skills';

// Cache for capabilities lookup
let capabilitiesCache: Map<string, Capability> | null = null;
let cacheTime = 0;
const CACHE_TTL = 60000; // 1 minute

/**
 * Get capabilities map from database (with caching)
 */
async function getCapabilitiesMap(): Promise<Map<string, Capability>> {
  const now = Date.now();

  if (capabilitiesCache && now - cacheTime < CACHE_TTL) {
    return capabilitiesCache;
  }

  try {
    const skills = await getCapabilitiesByCategory('skill');
    capabilitiesCache = new Map(skills.map((s) => [s.id, s]));
    cacheTime = now;
  } catch (err) {
    console.warn('[skills-loader] Failed to load capabilities from DB:', err);
    capabilitiesCache = new Map();
    cacheTime = now;
  }

  return capabilitiesCache;
}

/**
 * Check if a skill is enabled for the current mode
 */
async function isSkillEnabled(skillId: string): Promise<boolean> {
  try {
    const capabilities = await getCapabilitiesMap();
    const capability = capabilities.get(skillId);

    if (!capability) {
      // Not in DB = enabled by default (backwards compatibility)
      return true;
    }

    if (!capability.enabled) {
      return false;
    }

    // Check mode
    const currentMode = await getAgentMode();
    return capability.modes.includes(currentMode);
  } catch {
    return true; // Fail open
  }
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

/**
 * Strip frontmatter from content
 */
function stripFrontmatter(content: string): string {
  return content.replace(/^---\n[\s\S]*?\n---\n*/, '').trim();
}

/**
 * Discover all skills from the skills directory
 * Now async to support checking capabilities DB
 */
export async function discoverSkills(filter: 'all' | 'automated' = 'all'): Promise<LoadedSkill[]> {
  const skills: LoadedSkill[] = [];
  const skillsDir = path.isAbsolute(SKILLS_DIR)
    ? SKILLS_DIR
    : path.join(process.cwd(), SKILLS_DIR);

  if (!fs.existsSync(skillsDir)) {
    return skills;
  }

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

  // Get capabilities for enrichment
  const capabilities = await getCapabilitiesMap();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillMdPath = path.join(skillsDir, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) continue;

    try {
      // Check if skill is enabled in DB
      const isEnabled = await isSkillEnabled(entry.name);
      if (!isEnabled) {
        continue;
      }

      const content = fs.readFileSync(skillMdPath, 'utf-8');
      const metadata = parseSkillMetadata(content);

      // Get capability from DB for enrichment
      const capability = capabilities.get(entry.name);

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
        name: capability?.name || metadata?.name || entry.name,
        description: capability?.description || metadata?.description || '',
        emoji: capability?.icon || metadata?.kitt?.emoji || '📋',
        trigger,
        content: skillContent,
        skillType: capability?.skillType || 'user',
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
 * Format skills for chat mode — dispatch catalog with BACKGROUND_TASK protocol.
 * Opus uses this to organically decide when to dispatch a skill.
 */
async function formatSkillsForChat(skills: LoadedSkill[]): Promise<string> {
  // Filter out 'direct' execution skills (interactive, not dispatchable)
  const capabilities = await getCapabilitiesMap();
  const dispatchable = skills.filter((skill) => {
    const cap = capabilities.get(skill.id);
    return !cap || cap.execution !== 'direct';
  });

  const skillList = dispatchable
    .map((skill) => `- **${skill.id}**: ${skill.description || skill.name}`)
    .join('\n');

  return `## Beschikbare Skills

Je hebt GEEN tools. Je kunt alleen tekst genereren.
Om externe data op te halen of acties uit te voeren, dispatch je een skill via het BACKGROUND_TASK signaal.

### Skills
${skillList}

### Wanneer Dispatchen

**ALTIJD dispatchen als:**
- De user vraagt naar informatie die je niet in je huidige context hebt
- De user vraagt over eerdere gesprekken, plannen, brainstorms, of iets uit het verleden → **memory-search**
- De user vraagt naar externe data (email, agenda, health, weer, etc.) → de relevante skill
- De user een actie wil (blog schrijven, email sturen, reminder zetten, etc.) → de relevante skill
- De user vraagt waarom iets misgaat, over errors, timeouts, logs, of jouw gedrag → **self-diagnostics** (OOK als je denkt dat je het uit context kunt afleiden — alleen logs en DB zijn betrouwbaar)

**NOOIT zelf proberen te beantwoorden als:**
- Het antwoord niet in je recente context (laatste 15 min) staat
- Je zou moeten "gokken" of "uit je hoofd" antwoorden
- De vraag gaat over errors, performance, of technische problemen — dispatch altijd

**BELANGRIJK:** Genereer je antwoord SNEL (max 1-2 zinnen + dispatch signaal). Ga NIET lang nadenken over het antwoord. Twijfel = dispatch.

### Dispatch Format

1. Geef EERST een kort natuurlijk antwoord (max 1-2 zinnen)
2. Zet op de LAATSTE regel: BACKGROUND_TASK:{"skill":"skill-id","prompt":"volledige instructie"}
3. De tekst vóór het signaal wordt naar de user gestuurd, het signaal zelf wordt gestript en gedispatcht`;
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

    // Include fetch result (valuable for decision-making, e.g. "3 flagged reminders")
    let dataSection = '';
    if (s.fetch) {
      dataSection = s.fetchResult
        ? `\n\n**Data:**\n${s.fetchResult}`
        : `\n\n**Data:** Gecheckt, geen items gevonden`;
    }

    // NOTE: Full skill instructions are NOT included here.
    // The think loop only needs to DECIDE which task to execute.
    // Full skill content is loaded by sub-agent pre-processing (scheduler Phase 3)
    // when a task is actually executed. This saves ~48K per tick.

    return `### ${s.emoji} ${s.name}${schedule ? ` (${schedule})` : ''}\n${s.description}${dataSection}`;
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

  // Discover skills (now async - checks DB for enabled status)
  const skills = await discoverSkills(filter);

  if (skills.length === 0) {
    return null;
  }

  // For think mode, execute fetch commands
  if (context.mode === 'think') {
    await executeSkillFetches(skills);
    return formatSkillsForThink(skills);
  }

  // For chat mode, simple format (filters out non-dispatchable skills)
  return await formatSkillsForChat(skills);
}
