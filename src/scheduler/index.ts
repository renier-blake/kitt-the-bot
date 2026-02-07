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
import {
  buildThinkLoopContext,
  buildThinkPrompt,
  parseThinkResponse,
} from './think-loop.js';
import { logTaskExecution } from './task-engine.js';
import { getSleepUntil, formatWakeTime } from './sleep-mode.js';

const REGISTRY_PATH = process.env.KITT_SCHEDULER_REGISTRY || './profile/schedules/registry.json';
const DEFAULT_TIMEZONE = 'Europe/Amsterdam';

// Singleton instance
let instance: SchedulerService | null = null;

export class SchedulerService {
  private registry: ScheduleRegistry | null = null;
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private initialized = false;

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
   * Run the Think Loop
   * Called by interval timer in bridge/index.ts
   */
  async runThinkLoop(): Promise<void> {
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
    // SLEEP MODE CHECK - MUST BE FIRST
    // ========================================
    const sleepUntil = await getSleepUntil(db);
    if (sleepUntil) {
      const wakeTime = formatWakeTime(sleepUntil);
      console.log(`[think-loop] 😴 Sleeping until ${wakeTime}`);
      return;
    }

    console.log('[think-loop] 🧠 Running think loop');

    // Build context from today's transcripts
    const context = await buildThinkLoopContext(db);

    // Log if no conversations today (but continue - scheduled skills may need to run)
    if (context.messageCount === 0) {
      console.log('[think-loop] 📭 No transcripts today, checking scheduled skills anyway');
    }

    // Build think prompt
    const thinkPrompt = buildThinkPrompt(context);

    // Get model from config (default to haiku for efficiency)
    const model = this.registry?.thinkLoop?.model || 'haiku';

    // Log task summary
    if (context.tasks.length > 0) {
      console.log(`[think-loop] 📋 Open tasks (${context.tasks.length}):`, context.tasks.map(t => `"${t.title}" [${t.priority}]`).join(', '));
    }

    console.log('[think-loop] 🤔 Asking agent to think...', {
      messageCount: context.messageCount,
      openTasks: context.tasks.length,
      skills: context.skills.length,
      skillsWithData: context.skills.filter(s => s.fetchResult).length,
      lastUserMessage: context.lastUserMessage?.minutesAgo,
      model,
    });

    // Run agent with think prompt
    // skipMemorySearch: true because think prompt already contains all context
    // and the prompt is too large to embed (would exceed 8192 token limit)
    const { runAgent } = await import('../bridge/agent.js');
    const response = await runAgent(thinkPrompt, { model, skipMemorySearch: true });

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

    const chatId = this.registry?.telegramChatId;
    let thoughtContent: string | null = null;

    // Handle different action types
    if (thought.action === 'task' && thought.taskId !== undefined && thought.message && thought.taskComplete) {
      // F37: COMPLETE_TASK — Phase 2: store reflection summary internally, do NOT send to Telegram
      const task = context.tasks.find(t => t.id === thought.taskId);
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
      if (!chatId) {
        console.warn('[think-loop] ⚠️ No Telegram chat ID configured');
        return;
      }

      // Find the task title from context
      const task = context.tasks.find(t => t.id === thought.taskId);
      const taskTitle = task?.title || `Task #${thought.taskId}`;

      // Send to Telegram
      const { sendTelegramMessage } = await import('../bridge/telegram.js');
      await sendTelegramMessage(String(chatId), thought.message);

      // Log task execution as 'reminder'
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
      thoughtContent = `Task #${thought.taskId} uitgevoerd: "${preview}"`;

      console.log(`[think-loop] ✅ Task #${thought.taskId} executed and logged`);
    }
    else if (thought.action === 'message' && thought.message) {
      if (!chatId) {
        console.warn('[think-loop] ⚠️ No Telegram chat ID configured');
        return;
      }

      // Send to Telegram
      const { sendTelegramMessage } = await import('../bridge/telegram.js');
      await sendTelegramMessage(String(chatId), thought.message);

      // Format thought for storage
      const preview = thought.message.length > 80
        ? thought.message.slice(0, 80) + '...'
        : thought.message;
      thoughtContent = `Bericht gestuurd: "${preview}"`;

      console.log('[think-loop] ✅ Message sent');
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
  } {
    return {
      initialized: this.initialized,
      taskCount: this.registry?.tasks.length ?? 0,
      enabledCount: this.registry?.tasks.filter((t) => t.enabled).length ?? 0,
      thinkLoopModel: this.registry?.thinkLoop?.model ?? 'haiku',
      thinkLoopLastRun: this.registry?.thinkLoop?.lastRun ?? null,
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
