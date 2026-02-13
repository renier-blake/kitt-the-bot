/**
 * Request ID Middleware
 * Generates a unique ID per request, available as req.id and x-request-id header
 */

import type { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

export function requestId() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const id = req.headers['x-request-id'] as string || randomBytes(8).toString('hex');
    req.id = id;
    res.setHeader('x-request-id', id);
    next();
  };
}
