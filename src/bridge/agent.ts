/**
 * KITT Agent - Claude Agent SDK wrapper
 * Provides full agent capabilities (tools, session persistence)
 * With KITT personality injection
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { log } from './logger.js';
import { getKITTSystemPrompt } from './context.js';

export interface AgentResponse {
  result: string | null;
  sessionId: string;
  error?: string;
  sessionFailed?: boolean; // True if session resume failed (should clear and retry)
}

export type AgentModel = 'haiku' | 'sonnet' | 'opus';

export interface AgentOptions {
  sessionId?: string;
  model?: AgentModel;
  skillContext?: string; // Full skill content to inject into system prompt
  skipMemorySearch?: boolean; // Skip memory search (for think loop - already has context)
}

const KITT_WORKSPACE = process.env.KITT_WORKSPACE || process.cwd();

/**
 * Run the Claude agent with full tool access
 * @param prompt - The prompt to send to the agent
 * @param options - Optional: sessionId for resume, model for model selection
 */
export async function runAgent(
  prompt: string,
  options?: AgentOptions | string // string for backwards compatibility (sessionId)
): Promise<AgentResponse> {
  // Handle backwards compatibility: if options is a string, it's the sessionId
  const opts: AgentOptions = typeof options === 'string' ? { sessionId: options } : options || {};

  let result: string | null = null;
  let newSessionId: string | undefined;

  // Log model being used (SDK uses latest version of each model family)
  const modelUsed = opts.model || 'default (SDK decides)';
  log.info('Starting agent', {
    hasSession: !!opts.sessionId,
    model: modelUsed,
    promptLength: prompt.length,
    workspace: KITT_WORKSPACE,
  });
  console.log(`[agent] 🤖 Model: ${modelUsed}`);

  // Track timing for session health detection
  const startTime = Date.now();
  const isResumingSession = !!opts.sessionId;

  try {
    // Load KITT personality and context
    // Skip memory search for think loop (already has all context, and prompt is too large to embed)
    let systemPrompt = await getKITTSystemPrompt(opts.skipMemorySearch ? undefined : prompt);

    // Inject skill context if provided (for skill routing)
    if (opts.skillContext) {
      systemPrompt += `\n\n---\n\n# Active Skill Context\n\n${opts.skillContext}`;
      log.debug('Skill context injected', { skillLength: opts.skillContext.length });
    }

    log.debug('System prompt loaded', { length: systemPrompt.length });

    for await (const message of query({
      prompt,
      options: {
        cwd: KITT_WORKSPACE,
        resume: opts.sessionId,
        systemPrompt,
        model: opts.model, // haiku, sonnet, or opus
        allowedTools: [
          'Bash',
          'Read',
          'Write',
          'Edit',
          'Glob',
          'Grep',
          'WebSearch',
          'WebFetch',
        ],
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
      },
    })) {
      // Capture session ID from init message
      if (message.type === 'system' && message.subtype === 'init') {
        newSessionId = message.session_id;
        log.debug('Session initialized', { sessionId: newSessionId });
      }

      // Capture final result
      if ('result' in message && message.result) {
        result = message.result as string;
      }
    }

    const elapsed = Date.now() - startTime;

    // Detect potential session corruption:
    // If we were resuming a session and got no result in under 10 seconds,
    // the session might be corrupted or conflicting
    const sessionMightBeFailed = isResumingSession && !result && elapsed < 10000;

    if (sessionMightBeFailed) {
      log.warn('Possible session corruption detected', {
        sessionId: opts.sessionId,
        elapsed,
        hasResult: false,
      });
      console.log(`[agent] ⚠️ Session might be corrupted (no result in ${elapsed}ms)`);
    }

    log.info('Agent completed', {
      hasResult: !!result,
      resultLength: result?.length,
      sessionId: newSessionId || opts.sessionId,
      model: modelUsed,
      elapsed,
    });
    console.log(`[agent] ✅ Completed (${modelUsed}) - ${result?.length || 0} chars in ${elapsed}ms`);

    return {
      result,
      sessionId: newSessionId || opts.sessionId || '',
      sessionFailed: sessionMightBeFailed,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const elapsed = Date.now() - startTime;

    log.error('Agent error', { error: errorMessage, elapsed, isResumingSession });

    // If error occurred quickly while resuming, session might be bad
    const sessionMightBeFailed = isResumingSession && elapsed < 10000;

    return {
      result: null,
      sessionId: opts.sessionId || '',
      error: errorMessage,
      sessionFailed: sessionMightBeFailed,
    };
  }
}
