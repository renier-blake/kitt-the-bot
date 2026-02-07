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
}

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
  const [identity, soul, userInfo, workingMemory] = await Promise.all([
    readFileSafe(path.join(PROFILE_DIR, 'identity/IDENTITY.md')),
    readFileSafe(path.join(PROFILE_DIR, 'identity/SOUL.md')),
    readFileSafe(path.join(PROFILE_DIR, 'user/USER.md')),
    readFileSafe(path.join(PROFILE_DIR, 'memory/MEMORY.md')),
  ]);

  // Search memory if query provided
  let memorySearchResults: string | undefined;
  if (userQuery) {
    memorySearchResults = await searchMemoryForContext(userQuery);
  }

  return { identity, soul, userInfo, workingMemory, memorySearchResults };
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

  // Add internal capabilities
  sections.push(`# Internal Capabilities

## Skills
Je hebt skills in \`.claude/skills/\`. Check met \`ls .claude/skills/\` welke er zijn.
Voor health data (hartslag, slaap, stappen): **garmin** skill.
Lees altijd eerst de SKILL.md voor instructies.

## Memory Search (Semantic)
Zoek in gesprekken en memory met semantic/vector search.

\`\`\`bash
npm run search -- "zoekterm" [options]
\`\`\`

**Opties:**
- \`-l 20\` - Meer resultaten (default: 10)
- \`--exact\` - Keyword search ipv semantic (voor exacte matches)
- \`--json\` - Output als JSON

**Voorbeelden:**
- \`npm run search -- "tandarts afspraak"\` → vindt ook "dokter", "kies"
- \`npm run search -- "herinnering training" -l 5\`
- \`npm run search -- "KITT" --exact\` → alleen letterlijke matches

**Wanneer gebruiken:**
- User vraagt naar eerdere gesprekken
- Je wilt checken of je iets al gedaan hebt
- Je zoekt context uit het verleden`);

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
