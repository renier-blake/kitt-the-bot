/**
 * Context Loaders - Index
 *
 * Exports all dynamic loaders and provides a registry.
 */

import type { LoaderRegistry } from '../types.js';
import { skillsLoader } from './skills-loader.js';
import { transcriptLoader } from './transcript-loader.js';
import { memorySearchLoader } from './memory-search.js';
import { taskEngineLoader } from './task-engine.js';
import { conversationStateLoader } from './conversation-state.js';

// Export individual loaders
export { loadFile, readFileSafe } from './file-loader.js';
export { skillsLoader, discoverSkills } from './skills-loader.js';
export { transcriptLoader } from './transcript-loader.js';
export { memorySearchLoader } from './memory-search.js';
export { taskEngineLoader } from './task-engine.js';
export { conversationStateLoader } from './conversation-state.js';

/**
 * Registry of all available dynamic loaders
 * Keys match the 'source' field in blocks.json
 */
export const loaderRegistry: LoaderRegistry = {
  'skills-loader': skillsLoader,
  'transcript-loader': transcriptLoader,
  'memory-search': memorySearchLoader,
  'task-engine': taskEngineLoader,
  'conversation-state': conversationStateLoader,
};
