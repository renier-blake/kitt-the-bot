/**
 * KITT Context Service
 *
 * Thin wrapper around the unified context builder.
 * Maintains backward compatibility with existing code.
 */

import { buildContext } from '../context/index.js';

/**
 * Get the full KITT system prompt for chat mode.
 *
 * Uses the unified context builder which loads identity files,
 * skills, and optionally searches memory for relevant context.
 *
 * @param userQuery - Optional query to search memory for relevant context
 */
export async function getKITTSystemPrompt(userQuery?: string): Promise<string> {
  return buildContext({ mode: 'chat', userQuery });
}
