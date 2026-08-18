import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/errors';

/**
 * Wraps an async route so a rejected promise reaches Express rather than
 * becoming an unhandled rejection.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found' });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
    return;
  }

  // Anything unrecognised is a bug. Log it in full, tell the caller nothing:
  // stack traces and driver messages leak schema and file layout.
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
}
