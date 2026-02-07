/**
 * KITT Scheduler - Type Definitions
 */

export interface ScheduledTask {
  /** Unique task identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Skill name to execute */
  skill: string;
  /** Action/method to call */
  action: string;
  /** Cron expression (e.g., "0 23 * * *") */
  schedule: string;
  /** Whether task is enabled */
  enabled: boolean;
  /** ISO timestamp of last run */
  lastRun: string | null;
  /** ISO timestamp of next scheduled run */
  nextRun: string | null;
}

export interface ThinkLoopConfig {
  /** Model to use for think loop (haiku recommended for cost efficiency) */
  model: 'haiku' | 'sonnet' | 'opus';
  /** ISO timestamp of last run (for logging only) */
  lastRun: string | null;
}

export interface ScheduleRegistry {
  /** Schema version */
  version: number;
  /** Timezone for scheduling (e.g., "Europe/Amsterdam") */
  timezone: string;
  /** Scheduled tasks */
  tasks: ScheduledTask[];
  /** Think loop configuration */
  thinkLoop: ThinkLoopConfig;
  /** Telegram chat ID for outgoing messages */
  telegramChatId?: number;
}

export interface ParsedCron {
  minute: number | '*' | number[];
  hour: number | '*' | number[];
  dayOfMonth: number | '*' | number[];
  month: number | '*' | number[];
  dayOfWeek: number | '*' | number[];
}

export interface TaskExecutionResult {
  taskId: string;
  success: boolean;
  startTime: Date;
  endTime: Date;
  error?: string;
  output?: string;
}
