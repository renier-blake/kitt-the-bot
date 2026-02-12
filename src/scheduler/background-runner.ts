/**
 * KITT Background Task Runner
 *
 * Executes background tasks asynchronously, allowing the user to continue
 * chatting while tasks run. Uses lock-aware delivery to avoid conflicting
 * with the main chat agent.
 *
 * @see _prd/kitt-orchestrator-model.md
 */

import { runAgent, type AgentModel } from '../bridge/agent.js';
import { getCapability } from '../capabilities/index.js';
import {
  createTask,
  markTaskRunning,
  completeTask,
  failTask,
  hasActiveTaskForCapability,
  type BackgroundTask,
  type CreateTaskInput,
} from './task-registry.js';
import { isAgentProcessing } from './processing-lock.js';
import { getMemoryService } from '../memory/index.js';
import type { Channel } from '../memory/types.js';
import { createClient, type Client } from '@libsql/client';
import * as path from 'path';
import * as fs from 'fs';

const DB_PATH = path.resolve(process.cwd(), 'profile/data/kitt.db');

// ==========================================
// Types
// ==========================================

export interface DispatchOptions {
  chatId: string;
  channel: string;
  capabilityId: string;
  prompt: string;
  description?: string;
  /** Callback to send completion message */
  onComplete?: (chatId: string, message: string) => Promise<void>;
}

export interface DispatchResult {
  taskId: string;
  acknowledgment: string;
  alreadyRunning: boolean;
}

// ==========================================
// Task Execution
// ==========================================

/**
 * Dispatch a background task
 * Returns immediately with an acknowledgment, task runs async
 */
export async function dispatchBackgroundTask(
  options: DispatchOptions
): Promise<DispatchResult> {
  const { chatId, channel, capabilityId, prompt, description, onComplete } = options;

  // Check if this capability is already running for this chat
  const alreadyRunning = await hasActiveTaskForCapability(chatId, capabilityId);
  if (alreadyRunning) {
    console.log('[background-runner] Task already running', { chatId, capabilityId });
    return {
      taskId: '',
      acknowledgment: `Ik ben hier al mee bezig...`,
      alreadyRunning: true,
    };
  }

  // Get capability info for model selection
  const capability = await getCapability(capabilityId);
  const model = (capability?.model as AgentModel) || 'opus';

  // Create task in registry
  const taskInput: CreateTaskInput = {
    chatId,
    channel,
    capabilityId,
    description: description || capability?.description || capabilityId,
    prompt,
  };

  const task = await createTask(taskInput);

  // Generate acknowledgment
  const ack = description || capability?.description || `Ik werk aan ${capabilityId}...`;

  // Start task execution (non-blocking)
  executeTask(task, model, onComplete).catch((err) => {
    console.error('[background-runner] Unhandled task error', {
      taskId: task.id,
      error: err instanceof Error ? err.message : String(err),
    });
  });

  console.log('[background-runner] Task dispatched', {
    taskId: task.id,
    capabilityId,
    model,
  });

  return {
    taskId: task.id,
    acknowledgment: ack,
    alreadyRunning: false,
  };
}

/**
 * Execute a task (called internally, runs async)
 */
async function executeTask(
  task: BackgroundTask,
  model: AgentModel,
  onComplete?: (chatId: string, message: string) => Promise<void>
): Promise<void> {
  console.log('[background-runner] Starting task execution', { taskId: task.id });

  try {
    // Mark as running
    await markTaskRunning(task.id);

    // Load skill content if this is a skill
    let skillContext: string | undefined;
    const capability = await getCapability(task.capabilityId);
    if (capability?.category === 'skill' && capability.path) {
      const skillPath = path.join(process.cwd(), capability.path, 'SKILL.md');
      if (fs.existsSync(skillPath)) {
        skillContext = fs.readFileSync(skillPath, 'utf-8');
      }
    }

    // Run the agent with full tools (background tasks need Write, Edit, Bash, etc.)
    // Prepend instruction to use tools directly — background agents must NOT emit BACKGROUND_TASK signals
    const backgroundPrompt = `${task.prompt}\n\nBELANGRIJK: Je bent een background agent. Gebruik je tools (Bash, Read, etc.) om de taak DIRECT uit te voeren. Stuur NOOIT een BACKGROUND_TASK signaal — dat is alleen voor chat mode. Voer de opdracht zelf uit en geef het resultaat terug.`;

    const response = await runAgent(backgroundPrompt, {
      agentType: 'background',
      chatId: task.chatId,
      capabilityId: task.capabilityId,
      model,
      skillContext,
      skipMemorySearch: true,
    });

    if (response.error) {
      await failTask(task.id, response.error);
      await deliverResult(task, `Sorry, er ging iets mis: ${response.error}`, onComplete);
      return;
    }

    const result = response.result || 'Klaar, maar geen resultaat.';
    await completeTask(task.id, result);

    // Store result in transcripts for context preservation
    await storeResultInTranscripts(task, result);

    await deliverResult(task, result, onComplete);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[background-runner] Task execution failed', {
      taskId: task.id,
      error: errorMessage,
    });
    await failTask(task.id, errorMessage);
    await deliverResult(task, `Sorry, er ging iets mis: ${errorMessage}`, onComplete);
  }
}

/**
 * Deliver result to the user (lock-aware)
 * Waits until the main agent is not processing before sending
 */
async function deliverResult(
  task: BackgroundTask,
  message: string,
  onComplete?: (chatId: string, message: string) => Promise<void>
): Promise<void> {
  if (!onComplete) {
    console.log('[background-runner] No onComplete callback, result not delivered', {
      taskId: task.id,
    });
    return;
  }

  // Wait for lock to be free (max 30 seconds)
  const db = createClient({ url: `file:${DB_PATH}` });
  const maxWait = 30000;
  const startWait = Date.now();

  while (await isAgentProcessing(db)) {
    if (Date.now() - startWait > maxWait) {
      console.warn('[background-runner] Timeout waiting for lock, delivering anyway', {
        taskId: task.id,
      });
      break;
    }
    await sleep(500);
  }

  try {
    await onComplete(task.chatId, message);
    console.log('[background-runner] Result delivered', { taskId: task.id });
  } catch (err) {
    console.error('[background-runner] Failed to deliver result', {
      taskId: task.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Store background task result in transcripts for context preservation
 * This ensures users can ask follow-up questions about the result
 */
async function storeResultInTranscripts(
  task: BackgroundTask,
  result: string
): Promise<void> {
  try {
    const memory = getMemoryService();
    await memory.storeMessage({
      sessionId: task.chatId,
      channel: task.channel as Channel,
      role: 'kitt',
      content: result,
      metadata: {
        backgroundTaskId: task.id,
        capability: task.capabilityId,
        isBackgroundResult: true,
      },
    });
    console.log('[background-runner] Result stored in transcripts', { taskId: task.id });
  } catch (err) {
    console.error('[background-runner] Failed to store result in transcripts', {
      taskId: task.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
