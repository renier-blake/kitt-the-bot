/**
 * Request Logger Middleware
 * Logs method, path, status, and duration for every API request
 */

import type { Request, Response, NextFunction } from 'express';
import { createLogger } from '../logger.js';

const log = createLogger('api');

export function requestLogger() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip static file requests and WebSocket upgrades
    if (!req.path.startsWith('/api/') && req.path !== '/ws') {
      next();
      return;
    }

    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const data: Record<string, unknown> = {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: duration,
      };

      if (req.id) {
        data.requestId = req.id;
      }

      if (res.statusCode >= 500) {
        log.error(`${req.method} ${req.path} ${res.statusCode}`, data);
      } else if (res.statusCode >= 400) {
        log.warn(`${req.method} ${req.path} ${res.statusCode}`, data);
      } else if (duration > 1000) {
        log.warn(`${req.method} ${req.path} slow`, data);
      } else {
        log.info(`${req.method} ${req.path} ${res.statusCode}`, data);
      }
    });

    next();
  };
}
