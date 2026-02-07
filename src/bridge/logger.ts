/**
 * KITT Bridge Logger
 * Simple structured JSON logging
 */

import type { Logger } from './types.js';

const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
const levelIndex = LOG_LEVELS.indexOf(currentLevel);

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS.indexOf(level) >= levelIndex;
}

function formatLog(level: LogLevel, msg: string, data?: Record<string, unknown>): string {
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
    msg,
    ...data,
  });
}

export const log: Logger = {
  debug: (msg, data) => {
    if (shouldLog('debug')) {
      console.log(formatLog('debug', msg, data));
    }
  },
  info: (msg, data) => {
    if (shouldLog('info')) {
      console.log(formatLog('info', msg, data));
    }
  },
  warn: (msg, data) => {
    if (shouldLog('warn')) {
      console.warn(formatLog('warn', msg, data));
    }
  },
  error: (msg, data) => {
    if (shouldLog('error')) {
      console.error(formatLog('error', msg, data));
    }
  },
};
