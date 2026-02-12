/**
 * KITT Scheduler Service
 *
 * Central scheduler for:
 * - Cron-style scheduled tasks
 * - Think Loop execution
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { ScheduleRegistry, ScheduledTask, TaskExecutionResult } from './types.js';
import { getNextRun, describeCron } from './cron.js';
import { parseThinkResponse } from './think-loop.js';
import { buildContext } from '../context/index.js';
import { getOpenTasks, logTaskExecution } from './task-engine.js';
import {
  getSleepUntil,
  formatWakeTime,
  isKittDND,
  canSendMessages,
  getWakeReminder,
  clearWakeReminder,
  clearSleep,
} from './sleep-mode.js';
import { isAgentProcessing, isConversationActive } from './processing-lock.js';

const REGISTRY_PATH = process.env.KITT_SCHEDULER_REGISTRY || './profile/data/runtime.json';
const DEFAULT_TIMEZONE = 'Europe/Amsterdam';

// Singleton instance
let instance: SchedulerService | null = null;

export class SchedulerService {
  private registry: ScheduleRegistry | null = null;
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private initialized = false;
  private lastTickAt: number | null = null;
  private tickRunning = false; // KITT-138: Overlap guard

  /**
   * Initialize the scheduler
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.registry = await this.loadRegistry();
    this.scheduleAllTasks();
    this.initialized = true;

    console.log('[scheduler] Initialized', {
      tasks: this.registry.tasks.length,
      enabled: this.registry.tasks.filter((t) => t.enabled).length,
      thinkLoopModel: this.registry.thinkLoop?.model || 'haiku',
    });
  }

  /**
   * Stop all scheduled tasks
   */
  async shutdown(): Promise<void> {
    for (const [id, timer] of this.timers) {
      clearTimeout(timer);
      console.log('[scheduler] Cancelled task', { taskId: id });
    }
    this.timers.clear();
    this.initialized = false;
  }

  /**
   * Load registry from disk
   */
  private async loadRegistry(): Promise<ScheduleRegistry> {
    try {
      const content = await fs.readFile(REGISTRY_PATH, 'utf-8');
      const registry = JSON.parse(content);

      // Migrate old heartbeat config to thinkLoop
      if (registry.heartbeat && !registry.thinkLoop) {
        registry.thinkLoop = {
          model: registry.heartbeat.model || 'haiku',
          lastRun: registry.heartbeat.lastRun,
        };
        // Keep telegramChatId at root level
        if (!registry.telegramChatId && registry.heartbeat.telegramChatId) {
          registry.telegramChatId = registry.heartbeat.telegramChatId;
        }
      }

      return registry;
    } catch (err) {
      console.warn('[scheduler] Registry not found, using defaults');
      return this.getDefaultRegistry();
    }
  }

  /**
   * Save registry to disk
   */
  private async saveRegistry(): Promise<void> {
    if (!this.registry) return;

    const dir = path.dirname(REGISTRY_PATH);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(REGISTRY_PATH, JSON.stringify(this.registry, null, 2));
  }

  /**
   * Get default registry
   */
  private getDefaultRegistry(): ScheduleRegistry {
    return {
      version: 1,
      timezone: DEFAULT_TIMEZONE,
      tasks: [
        {
          id: 'daily-summary',
          name: 'Daily Summary',
          skill: 'memory',
          action: 'generateDailySummary',
          schedule: '0 23 * * *',
          enabled: true,
          lastRun: null,
          nextRun: null,
        },
      ],
      thinkLoop: {
        model: 'haiku',
        lastRun: null,
      },
    };
  }

  /**
   * Schedule all enabled tasks
   */
  private scheduleAllTasks(): void {
    if (!this.registry) return;

    for (const task of this.registry.tasks) {
      if (task.enabled) {
        this.scheduleTask(task);
      }
    }
  }

  /**
   * Schedule a single task
   */
  private scheduleTask(task: ScheduledTask): void {
    const existingTimer = this.timers.get(task.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    try {
      const nextRun = getNextRun(task.schedule, new Date(), this.registry?.timezone);
      const delay = nextRun.getTime() - Date.now();

      task.nextRun = nextRun.toISOString();

      console.log('[scheduler] Task scheduled', {
        taskId: task.id,
        name: task.name,
        nextRun: task.nextRun,
        delayMs: delay,
        description: describeCron(task.schedule),
      });

      const timer = setTimeout(async () => {
        await this.executeTask(task);
        this.scheduleTask(task);
      }, delay);

      this.timers.set(task.id, timer);
    } catch (err) {
      console.error('[scheduler] Failed to schedule task', {
        taskId: task.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Execute a scheduled task
   */
  async executeTask(task: ScheduledTask): Promise<TaskExecutionResult> {
    const startTime = new Date();
    console.log('[scheduler] Executing task', { taskId: task.id, name: task.name });

    try {
      await this.runSkillAction(task.skill, task.action);

      task.lastRun = new Date().toISOString();
      await this.saveRegistry();

      const endTime = new Date();
      console.log('[scheduler] Task completed', {
        taskId: task.id,
        durationMs: endTime.getTime() - startTime.getTime(),
      });

      return {
        taskId: task.id,
        success: true,
        startTime,
        endTime,
      };
    } catch (err) {
      const endTime = new Date();
      const errorMsg = err instanceof Error ? err.message : String(err);

      console.error('[scheduler] Task failed', { taskId: task.id, error: errorMsg });

      return {
        taskId: task.id,
        success: false,
        startTime,
        endTime,
        error: errorMsg,
      };
    }
  }

  /**
   * Run a skill action
   */
  private async runSkillAction(skill: string, action: string): Promise<void> {
    console.log('[scheduler] Running skill action', { skill, action });
    console.warn('[scheduler] Unknown skill action', { skill, action });
  }

  /**
   * Load skill content from SKILL.md file (F63)
   */
  private async loadSkillContent(skillName: string): Promise<string | null> {
    const skillPath = path.join(process.cwd(), '.claude/skills', skillName, 'SKILL.md');
    try {
      const content = await fs.readFile(skillPath, 'utf-8');
      // Strip frontmatter
      return content.replace(/^---\n[\s\S]*?\n---\n*/, '').trim();
    } catch {
      console.warn(`[scheduler] Could not load skill: ${skillName}`);
      return null;
    }
  }

  /**
   * Build a task-specific prompt with skill content
   * KITT-139: Shared between sync sub-agents and background dispatch
   */
  private async buildTaskPrompt(task: { title: string; description: string | null; skill_refs: string[] }, currentTime: string, dayOfWeek: string): Promise<string> {
    const skillContent = task.skill_refs.length > 0
      ? await this.loadSkillContent(task.skill_refs[0])
      : null;

    return `Je bent KITT en je voert nu de volgende taak uit:

**Taak:** ${task.title}
**Beschrijving:** ${task.description || 'Geen beschrijving'}

${skillContent ? `## Skill Instructies\n\n${skillContent}` : ''}

## Context
- Tijd: ${currentTime}
- Dag: ${dayOfWeek}

Voer de taak uit volgens de skill instructies.
Als je klaar bent, geef een korte samenvatting van wat je hebt gedaan.`;
  }

  /**
   * Run the Think Loop
   * Called by interval timer in bridge/index.ts
   */
  async runThinkLoop(): Promise<void> {
    // Always update lastTickAt — even if we skip or take no action
    this.lastTickAt = Date.now();

    // KITT-138: Overlap guard — prevent concurrent think loop ticks
    if (this.tickRunning) {
      console.log('[think-loop] ⏭️ Previous tick still running, skipping');
      return;
    }
    this.tickRunning = true;

    try {
      await this._runThinkLoopInner();
    } finally {
      this.tickRunning = false;
    }
  }

  /**
   * Inner think loop logic (extracted for overlap guard try/finally)
   */
  private async _runThinkLoopInner(): Promise<void> {
    if (!this.registry) {
      await this.initialize();
    }

    // Get memory service for database access
    const { getMemoryService } = await import('../memory/index.js');
    const memory = getMemoryService();
    await memory.initialize();

    const db = memory.getDb();
    if (!db) {
      console.warn('[think-loop] ⚠️ No database connection');
      return;
    }

    // ========================================
    // F73: SLEEP/DND/WAKE MODE CHECK - MUST BE FIRST
    // ========================================

    // Check wake reminder FIRST - if wake time passed, send message and clear sleep
    const wakeReminder = await getWakeReminder(db);
    if (wakeReminder && wakeReminder <= Date.now()) {
      console.log('[think-loop] ⏰ Wake reminder triggered!');

      // Send wake-up message to all configured channels
      const wakeTelegramId = this.registry?.telegramChatId;
      const wakeWhatsappId = this.registry?.whatsappChatId;
      if (wakeTelegramId || wakeWhatsappId) {
        const { getRouter } = await import('../bridge/router.js');
        const wakeMessage = 'Goedemorgen! ☀️ Je wilde om deze tijd gewekt worden.';

        // Send to Telegram (isolated try-catch)
        if (wakeTelegramId) {
          try {
            await getRouter().sendMessage(`telegram:${wakeTelegramId}`, wakeMessage);
            console.log('[think-loop] 📤 Wake-up message sent to Telegram');
          } catch (err) {
            console.warn('[think-loop] ⚠️ Telegram wake-up failed:', err instanceof Error ? err.message : err);
          }
        }

        // Send to WhatsApp (isolated try-catch)
        if (wakeWhatsappId) {
          try {
            await getRouter().sendMessage(`whatsapp:${wakeWhatsappId}`, wakeMessage);
            console.log('[think-loop] 📤 Wake-up message sent to WhatsApp');
          } catch (err) {
            console.warn('[think-loop] ⚠️ WhatsApp wake-up failed:', err instanceof Error ? err.message : err);
          }
        }

        // Log to transcripts
        const { getMemoryService } = await import('../memory/index.js');
        const memoryForWake = getMemoryService();
        await memoryForWake.storeMessage({
          sessionId: 'think-loop',
          channel: wakeTelegramId ? 'telegram' : 'whatsapp',
          role: 'kitt',
          type: 'message',
          content: wakeMessage,
        });
      }

      // Clear wake reminder and sleep mode
      await clearWakeReminder(db);
      await clearSleep(db);
      console.log('[think-loop] ✅ Sleep mode cleared, KITT is awake');
      // Continue with normal think loop
    }

    // Check if still sleeping (no wake reminder, or wake time not yet reached)
    const sleepUntil = await getSleepUntil(db);
    if (sleepUntil) {
      const wakeTime = formatWakeTime(sleepUntil);
      console.log(`[think-loop] 😴 Sleeping until ${wakeTime}`);
      return;
    }

    // Check DND mode - log but continue processing
    const dndActive = await isKittDND(db);
    if (dndActive) {
      console.log('[think-loop] 🔕 DND mode active - will process but not send messages');
    }

    // Check processing lock — if chat agent is handling a message, skip this tick
    if (await isAgentProcessing(db)) {
      console.log('[think-loop] 🔒 Chat agent is processing, skipping tick');
      return;
    }

    // Check active conversation window — don't interrupt ongoing conversations
    if (await isConversationActive(db)) {
      console.log('[think-loop] 💬 Active conversation window, skipping tick');
      return;
    }

    console.log('[think-loop] 🧠 Running think loop');

    // Get open tasks directly (no longer loading full context twice)
    const { tasks } = await getOpenTasks(db);

    // Get message count for today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const messageCountResult = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM transcripts WHERE created_at >= ?',
      args: [startOfDay.getTime()],
    });
    const messageCount = Number(messageCountResult.rows[0]?.count || 0);

    if (messageCount === 0) {
      console.log('[think-loop] 📭 No transcripts today, checking scheduled tasks anyway');
    }

    // Calculate time values for logging/sub-agent prompts
    const now = new Date();
    const days = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
    const currentTime = now.toLocaleTimeString('nl-NL', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Amsterdam',
    });
    const dayOfWeek = days[now.getDay()];

    // ========================================
    // F63: PRE-PROCESS TASKS WITH DIFFERENT MODEL
    // Tasks that require Opus/Sonnet are handled separately
    // KITT-139: Split into sync (awaited) and background (fire-and-forget)
    // ========================================
    const thinkLoopModel = this.registry?.thinkLoop?.model || 'haiku';
    const tasksForSubAgent = tasks.filter((t) => t.model && t.model !== thinkLoopModel);

    if (tasksForSubAgent.length > 0) {
      console.log(`[think-loop] 🚀 Found ${tasksForSubAgent.length} task(s) requiring different model`);

      // KITT-139: Split by execution mode
      const syncTasks = tasksForSubAgent.filter((t) => t.execution !== 'background');
      const backgroundTasks = tasksForSubAgent.filter((t) => t.execution === 'background');

      if (backgroundTasks.length > 0) {
        console.log(`[think-loop] 🔄 Dispatching ${backgroundTasks.length} background task(s)`);
      }
      if (syncTasks.length > 0) {
        console.log(`[think-loop] ⏳ ${syncTasks.length} sync task(s) to await`);
      }

      // KITT-139: Background tasks — fire-and-forget via background runner
      if (backgroundTasks.length > 0) {
        const { dispatchBackgroundTask } = await import('./background-runner.js');
        const { getRouter } = await import('../bridge/router.js');

        const telegramId = this.registry?.telegramChatId;
        const whatsappId = this.registry?.whatsappChatId;
        const chatId = telegramId ? `telegram:${telegramId}` : (whatsappId ? `whatsapp:${whatsappId}` : null);
        const channel = telegramId ? 'telegram' : (whatsappId ? 'whatsapp' : 'unknown');

        for (const task of backgroundTasks) {
          if (!chatId) {
            console.warn(`[think-loop] ⚠️ No chat ID configured, cannot dispatch background task "${task.title}"`);
            continue;
          }

          const taskPrompt = await this.buildTaskPrompt(task, currentTime, dayOfWeek);

          try {
            const dispatchResult = await dispatchBackgroundTask({
              chatId,
              channel,
              capabilityId: task.skill_refs[0] || task.title,
              prompt: taskPrompt,
              description: task.title,
              onComplete: async (cid: string, message: string) => {
                try {
                  await getRouter().sendMessage(cid, message);
                } catch (sendErr) {
                  console.warn(`[think-loop] ⚠️ Failed to send background result for "${task.title}":`, sendErr);
                }
                // Log task completion
                try {
                  const { getMemoryService } = await import('../memory/index.js');
                  const mem = getMemoryService();
                  const memDb = mem.getDb();
                  if (memDb) {
                    await logTaskExecution(memDb, {
                      task_id: task.id,
                      task_title: task.title,
                      status: 'completed',
                      notes: `Completed by ${task.model} background agent`,
                    });
                  }
                } catch (logErr) {
                  console.warn(`[think-loop] ⚠️ Failed to log task completion for "${task.title}":`, logErr);
                }
              },
            });

            if (dispatchResult.alreadyRunning) {
              console.log(`[think-loop] ⏭️ Background task "${task.title}" already running, skipping`);
            } else {
              console.log(`[think-loop] ✅ Background task dispatched: "${task.title}" (taskId: ${dispatchResult.taskId})`);
            }
          } catch (err) {
            console.error(`[think-loop] ❌ Failed to dispatch background task "${task.title}":`, err);
          }
        }
      }

      // Sync tasks: await sequentially (existing behavior)
      if (syncTasks.length > 0) {
        const { runAgent } = await import('../bridge/agent.js');

        for (const task of syncTasks) {
          console.log(`[think-loop] 🤖 Spawning ${task.model} sub-agent for: "${task.title}"`);

          const taskPrompt = await this.buildTaskPrompt(task, currentTime, dayOfWeek);

          try {
            const subResponse = await runAgent(taskPrompt, {
              agentType: 'think-sub',
              capabilityId: task.skill_refs[0] || task.title,
              model: task.model as 'haiku' | 'sonnet' | 'opus',
              skipMemorySearch: true,
            });

            if (subResponse.result) {
              console.log(`[think-loop] ✅ Sub-agent completed task "${task.title}"`);
              console.log(`[think-loop] 📝 Result preview: ${subResponse.result.slice(0, 100)}...`);

              await logTaskExecution(db, {
                task_id: task.id,
                task_title: task.title,
                status: 'completed',
                notes: `Completed by ${task.model} sub-agent`,
              });
            } else {
              console.warn(`[think-loop] ⚠️ Sub-agent returned no result for "${task.title}"`);
            }
          } catch (err) {
            console.error(`[think-loop] ❌ Sub-agent failed for "${task.title}":`, err);
          }
        }
      }
    }

    // Filter out tasks already handled by sub-agents
    const remainingTasks = tasks.filter((t) => !t.model || t.model === thinkLoopModel);
    if (tasksForSubAgent.length > 0) {
      console.log(`[think-loop] 📋 Remaining tasks for ${thinkLoopModel}: ${remainingTasks.length}`);
    }

    // Build think prompt using unified context builder
    const thinkPrompt = await buildContext({ mode: 'think', db });

    // Get model from config (default to haiku for efficiency)
    const model = this.registry?.thinkLoop?.model || 'haiku';

    // Log task summary
    if (remainingTasks.length > 0) {
      console.log(`[think-loop] 📋 Open tasks (${remainingTasks.length}):`, remainingTasks.map((t) => `"${t.title}" [${t.priority}]`).join(', '));
    }

    console.log('[think-loop] 🤔 Asking agent to think...', {
      messageCount,
      openTasks: remainingTasks.length,
      model,
    });

    // Run agent with think prompt
    // skipMemorySearch: true because think prompt already contains all context
    // and the prompt is too large to embed (would exceed 8192 token limit)
    const { runAgent } = await import('../bridge/agent.js');
    const response = await runAgent(thinkPrompt, { agentType: 'think', model, skipMemorySearch: true });

    if (!response.result) {
      console.log('[think-loop] ⚠️ Agent returned no response');
      return;
    }

    // Parse response
    const thought = parseThinkResponse(response.result);

    // Log the reasoning
    console.log('[think-loop] 📝 Agent response:');
    console.log('---');
    console.log(response.result);
    console.log('---');

    if (thought.reasoning) {
      console.log('[think-loop] 💭 Reasoning:', thought.reasoning);
    }

    if (!thought.shouldAct) {
      console.log('[think-loop] ✓ Decision: No action needed');
      return;
    }

    console.log('[think-loop] 📤 Taking action', {
      action: thought.action,
      messageLength: thought.message?.length,
      memoryNote: thought.memoryNote?.slice(0, 50),
    });

    const telegramChatId = this.registry?.telegramChatId;
    const whatsappChatId = this.registry?.whatsappChatId;
    let thoughtContent: string | null = null;

    // Handle different action types
    if (thought.action === 'task' && thought.taskId !== undefined && thought.message && thought.taskComplete) {
      // F37: COMPLETE_TASK — Phase 2: store reflection summary internally, do NOT send to Telegram
      const task = tasks.find((t) => t.id === thought.taskId);
      const taskTitle = task?.title || `Task #${thought.taskId}`;

      // Store reflection summary as type='reflection' transcript
      await memory.storeMessage({
        sessionId: 'think-loop',
        channel: 'telegram',
        role: 'kitt',
        type: 'reflection',
        content: thought.message,
        metadata: { framework: '6min-diary', task_id: thought.taskId },
      });

      // Log task as completed
      await logTaskExecution(db, {
        task_id: thought.taskId,
        task_title: taskTitle,
        status: 'completed',
        notes: 'Reflection summary created',
      });

      const preview = thought.message.length > 80
        ? thought.message.slice(0, 80) + '...'
        : thought.message;
      thoughtContent = `Reflectie samenvatting opgeslagen voor task #${thought.taskId}: "${preview}"`;

      console.log(`[think-loop] ✅ Task #${thought.taskId} completed — reflection stored`);
    }
    else if (thought.action === 'task' && thought.taskId !== undefined && thought.message) {
      // Task execution - send message AND log the task
      // Find the task title from tasks
      const task = tasks.find((t) => t.id === thought.taskId);
      const taskTitle = task?.title || `Task #${thought.taskId}`;

      // F73: Check if we can send messages (not in DND mode)
      const canSend = await canSendMessages(db);

      if (canSend && (telegramChatId || whatsappChatId)) {
        const { getRouter } = await import('../bridge/router.js');

        // Send to Telegram (isolated try-catch so WhatsApp failure doesn't block)
        if (telegramChatId) {
          try {
            await getRouter().sendMessage(`telegram:${telegramChatId}`, thought.message);
            console.log(`[think-loop] ✅ Task #${thought.taskId} sent to Telegram`);
          } catch (err) {
            console.warn(`[think-loop] ⚠️ Telegram send failed:`, err instanceof Error ? err.message : err);
          }
        }

        // Send to WhatsApp (isolated try-catch so failure doesn't block task logging)
        if (whatsappChatId) {
          try {
            await getRouter().sendMessage(`whatsapp:${whatsappChatId}`, thought.message);
            console.log(`[think-loop] ✅ Task #${thought.taskId} sent to WhatsApp`);
          } catch (err) {
            console.warn(`[think-loop] ⚠️ WhatsApp send failed:`, err instanceof Error ? err.message : err);
          }
        }

        // F74b: Store the actual message as type='message'
        await memory.storeMessage({
          sessionId: 'think-loop',
          channel: telegramChatId ? 'telegram' : 'whatsapp',
          role: 'kitt',
          type: 'message',
          content: thought.message,
        });
      } else if (!canSend) {
        console.log(`[think-loop] 🔕 Task #${thought.taskId} executed but message suppressed (DND mode)`);
      } else {
        console.warn('[think-loop] ⚠️ No chat IDs configured');
      }

      // Log task execution as 'reminder' (always, even in DND)
      await logTaskExecution(db, {
        task_id: thought.taskId,
        task_title: taskTitle,
        status: 'reminder',
        notes: thought.message.slice(0, 100),
      });

      // Format thought for storage
      const preview = thought.message.length > 80
        ? thought.message.slice(0, 80) + '...'
        : thought.message;
      thoughtContent = `Task #${thought.taskId} uitgevoerd: "${preview}"${!canSend ? ' (DND - niet gestuurd)' : ''}`;
    }
    else if (thought.action === 'message' && thought.message) {
      // F73: Check if we can send messages (not in DND mode)
      const canSend = await canSendMessages(db);

      if (canSend && (telegramChatId || whatsappChatId)) {
        const { getRouter } = await import('../bridge/router.js');

        // Send to Telegram (isolated try-catch)
        if (telegramChatId) {
          try {
            await getRouter().sendMessage(`telegram:${telegramChatId}`, thought.message);
            console.log('[think-loop] ✅ Message sent to Telegram');
          } catch (err) {
            console.warn('[think-loop] ⚠️ Telegram send failed:', err instanceof Error ? err.message : err);
          }
        }

        // Send to WhatsApp (isolated try-catch)
        if (whatsappChatId) {
          try {
            await getRouter().sendMessage(`whatsapp:${whatsappChatId}`, thought.message);
            console.log('[think-loop] ✅ Message sent to WhatsApp');
          } catch (err) {
            console.warn('[think-loop] ⚠️ WhatsApp send failed:', err instanceof Error ? err.message : err);
          }
        }

        // F74b: Store the actual message as type='message'
        await memory.storeMessage({
          sessionId: 'think-loop',
          channel: telegramChatId ? 'telegram' : 'whatsapp',
          role: 'kitt',
          type: 'message',
          content: thought.message,
        });
      } else if (!canSend) {
        console.log('[think-loop] 🔕 Message suppressed (DND mode):', thought.message.slice(0, 50));
      } else {
        console.warn('[think-loop] ⚠️ No chat IDs configured');
      }

      // Format thought for storage (always, even in DND)
      const preview = thought.message.length > 80
        ? thought.message.slice(0, 80) + '...'
        : thought.message;
      thoughtContent = canSend
        ? `Bericht gestuurd: "${preview}"`
        : `Bericht (DND - niet gestuurd): "${preview}"`;
    }
    else if (thought.action === 'remember' && thought.memoryNote) {
      // Store in MEMORY.md
      await memory.addFact(thought.memoryNote, 'Think Loop Notes');

      const preview = thought.memoryNote.length > 80
        ? thought.memoryNote.slice(0, 80) + '...'
        : thought.memoryNote;
      thoughtContent = `Opgeslagen: "${preview}"`;

      console.log('[think-loop] ✅ Memory note stored');
    }
    else if (thought.action === 'reflect' && thought.reasoning) {
      // REFLECT: store the reasoning as an observation
      thoughtContent = `Observatie: ${thought.reasoning}`;

      console.log('[think-loop] ✅ Reflection stored');
    }

    // Store the thought in transcripts (for self-awareness)
    // F53: role 'kitt' + type 'thought' ipv role 'thought'
    if (thoughtContent) {
      await memory.storeMessage({
        sessionId: 'think-loop',
        channel: 'think-loop',
        role: 'kitt',
        type: 'thought',
        content: thoughtContent,
      });
      console.log('[think-loop] 🧠 Thought stored:', thoughtContent.slice(0, 60));
    }

    // Update lastRun for logging purposes
    if (this.registry?.thinkLoop) {
      this.registry.thinkLoop.lastRun = new Date().toISOString();
      await this.saveRegistry();
    }
  }

  /**
   * Enable a task
   */
  async enableTask(taskId: string): Promise<boolean> {
    if (!this.registry) return false;

    const task = this.registry.tasks.find((t) => t.id === taskId);
    if (!task) return false;

    task.enabled = true;
    this.scheduleTask(task);
    await this.saveRegistry();

    return true;
  }

  /**
   * Disable a task
   */
  async disableTask(taskId: string): Promise<boolean> {
    if (!this.registry) return false;

    const task = this.registry.tasks.find((t) => t.id === taskId);
    if (!task) return false;

    task.enabled = false;
    task.nextRun = null;

    const timer = this.timers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(taskId);
    }

    await this.saveRegistry();
    return true;
  }

  /**
   * Get all tasks
   */
  getTasks(): ScheduledTask[] {
    return this.registry?.tasks ?? [];
  }

  /**
   * Get registry status
   */
  getStatus(): {
    initialized: boolean;
    taskCount: number;
    enabledCount: number;
    thinkLoopModel: string;
    thinkLoopLastRun: string | null;
    lastTickAt: number | null;
  } {
    return {
      initialized: this.initialized,
      taskCount: this.registry?.tasks.length ?? 0,
      enabledCount: this.registry?.tasks.filter((t) => t.enabled).length ?? 0,
      thinkLoopModel: this.registry?.thinkLoop?.model ?? 'haiku',
      thinkLoopLastRun: this.registry?.thinkLoop?.lastRun ?? null,
      lastTickAt: this.lastTickAt,
    };
  }

  /**
   * Manually run a task (for testing)
   */
  async runTask(taskId: string): Promise<TaskExecutionResult | null> {
    if (!this.registry) return null;

    const task = this.registry.tasks.find((t) => t.id === taskId);
    if (!task) return null;

    return this.executeTask(task);
  }
}

/**
 * Get the scheduler service singleton
 */
export function getScheduler(): SchedulerService {
  if (!instance) {
    instance = new SchedulerService();
  }
  return instance;
}
