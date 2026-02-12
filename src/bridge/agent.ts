/**
 * KITT Agent
 *
 * Two modes:
 * - chatCompletion(): Direct Anthropic Messages API for chat (fast, no tools, no sessions)
 * - runAgent(): Claude Agent SDK for background tasks & think loop (tools, sessions)
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import Anthropic from '@anthropic-ai/sdk';
import type { Client } from '@libsql/client';
import { log } from './logger.js';
import { getKITTSystemPrompt } from './context.js';
import { getAgentPool, type AgentType } from './agent-pool.js';

// ==========================================
// Types
// ==========================================

export interface ChatCompletionResponse {
  result: string | null;
  error?: string;
}

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

// Lazy-initialized Anthropic client (singleton)
let anthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic();
  }
  return anthropicClient;
}

// ==========================================
// Chat Completion (Direct Messages API)
// ==========================================

/**
 * Direct Anthropic Messages API call for chat.
 * No tools, no sessions, no Agent SDK overhead.
 * System prompt includes identity, transcripts, memory search, skills, instructions.
 */
export async function chatCompletion(
  prompt: string,
  options?: { db?: Client; skillContext?: string }
): Promise<ChatCompletionResponse> {
  const startTime = Date.now();

  log.info('Chat completion start', { promptLength: prompt.length });

  try {
    // Build system prompt WITH db (loads transcripts + memory search)
    let systemPrompt = await getKITTSystemPrompt(prompt, options?.db);

    if (options?.skillContext) {
      systemPrompt += `\n\n---\n\n# Active Skill Context\n\n${options.skillContext}`;
    }

    log.debug('System prompt built', { length: systemPrompt.length });

    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    const result = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n') || null;

    const elapsed = Date.now() - startTime;

    log.info('Chat completion done', {
      hasResult: !!result,
      resultLength: result?.length,
      elapsed,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });
    console.log(`[agent] Chat ${result?.length || 0} chars in ${elapsed}ms (${response.usage.input_tokens}→${response.usage.output_tokens} tokens)`);

    return { result };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const elapsed = Date.now() - startTime;
    log.error('Chat completion error', { error: errorMessage, elapsed });
    return { result: null, error: errorMessage };
  }
}

// ==========================================
// Agent SDK (Background Tasks & Think Loop)
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
    // Load KITT personality and context
    // Skip memory search for think loop (already has all context, and prompt is too large to embed)
    let systemPrompt = await getKITTSystemPrompt(opts.skipMemorySearch ? undefined : prompt, opts.db);

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

    // Timeout promise — rejects after timeoutMs
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Agent timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      // Clear timeout if agent finishes or is aborted
      abortController.signal.addEventListener('abort', () => clearTimeout(timer));

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
