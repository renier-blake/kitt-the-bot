/**
 * KITT Context Service
 *
 * Thin wrapper around the unified context builder.
 * Maintains backward compatibility with existing code.
 */

import { buildContext } from '../context/index.js';
import type { Client } from '@libsql/client';

/**
 * Get the full KITT system prompt for chat mode.
 *
 * Uses the unified context builder which loads identity files,
 * skills, and optionally searches memory for relevant context.
 *
 * @param userQuery - Optional query to search memory for relevant context
 * @param db - Optional database client for transcript loading
 */
export async function getKITTSystemPrompt(userQuery?: string, db?: Client): Promise<string> {
  return buildContext({ mode: 'chat', userQuery, db });
}

/**
 * Get a lightweight system prompt for background agents.
 *
 * Loads only: user-info + core-instructions + time context.
 * Skill context is injected separately by the background runner.
 * ~5-10K chars instead of ~40K for chat mode.
 */
export async function getBackgroundSystemPrompt(): Promise<string> {
  return buildContext({ mode: 'background' });
}
