/**
 * KITT Context Service
 * Loads KITT personality and user context for system prompt injection
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const PROFILE_DIR = process.env.KITT_PROFILE_DIR || './profile';

export interface KITTContext {
  identity: string;
  soul: string;
  userInfo: string;
  workingMemory: string;
  memorySearchResults?: string;
  skills?: string; // All skill instructions
}

const SKILLS_DIR = process.env.KITT_SKILLS_DIR || './.claude/skills';

/**
 * Read a file safely, returning empty string on error
 */
async function readFileSafe(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Load all skill instructions from .claude/skills/
 */
async function loadAllSkills(): Promise<string> {
  try {
    const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
    const skillDirs = entries.filter(e => e.isDirectory());

    const skills: string[] = [];

    for (const dir of skillDirs) {
      const skillPath = path.join(SKILLS_DIR, dir.name, 'SKILL.md');
      try {
        const content = await fs.readFile(skillPath, 'utf-8');
        // Strip frontmatter and get skill content
        const stripped = content.replace(/^---\n[\s\S]*?\n---\n*/, '').trim();
        if (stripped) {
          skills.push(`## ${dir.name}\n\n${stripped}`);
        }
      } catch {
        // Skip skills without SKILL.md
      }
    }

    return skills.join('\n\n---\n\n');
  } catch (err) {
    console.warn('[context] Could not load skills:', err);
    return '';
  }
}

/**
 * Search memory for relevant context based on user query
 */
async function searchMemoryForContext(query: string): Promise<string | undefined> {
  try {
    // Lazy import to avoid circular dependencies
    const { getMemoryService } = await import('../memory/index.js');
    const memory = getMemoryService();

    const results = await memory.search(query, {
      maxResults: 5,
      minScore: 0.4, // Only include reasonably relevant results
    });

    if (results.length === 0) {
      return undefined;
    }

    // Format results as context
    const formatted = results.map((r, i) => {
      const source = r.source === 'transcript' ? '💬 Gesprek' : '📝 Memory';
      return `${i + 1}. [${source}] (score: ${r.score.toFixed(2)})\n${r.snippet}`;
    });

    return formatted.join('\n\n');
  } catch (err) {
    // Memory search is optional - don't fail the whole request
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.warn('[context] Memory search failed:', errorMessage);
    return undefined;
  }
}

/**
 * Load all KITT context files
 * @param userQuery - Optional query to search memory for relevant context
 */
export async function loadContext(userQuery?: string): Promise<KITTContext> {
  const [identity, soul, userInfo, workingMemory, skills] = await Promise.all([
    readFileSafe(path.join(PROFILE_DIR, 'identity/IDENTITY.md')),
    readFileSafe(path.join(PROFILE_DIR, 'identity/SOUL.md')),
    readFileSafe(path.join(PROFILE_DIR, 'user/USER.md')),
    readFileSafe(path.join(PROFILE_DIR, 'memory/MEMORY.md')),
    loadAllSkills(),
  ]);

  // Search memory if query provided
  let memorySearchResults: string | undefined;
  if (userQuery) {
    memorySearchResults = await searchMemoryForContext(userQuery);
  }

  return { identity, soul, userInfo, workingMemory, memorySearchResults, skills };
}

/**
 * Build the system prompt from context
 */
export function buildSystemPrompt(context: KITTContext): string {
  const sections: string[] = [];

  if (context.identity) {
    sections.push(`# Who You Are\n\n${context.identity}`);
  }

  if (context.soul) {
    sections.push(`# Your Soul & Values\n\n${context.soul}`);
  }

  if (context.userInfo) {
    sections.push(`# About Your Human\n\n${context.userInfo}`);
  }

  if (context.workingMemory) {
    sections.push(`# Your Working Memory\n\n${context.workingMemory}`);
  }

  if (context.memorySearchResults) {
    sections.push(`# Relevant Memory Context\n\nDeze informatie is gevonden in je long-term memory die mogelijk relevant is voor de vraag:\n\n${context.memorySearchResults}`);
  }

  // Add core instructions
  sections.push(`# Core Instructions

- Je bent KITT, niet Claude. Antwoord vanuit je eigen identiteit.
- Gebruik Nederlands tenzij anders gevraagd.
- Wees direct, een beetje brutaal, en pro-actief.
- Als iemand zegt "onthoud dit" of "remember", bevestig dat je het hebt onthouden.
- Geef code voorbeelden in markdown code blocks.`);

  // Add skills
  if (context.skills) {
    sections.push(`# Skills

Je hebt de volgende skills. Volg de instructies wanneer relevant.

${context.skills}`);
  }

  // Add internal capabilities
  sections.push(`# Internal Capabilities

## Memory Search (Semantic)
Zoek in gesprekken en memory met semantic/vector search.

\`\`\`bash
npm run search -- "zoekterm" [options]
\`\`\`

**Opties:**
- \`-l 20\` - Meer resultaten (default: 10)
- \`--exact\` - Keyword search ipv semantic (voor exacte matches)
- \`--json\` - Output als JSON

**Wanneer gebruiken:**
- User vraagt naar eerdere gesprekken
- Je wilt checken of je iets al gedaan hebt
- Je zoekt context uit het verleden

## Sleep & DND Mode (F73)
Beheer je slaap- en stiltemodaliteiten.

\`\`\`bash
npm run mode -- status              # Huidige status
npm run mode -- sleep               # Slaap onbeperkt
npm run mode -- sleep 6:55          # Slaap tot 6:55 + wake-up bericht
npm run mode -- sleep 6:55 --no-wake  # Slaap zonder wake-up
npm run mode -- dnd 2h              # Stil voor 2 uur
npm run mode -- dnd 14:00           # Stil tot 14:00
npm run mode -- wake                # Word wakker (clear alle modes)
\`\`\`

**Wanneer gebruiken:**
- "Ik ga slapen" → \`npm run mode -- sleep\`
- "Maak me wakker om 7:00" → \`npm run mode -- sleep 7:00\`
- "Wees even stil" / "Do not disturb" → \`npm run mode -- dnd 2h\`
- Sleep = KITT doet helemaal niks
- DND = KITT werkt door maar stuurt geen berichten`);

  return sections.join('\n\n---\n\n');
}

/**
 * Get the full KITT system prompt
 * @param userQuery - Optional query to search memory for relevant context
 */
export async function getKITTSystemPrompt(userQuery?: string): Promise<string> {
  const context = await loadContext(userQuery);
  return buildSystemPrompt(context);
}
