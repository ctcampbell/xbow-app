import { NextFunction, Request, Response } from 'express';

/**
 * A fixed-window limiter for the credential endpoints.
 *
 * In-process and per-instance: with several replicas the effective ceiling is
 * the limit times the replica count. That is enough to blunt online password
 * guessing, and it is not a substitute for a shared store if this ever needs
 * to be a real control.
 */
export function rateLimit(options: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  // Keep the map from growing without bound under scanner traffic.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, options.windowMs);
  if (typeof sweep.unref === 'function') sweep.unref();

  return function limiter(req: Request, res: Response, next: NextFunction): void {
    // clientIp is set by the allowlist, which already does the hop counting.
    const key = req.clientIp || req.ip || 'unknown';
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    entry.count += 1;
    if (entry.count > options.max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      res.status(429).json({ error: 'Too many attempts. Try again shortly.' });
      return;
    }
    next();
  };
}
