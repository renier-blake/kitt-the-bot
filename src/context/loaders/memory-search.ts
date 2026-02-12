/**
 * Memory Search Loader
 *
 * Performs semantic search on memory when a user query is provided.
 * Only used in chat mode. For temporal queries, the memory-search
 * skill handles direct DB queries via BACKGROUND_TASK.
 */

import type { LoaderContext, MemorySearchConfig } from '../types.js';

const DEFAULT_CONFIG: MemorySearchConfig = {
  maxResults: 5,
  minScore: 0.4,
};

/**
 * Memory search loader - main entry point
 */
export async function memorySearchLoader(
  context: LoaderContext
): Promise<string | null> {
  const { userQuery, config } = context;

  // Only search if we have a user query
  if (!userQuery) {
    return null;
  }

  const searchConfig = { ...DEFAULT_CONFIG, ...(config as MemorySearchConfig) };

  try {
    // Lazy import to avoid circular dependencies
    const { getMemoryService } = await import('../../memory/index.js');
    const memory = getMemoryService();

    const results = await memory.search(userQuery, {
      maxResults: searchConfig.maxResults,
      minScore: searchConfig.minScore,
    });

    if (results.length === 0) {
      return null;
    }

    // Format results as context
    const formatted = results.map((r, i) => {
      const source = r.source === 'transcript' ? 'Gesprek' : 'Memory';
      return `${i + 1}. [${source}] (score: ${r.score.toFixed(2)})\n${r.snippet}`;
    });

    return `Deze informatie is gevonden in je long-term memory die mogelijk relevant is voor de vraag:\n\n${formatted.join('\n\n')}`;
  } catch (err) {
    // Memory search is optional - don't fail the whole request
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.warn('[memory-search] Failed:', errorMessage);
    return null;
  }
}
