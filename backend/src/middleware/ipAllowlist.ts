import { Request, Response, NextFunction } from 'express';

const ALLOWED_IPS = (process.env.ALLOWED_IPS || '')
  .split(',')
  .map(ip => ip.trim())
  .filter(Boolean);

export function ipAllowlist(req: Request, res: Response, next: NextFunction) {
  if (ALLOWED_IPS.length === 0) return next();
  const ip = req.ip || '';
  const normalized = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (ALLOWED_IPS.includes(normalized)) return next();
  res.status(403).json({ error: 'Forbidden' });
}
