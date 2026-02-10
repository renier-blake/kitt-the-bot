/**
 * KITT Context System - Type Definitions
 *
 * Unified context building for both chat and think loop modes.
 */

import type { Client } from '@libsql/client';

// ==========================================
// Context Modes
// ==========================================

export type ContextMode = 'chat' | 'think';

// ==========================================
// Block Configuration (blocks.json)
// ==========================================

export interface BlocksConfig {
  version: number;
  blocks: ContextBlock[];
}

export type BlockType = 'file' | 'dynamic' | 'instruction';

export interface ContextBlock {
  /** Unique identifier for this block */
  id: string;

  /** Type of block: file, dynamic (loader), or instruction */
  type: BlockType;

  /** For file/instruction: path relative to project root */
  path?: string;

  /** For dynamic: name of the loader to use */
  source?: string;

  /** Section header in the prompt (e.g., "Who You Are") */
  header?: string;

  /** Which modes include this block */
  modes: ContextMode[];

  /** Sort order (lower = earlier in prompt) */
  priority: number;

  /** Can disable blocks without removing them */
  enabled: boolean;

  /** Loader-specific configuration */
  config?: Record<string, unknown>;
}

// ==========================================
// Build Options
// ==========================================

export interface BuildContextOptions {
  /** Which mode to build context for */
  mode: ContextMode;

  /** User query for memory search (chat mode) */
  userQuery?: string;

  /** Database client for dynamic loaders (think mode) */
  db?: Client;

  /** Override blocks.json location */
  configPath?: string;
}

// ==========================================
// Loader Types
// ==========================================

export interface LoaderContext {
  mode: ContextMode;
  userQuery?: string;
  db?: Client;
  config?: Record<string, unknown>;
}

export type DynamicLoader = (context: LoaderContext) => Promise<string | null>;

export interface LoaderRegistry {
  [name: string]: DynamicLoader;
}

// ==========================================
// Loader-Specific Types
// ==========================================

export interface SkillsLoaderConfig {
  chat?: { filter: 'all' | 'automated' };
  think?: { filter: 'all' | 'automated' };
}

export interface TranscriptLoaderConfig {
  chat?: { windowMinutes: number; maxMessages: number };
  think?: { windowMinutes: number; maxMessages: number };
}

export interface MemorySearchConfig {
  maxResults?: number;
  minScore?: number;
}

// ==========================================
// Skill Types (for skills-loader)
// ==========================================

export type SkillTrigger = 'every_time' | 'on_demand' | 'scheduled';

export interface SkillMetadata {
  name?: string;
  description?: string;
  kitt?: {
    emoji?: string;
    trigger?: SkillTrigger;
    fetch?: string;
    frequency?: 'daily' | 'weekly' | 'monthly';
    timesPerDay?: number;
    daypart?: 'morning' | 'afternoon' | 'evening' | 'night';
    schedule?: {
      frequency: 'daily' | 'weekly' | 'monthly';
      daypart?: 'morning' | 'afternoon' | 'evening' | 'night';
    };
  };
}

export interface LoadedSkill {
  id: string;
  name: string;
  description: string;
  emoji: string;
  trigger: SkillTrigger;
  content: string;
  // For scheduled skills
  frequency?: 'daily' | 'weekly' | 'monthly';
  timesPerDay?: number;
  daypart?: 'morning' | 'afternoon' | 'evening' | 'night';
  // For every_time skills
  fetch?: string;
  fetchResult?: string;
}

// ==========================================
// Conversation State Types (for think mode)
// ==========================================

export interface ConversationExchange {
  role: 'user' | 'kitt';
  type: 'message' | 'thought' | 'task';
  content: string;
  time: string;
  minutesAgo: number;
}

export interface ConversationState {
  recentExchanges: ConversationExchange[];
  conversationGap: number;
  unansweredUserMessages: Array<{
    content: string;
    time: string;
    minutesAgo: number;
  }>;
}

// Note: KittTask is defined in src/scheduler/task-engine.ts
// The task-engine loader imports it from there for consistency
