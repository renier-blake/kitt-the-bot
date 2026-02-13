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
import { getCapability, type Capability } from '../capabilities/index.js';
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
import { createLogger } from '../bridge/logger.js';

const log = createLogger('background-runner');

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
    log.info('Task already running', { chatId, capabilityId });
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
    log.error('Unhandled task error', {
      taskId: task.id,
      error: err instanceof Error ? err.message : String(err),
    });
  });

  log.info('Task dispatched', {
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

// Default tool sets for background agents
const DEFAULT_BACKGROUND_TOOLS = ['Bash', 'Read', 'Glob', 'Grep'];

/**
 * Execute a task (called internally, runs async)
 * Includes heartbeat mechanism: sends progress updates every 60s (max 3)
 */
async function executeTask(
  task: BackgroundTask,
  model: AgentModel,
  onComplete?: (chatId: string, message: string) => Promise<void>
): Promise<void> {
  log.info('Starting task execution', { taskId: task.id });

  // Check for inline execution (no agent spawn needed)
  const capability = await getCapability(task.capabilityId);
  if (capability?.execution === 'inline') {
    await executeInlineTask(task, capability, onComplete);
    return;
  }

  // Heartbeat: send progress updates every 60s (max 3)
  let heartbeatCount = 0;
  const MAX_HEARTBEATS = 3;
  const HEARTBEAT_INTERVAL = 60_000;
  const heartbeatTimer = setInterval(async () => {
    heartbeatCount++;
    if (heartbeatCount > MAX_HEARTBEATS) {
      clearInterval(heartbeatTimer);
      return;
    }
    if (onComplete) {
      const skillName = task.description || task.capabilityId;
      await onComplete(task.chatId, `Nog bezig met ${skillName}... (${heartbeatCount}m)`).catch(() => {});
      log.info(`Heartbeat #${heartbeatCount}`, { taskId: task.id });
    }
  }, HEARTBEAT_INTERVAL);

  try {
    // Mark as running
    await markTaskRunning(task.id);

    // Load skill content if this is a skill
    let skillContext: string | undefined;
    if (capability?.category === 'skill' && capability.path) {
      const skillPath = path.join(process.cwd(), capability.path, 'SKILL.md');
      if (fs.existsSync(skillPath)) {
        skillContext = fs.readFileSync(skillPath, 'utf-8');
      }
    }

    // Determine allowed tools: per-capability override → default set
    const tools = capability?.allowedTools ?? DEFAULT_BACKGROUND_TOOLS;
    log.info('Agent tools', { taskId: task.id, capabilityId: task.capabilityId, tools });

    // Run the agent — background agents must NOT emit BACKGROUND_TASK signals
    const backgroundPrompt = `${task.prompt}\n\nBELANGRIJK: Je bent een background agent. Gebruik je tools (Bash, Read, etc.) om de taak DIRECT uit te voeren. Stuur NOOIT een BACKGROUND_TASK signaal — dat is alleen voor chat mode. Voer de opdracht zelf uit en geef het resultaat terug.`;

    const response = await runAgent(backgroundPrompt, {
      agentType: 'background',
      chatId: task.chatId,
      capabilityId: task.capabilityId,
      model,
      skillContext,
      skipMemorySearch: true,
      allowedTools: tools,
    });

    clearInterval(heartbeatTimer);

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
    clearInterval(heartbeatTimer);
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.error('Task execution failed', {
      taskId: task.id,
      error: errorMessage,
    });
    await failTask(task.id, errorMessage);
    await deliverResult(task, `Sorry, er ging iets mis: ${errorMessage}`, onComplete);
  }
}

/**
 * Execute an inline task (fast data retrieval + Opus synthesis)
 * Currently supports: memory-search (3-phase: query plan → search → synthesize)
 */
async function executeInlineTask(
  task: BackgroundTask,
  capability: Capability,
  onComplete?: (chatId: string, message: string) => Promise<void>
): Promise<void> {
  const startTime = Date.now();
  log.info('Inline execution', { taskId: task.id, capabilityId: capability.id });

  try {
    await markTaskRunning(task.id);

    let result: string;

    if (capability.id === 'memory-search') {
      result = await executeMemorySearch(task);
    } else {
      result = `Inline execution niet ondersteund voor capability: ${capability.id}`;
    }

    const elapsed = Date.now() - startTime;
    log.info(`Inline complete: ${capability.id} in ${elapsed}ms`);

    await completeTask(task.id, result);
    await storeResultInTranscripts(task, result);
    await deliverResult(task, result, onComplete);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.error('Inline task failed', { taskId: task.id, error: errorMessage });
    await failTask(task.id, errorMessage);
    await deliverResult(task, `Sorry, er ging iets mis: ${errorMessage}`, onComplete);
  }
}

// ==========================================
// Memory Search (3-phase inline)
// ==========================================

interface SearchPlan {
  vectorQuery?: string;
  transcriptSearch?: {
    fromDate?: string;
    toDate?: string;
  };
}

/**
 * 3-phase memory search:
 * 1. Haiku analyzes the query → structured search plan (JSON)
 * 2. Execute searches programmatically (vector + transcript)
 * 3. Opus synthesizes a natural answer
 */
async function executeMemorySearch(task: BackgroundTask): Promise<string> {
  const memory = getMemoryService();
  const phaseStart = Date.now();

  // === Phase 1: Haiku Query Planner ===
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const plannerPrompt = `Je bent een query planner. Bepaal HOE je moet zoeken in een geheugen-systeem.

Datum: ${now.toLocaleDateString('nl-NL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}. Tijd: ${now.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}.

STAP 1 — Redeneer over twee vragen:
A) Weet ik het ONDERWERP? (heeft de user een concreet topic genoemd?)
B) Weet ik WANNEER? (heeft de user een tijdsreferentie?)

STAP 2 — Kies je strategie:
- Onderwerp BEKEND → vectorQuery (semantisch zoeken op dat onderwerp)
- Tijd BEKEND → transcriptSearch (alle gesprekken in dat tijdvenster ophalen)
- Beide BEKEND → beide gebruiken
- Onderwerp ONBEKEND + Tijd BEKEND → ALLEEN transcriptSearch (vector search is zinloos als je het onderwerp niet weet!)

KRITIEK: Als de user iets vraagt als "waarom werd ik wakker?" of "wat gebeurde er?" — dan is het onderwerp ONBEKEND. De user weet het antwoord niet, daarom vraagt hij het. Gebruik dan GEEN vectorQuery met gok-woorden.

OUTPUT: Alleen valid JSON, geen uitleg. Alles in het NEDERLANDS.

{
  "vectorQuery": "korte Nederlandse zoekterm over het onderwerp",
  "transcriptSearch": { "fromDate": "ISO8601", "toDate": "ISO8601" }
}

Laat vectorQuery WEG als het onderwerp onbekend is.
Laat transcriptSearch WEG als er geen tijdsreferentie is.
Gebruik NOOIT textQuery — dat veld bestaat niet meer.

VOORBEELDEN:

Vraag: "wat bespraken we gisteren over het project?"
Redenering: onderwerp=project (BEKEND), tijd=gisteren (BEKEND) → beide
{"vectorQuery":"project werk","transcriptSearch":{"fromDate":"${getYesterday()}T00:00:00","toDate":"${getYesterday()}T23:59:59"}}

Vraag: "weet je nog iets over rookmelders?"
Redenering: onderwerp=rookmelders (BEKEND), tijd=geen → alleen vector
{"vectorQuery":"rookmelders brand alarm"}

Vraag: "wat heb ik twee weken geleden 's ochtends gedaan?"
Redenering: onderwerp=ONBEKEND (user weet het niet), tijd=twee weken geleden ochtend → alleen transcripts
{"transcriptSearch":{"fromDate":"${getTwoWeeksAgo()}T06:00:00","toDate":"${getTwoWeeksAgo()}T12:00:00"}}

Vraag: "weet je nog waarom ik zo vroeg wakker werd vanochtend?"
Redenering: onderwerp=ONBEKEND (user weet de reden niet), tijd=vanochtend vroeg → alleen transcripts
{"transcriptSearch":{"fromDate":"${todayStr}T05:00:00","toDate":"${todayStr}T10:00:00"}}

Vraag: "heb ik het ooit over mijn moeder gehad?"
Redenering: onderwerp=moeder (BEKEND), tijd=geen → alleen vector
{"vectorQuery":"moeder familie"}

Vraag: "${task.prompt}"`;

  const plannerResponse = await runAgent(plannerPrompt, {
    agentType: 'background',
    chatId: task.chatId,
    capabilityId: task.capabilityId,
    model: 'haiku',
    allowedTools: [],
    skipMemorySearch: true,
  });

  const plannerElapsed = Date.now() - phaseStart;
  log.info(`Query planner done in ${plannerElapsed}ms`);

  // Parse the search plan
  let searchPlan: SearchPlan = {};
  try {
    const raw = plannerResponse.result || '{}';
    // Strip markdown code blocks if present
    const jsonStr = raw.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim();
    searchPlan = JSON.parse(jsonStr);
    log.info('Search plan', { plan: searchPlan });
  } catch (err) {
    log.warn('Failed to parse search plan, falling back to vector search', {
      raw: plannerResponse.result,
      error: err instanceof Error ? err.message : String(err),
    });
    searchPlan = { vectorQuery: task.prompt };
  }

  // === Phase 2: Execute Searches ===
  const searchStart = Date.now();
  const searchPromises: Promise<void>[] = [];
  let vectorResults: { source: string; time: string; content: string }[] = [];
  let transcriptResults: { role: string; time: string; content: string }[] = [];

  // Vector/semantic search
  if (searchPlan.vectorQuery) {
    searchPromises.push(
      memory.search(searchPlan.vectorQuery, { maxResults: 10, minScore: 0.3 }).then((results) => {
        vectorResults = results.map((r) => ({
          source: r.source === 'transcript' ? 'Gesprek' : 'Memory',
          time: r.metadata?.createdAt
            ? new Date(r.metadata.createdAt).toLocaleString('nl-NL')
            : '',
          content: r.snippet,
        }));
      })
    );
  }

  // Transcript time-range search
  if (searchPlan.transcriptSearch) {
    const ts = searchPlan.transcriptSearch;
    searchPromises.push(
      memory.searchTranscripts({
        fromDate: ts.fromDate ? new Date(ts.fromDate) : undefined,
        toDate: ts.toDate ? new Date(ts.toDate) : undefined,
        limit: 50,
      }).then((results) => {
        transcriptResults = results.map((r) => ({
          role: r.role === 'kitt' ? 'KITT' : 'Renier',
          time: r.createdAt.toLocaleString('nl-NL'),
          content: r.content.length > 500 ? r.content.slice(0, 500) + '...' : r.content,
        }));
      })
    );
  }

  await Promise.all(searchPromises);
  const searchElapsed = Date.now() - searchStart;
  log.info(`Searches done in ${searchElapsed}ms`, {
    vectorResults: vectorResults.length,
    transcriptResults: transcriptResults.length,
  });

  // Check if we found anything
  if (vectorResults.length === 0 && transcriptResults.length === 0) {
    return 'Ik heb gezocht in mijn geheugen, maar kon geen relevante herinneringen vinden over dit onderwerp.';
  }

  // === Phase 3: Opus Synthesis ===
  let contextSections = '';

  if (vectorResults.length > 0) {
    const vectorContext = vectorResults.map((r, i) =>
      `${i + 1}. [${r.source}] ${r.time}\n${r.content}`
    ).join('\n\n');
    contextSections += `## Semantische zoekresultaten\n\n${vectorContext}\n\n`;
  }

  if (transcriptResults.length > 0) {
    const transcriptContext = transcriptResults.map((r, i) =>
      `${i + 1}. [${r.role}] ${r.time}\n${r.content}`
    ).join('\n\n');
    contextSections += `## Gespreksfragmenten (tijdgebonden)\n\n${transcriptContext}\n\n`;
  }

  const synthesisPrompt = `De gebruiker vraagt: "${task.prompt}"

Hieronder staan zoekresultaten uit het geheugen. Gebruik deze om een natuurlijk, persoonlijk antwoord te geven.

REGELS:
- Gebruik ALLEEN informatie uit de resultaten hieronder
- Stuur NOOIT een BACKGROUND_TASK signaal
- Je hebt geen tools — je kunt niet verder zoeken
- Als de resultaten geen antwoord bevatten, zeg dat eerlijk

---
${contextSections}---

Geef een beknopt maar volledig antwoord.`;

  const response = await runAgent(synthesisPrompt, {
    agentType: 'background',
    chatId: task.chatId,
    capabilityId: task.capabilityId,
    allowedTools: [],
    skipMemorySearch: true,
  });

  return response.result || 'Ik vond wel herinneringen, maar kon er geen goed antwoord van maken.';
}

/** Helper: get yesterday's date as YYYY-MM-DD (for planner examples) */
function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

/** Helper: get date 2 weeks ago as YYYY-MM-DD (for planner examples) */
function getTwoWeeksAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 14);
  return d.toISOString().split('T')[0];
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
    log.info('No onComplete callback, result not delivered', {
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
      log.warn('Timeout waiting for lock, delivering anyway', {
        taskId: task.id,
      });
      break;
    }
    await sleep(500);
  }

  try {
    await onComplete(task.chatId, message);
    log.info('Result delivered', { taskId: task.id });
  } catch (err) {
    log.error('Failed to deliver result', {
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
    log.info('Result stored in transcripts', { taskId: task.id });
  } catch (err) {
    log.error('Failed to store result in transcripts', {
      taskId: task.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
