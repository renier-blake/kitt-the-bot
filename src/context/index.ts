/**
 * KITT Context System
 *
 * Unified context building for both chat and think loop modes.
 * Configuration-driven via profile/context/blocks.json.
 *
 * Usage:
 *   // Chat mode (with optional memory search)
 *   const prompt = await buildContext({ mode: 'chat', userQuery: 'user message' });
 *
 *   // Think loop mode (with database access)
 *   const prompt = await buildContext({ mode: 'think', db });
 */

// Main exports
export { buildContext, getKITTSystemPrompt } from './builder.js';

// Types
export type {
  BlocksConfig,
  ContextBlock,
  ContextMode,
  BlockType,
  BuildContextOptions,
  LoaderContext,
  DynamicLoader,
  LoaderRegistry,
  // Skill types
  SkillTrigger,
  SkillMetadata,
  LoadedSkill,
  // Config types
  SkillsLoaderConfig,
  TranscriptLoaderConfig,
  MemorySearchConfig,
  // State types
  ConversationExchange,
  ConversationState,
} from './types.js';

// Loader utilities (for advanced usage)
export { loaderRegistry } from './loaders/index.js';
export { loadFile, readFileSafe } from './loaders/file-loader.js';
export { discoverSkills } from './loaders/skills-loader.js';
