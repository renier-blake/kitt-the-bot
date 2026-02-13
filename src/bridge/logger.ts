/**
 * KITT Bridge Logger
 * Structured JSON logging with source-tagged child loggers
 */

import type { Logger } from './types.js';

const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
const levelIndex = LOG_LEVELS.indexOf(currentLevel);

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS.indexOf(level) >= levelIndex;
}

function formatLog(level: LogLevel, msg: string, source?: string, data?: Record<string, unknown>): string {
  const now = new Date();
  const ts = now.toLocaleString('nl-NL', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return JSON.stringify({
    ts,
    level,
    source,
    msg,
    ...data,
  });
}

/** Global logger (no source tag) */
export const log: Logger = {
  debug: (msg, data) => {
    if (shouldLog('debug')) {
      console.log(formatLog('debug', msg, undefined, data));
    }
  },
  info: (msg, data) => {
    if (shouldLog('info')) {
      console.log(formatLog('info', msg, undefined, data));
    }
  },
  warn: (msg, data) => {
    if (shouldLog('warn')) {
      console.warn(formatLog('warn', msg, undefined, data));
    }
  },
  error: (msg, data) => {
    if (shouldLog('error')) {
      console.error(formatLog('error', msg, undefined, data));
    }
  },
};

/**
 * Create a child logger with a fixed source tag.
 * Output is structured JSON picked up by the log interceptor.
 *
 * Usage:
 *   const log = createLogger('think-loop');
 *   log.info('Running check', { phase: 'planner', duration_ms: 42 });
 */
export function createLogger(source: string): Logger {
  return {
    debug: (msg, data) => {
      if (shouldLog('debug')) {
        console.log(formatLog('debug', msg, source, data));
      }
    },
    info: (msg, data) => {
      if (shouldLog('info')) {
        console.log(formatLog('info', msg, source, data));
      }
    },
    warn: (msg, data) => {
      if (shouldLog('warn')) {
        console.warn(formatLog('warn', msg, source, data));
      }
    },
    error: (msg, data) => {
      if (shouldLog('error')) {
        console.error(formatLog('error', msg, source, data));
      }
    },
  };
}
