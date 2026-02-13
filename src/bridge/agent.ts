/**
 * KITT Agent
 *
 * All agent calls go through the Agent SDK (Claude Code session auth).
 * No separate API keys needed — uses the same auth as Claude Code.
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { Client } from '@libsql/client';
import { log } from './logger.js';
import { getKITTSystemPrompt, getBackgroundSystemPrompt } from './context.js';
import { getAgentPool, type AgentType } from './agent-pool.js';

// ==========================================
// Types
// ==========================================

export interface AgentResponse {
  result: string | null;
  sessionId: string;
  error?: string;
  sessionFailed?: boolean;
}

export type AgentModel = 'haiku' | 'sonnet' | 'opus';

export interface AgentOptions {
  sessionId?: string;
  model?: AgentModel;
  skillContext?: string; // Full skill content to inject into system prompt
  skipMemorySearch?: boolean; // Skip memory search (for think loop - already has context)
  allowedTools?: string[]; // Override tools (empty [] for chat, FULL_TOOLS for background/think)
  db?: Client; // Database client for transcript/memory loading
  agentType?: AgentType; // For pool registration + timeout selection
  chatId?: string; // For pool tracking (which chat is this agent for?)
  capabilityId?: string; // For pool tracking (which skill/task?)
  timeoutMs?: number; // Override default timeout for this agent type
}

const KITT_WORKSPACE = process.env.KITT_WORKSPACE || process.cwd();

// ==========================================
// Agent SDK
// ==========================================

// Full tools: for background tasks and think loop
const FULL_TOOLS = ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebSearch', 'WebFetch'];

/**
 * Run the Claude agent (Agent SDK)
 * All calls go through the Agent Pool for registration, timeout, and observability.
 *
 * @param prompt - The prompt to send to the agent
 * @param options - Optional: sessionId for resume, model for model selection, agentType for pool
 */
export async function runAgent(
  prompt: string,
  options?: AgentOptions | string // string for backwards compatibility (sessionId)
): Promise<AgentResponse> {
  // Handle backwards compatibility: if options is a string, it's the sessionId
  const opts: AgentOptions = typeof options === 'string' ? { sessionId: options } : options || {};

  // Register with agent pool
  const pool = getAgentPool();
  const agentType = opts.agentType || 'chat';
  const timeoutMs = opts.timeoutMs || pool.getDefaultTimeout(agentType);
  const { agentId, abortController } = pool.register(agentType, {
    chatId: opts.chatId,
    capabilityId: opts.capabilityId,
  });

  let result: string | null = null;
  let newSessionId: string | undefined;

  // Log model being used (SDK uses latest version of each model family)
  const modelUsed = opts.model || 'default (SDK decides)';
  log.info('Starting agent', {
    agentId,
    agentType,
    hasSession: !!opts.sessionId,
    model: modelUsed,
    promptLength: prompt.length,
    timeoutMs,
  });

  // Track timing for session health detection
  const startTime = Date.now();
  const isResumingSession = !!opts.sessionId;

  try {
    // Load system prompt — background agents get a lightweight prompt (~5-10K vs ~40K)
    let systemPrompt: string;
    if (agentType === 'background') {
      systemPrompt = await getBackgroundSystemPrompt();
    } else {
      // Chat/think: full prompt with memory search (skip for think loop — already has context)
      systemPrompt = await getKITTSystemPrompt(opts.skipMemorySearch ? undefined : prompt, opts.db);
    }

    // Inject skill context if provided (for skill routing)
    if (opts.skillContext) {
      systemPrompt += `\n\n---\n\n# Active Skill Context\n\n${opts.skillContext}`;
      log.debug('Skill context injected', { skillLength: opts.skillContext.length });
    }

    log.debug('System prompt loaded', { length: systemPrompt.length });

    const tools = opts.allowedTools ?? FULL_TOOLS;
    log.info('Agent tools', { agentId, tools });

    // Execute query with timeout via Promise.race
    const queryPromise = (async () => {
      for await (const message of query({
        prompt,
        options: {
          cwd: KITT_WORKSPACE,
          resume: opts.sessionId,
          systemPrompt,
          model: opts.model,
          allowedTools: tools,
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
        },
      })) {
        // Check if we've been aborted (timeout or manual cancel)
        if (abortController.signal.aborted) {
          break;
        }

        // Capture session ID from init message
        if (message.type === 'system' && message.subtype === 'init') {
          newSessionId = message.session_id;
          pool.markRunning(agentId);
          log.debug('Session initialized', { agentId, sessionId: newSessionId });
        }

        // Capture final result
        if ('result' in message && message.result) {
          result = message.result as string;
        }
      }
    })();

    // Timeout promise — rejects after timeoutMs or on external abort
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Agent timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      // On external abort (watchdog): also reject to ensure Promise.race resolves
      abortController.signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new Error(`Agent aborted by watchdog after ${Date.now() - startTime}ms`));
      });

      // Don't prevent Node from exiting
      if (timer.unref) timer.unref();
    });

    // Race: query vs timeout
    await Promise.race([queryPromise, timeoutPromise]);

    const elapsed = Date.now() - startTime;

    // Detect potential session corruption
    const sessionMightBeFailed = isResumingSession && !result && elapsed < 10000;

    if (sessionMightBeFailed) {
      log.warn('Possible session corruption detected', {
        agentId,
        sessionId: opts.sessionId,
        elapsed,
      });
    }

    // Report to pool
    const finalResult = result as string | null;
    pool.complete(agentId, finalResult?.length);

    return {
      result: finalResult,
      sessionId: newSessionId || opts.sessionId || '',
      sessionFailed: sessionMightBeFailed,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const elapsed = Date.now() - startTime;
    const isTimeout = errorMessage.includes('Agent timeout');

    log.error('Agent error', { agentId, error: errorMessage, elapsed, isResumingSession, isTimeout });

    // Report to pool (pool.fail, not timeout — watchdog handles timeouts separately)
    pool.fail(agentId, errorMessage);

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
