/**
 * KITT Context Builder
 *
 * Unified context building system that reads blocks.json configuration
 * and builds prompts for both chat and think loop modes.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  BlocksConfig,
  ContextBlock,
  BuildContextOptions,
  LoaderContext,
} from './types.js';
import { loadFile } from './loaders/file-loader.js';
import { loaderRegistry } from './loaders/index.js';

const DEFAULT_BLOCKS_PATH = './profile/context/blocks.json';

/**
 * Load and parse blocks.json configuration
 */
async function loadBlocksConfig(configPath?: string): Promise<BlocksConfig> {
  const blocksPath = configPath || DEFAULT_BLOCKS_PATH;
  const absolutePath = path.isAbsolute(blocksPath)
    ? blocksPath
    : path.join(process.cwd(), blocksPath);

  try {
    const content = await fs.readFile(absolutePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.warn('[context-builder] Failed to load blocks.json, using defaults:', err);
    return getDefaultBlocksConfig();
  }
}

/**
 * Default blocks configuration (fallback if blocks.json doesn't exist)
 */
function getDefaultBlocksConfig(): BlocksConfig {
  return {
    version: 1,
    blocks: [
      {
        id: 'identity',
        type: 'file',
        path: 'profile/identity/IDENTITY.md',
        header: 'Who You Are',
        modes: ['chat', 'think'],
        priority: 1,
        enabled: true,
      },
      {
        id: 'soul',
        type: 'file',
        path: 'profile/identity/SOUL.md',
        header: 'Your Soul & Values',
        modes: ['chat', 'think'],
        priority: 2,
        enabled: true,
      },
      {
        id: 'humor',
        type: 'file',
        path: 'profile/identity/HUMOR.md',
        header: 'Humor Style',
        modes: ['chat', 'think'],
        priority: 3,
        enabled: true,
      },
      {
        id: 'user-info',
        type: 'file',
        path: 'profile/user/USER.md',
        header: 'About Your Human',
        modes: ['chat', 'think'],
        priority: 10,
        enabled: true,
      },
      {
        id: 'working-memory',
        type: 'file',
        path: 'profile/identity/MEMORY.md',
        header: 'Your Working Memory',
        modes: ['chat', 'think'],
        priority: 11,
        enabled: true,
      },
      {
        id: 'skills',
        type: 'dynamic',
        source: 'skills-loader',
        header: 'Skills',
        modes: ['chat', 'think'],
        priority: 20,
        enabled: true,
        config: {
          chat: { filter: 'all' },
          think: { filter: 'automated' },
        },
      },
      {
        id: 'recent-transcripts',
        type: 'dynamic',
        source: 'transcript-loader',
        header: 'Recente Conversatie',
        modes: ['chat', 'think'],
        priority: 30,
        enabled: true,
        config: {
          chat: { windowMinutes: 15, maxMessages: 10 },
          think: { windowMinutes: 1440, maxMessages: 100 },
        },
      },
      {
        id: 'memory-search',
        type: 'dynamic',
        source: 'memory-search',
        header: 'Relevant Memory Context',
        modes: ['chat'],
        priority: 31,
        enabled: true,
        config: { maxResults: 5, minScore: 0.4 },
      },
      {
        id: 'conversation-state',
        type: 'dynamic',
        source: 'conversation-state',
        header: 'Conversatie Status',
        modes: ['think'],
        priority: 32,
        enabled: true,
      },
      {
        id: 'open-tasks',
        type: 'dynamic',
        source: 'task-engine',
        header: 'Open Taken (Task Engine)',
        modes: ['think'],
        priority: 40,
        enabled: true,
      },
      {
        id: 'core-instructions',
        type: 'instruction',
        path: 'profile/context/instructions/core.md',
        header: 'Core Instructions',
        modes: ['chat', 'think'],
        priority: 100,
        enabled: true,
      },
      {
        id: 'capabilities',
        type: 'instruction',
        path: 'profile/context/instructions/capabilities.md',
        header: 'Internal Capabilities',
        modes: ['chat', 'think'],
        priority: 101,
        enabled: true,
      },
      {
        id: 'think-loop-task',
        type: 'instruction',
        path: 'profile/context/instructions/think-loop.md',
        header: 'Jouw Taak',
        modes: ['think'],
        priority: 200,
        enabled: true,
      },
    ],
  };
}

/**
 * Load content for a single block
 */
async function loadBlockContent(
  block: ContextBlock,
  context: LoaderContext
): Promise<string | null> {
  switch (block.type) {
    case 'file':
    case 'instruction': {
      if (!block.path) return null;
      return loadFile(block.path, block.header);
    }

    case 'dynamic': {
      if (!block.source) return null;
      const loader = loaderRegistry[block.source];
      if (!loader) {
        console.warn(`[context-builder] Unknown loader: ${block.source}`);
        return null;
      }
      const content = await loader({
        ...context,
        config: block.config,
      });
      if (!content) return null;
      return block.header ? `# ${block.header}\n\n${content}` : content;
    }

    default:
      console.warn(`[context-builder] Unknown block type: ${block.type}`);
      return null;
  }
}

/**
 * Build context for the specified mode
 */
export async function buildContext(options: BuildContextOptions): Promise<string> {
  const { mode, userQuery, db, configPath } = options;

  // Load configuration
  const config = await loadBlocksConfig(configPath);

  // Filter and sort blocks
  const activeBlocks = config.blocks
    .filter((block) => block.enabled && block.modes.includes(mode))
    .sort((a, b) => a.priority - b.priority);

  // Build loader context
  const loaderContext: LoaderContext = {
    mode,
    userQuery,
    db,
  };

  // Load all blocks
  const sections: string[] = [];
  for (const block of activeBlocks) {
    try {
      const content = await loadBlockContent(block, loaderContext);
      if (content) {
        sections.push(content);
      }
    } catch (err) {
      console.warn(`[context-builder] Failed to load block ${block.id}:`, err);
    }
  }

  // Add time context for think mode
  if (mode === 'think') {
    const now = new Date();
    const days = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
    const time = now.toLocaleTimeString('nl-NL', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Amsterdam',
    });
    const dayOfWeek = days[now.getDay()];
    const dayOfMonth = now.getDate();

    // Calculate week of year
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekOfYear = Math.ceil(
      ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
    );

    const timeContext = `# Context\n\n**Tijd:** ${time} op ${dayOfWeek} (dag ${dayOfMonth}, week ${weekOfYear})`;

    // Insert time context near the beginning (after identity blocks)
    const insertIndex = sections.findIndex((s) => s.includes('# Skills') || s.includes('# Recente'));
    if (insertIndex > 0) {
      sections.splice(insertIndex, 0, timeContext);
    } else {
      sections.unshift(timeContext);
    }
  }

  // Join sections with separators
  return sections.join('\n\n---\n\n');
}

/**
 * Backwards-compatible function for chat mode
 * @deprecated Use buildContext({ mode: 'chat', userQuery }) instead
 */
export async function getKITTSystemPrompt(userQuery?: string): Promise<string> {
  return buildContext({ mode: 'chat', userQuery });
}
