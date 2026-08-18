import { NextFunction, Request, Response } from 'express';
import pool from '../db';
import { ApiError } from '../lib/errors';
import { verifyToken } from '../lib/token';
import { asyncHandler } from './errorHandler';

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (typeof header !== 'string') return null;
  const [scheme, value] = header.split(' ');
  if (!value || scheme.toLowerCase() !== 'bearer') return null;
  return value.trim() || null;
}

/**
 * Authenticates the caller and loads their CURRENT role and status.
 *
 * The token proves identity only. Role and status are re-read from the
 * database on every request, so an admin demoting or suspending someone takes
 * effect immediately instead of when their token happens to expire.
 */
export const requireAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = bearerToken(req);
  if (!token) throw ApiError.unauthorized();

  const claims = verifyToken(token);
  if (!claims) throw ApiError.unauthorized('Invalid or expired token');

  const { rows } = await pool.query(
    'SELECT id, email, role, status FROM members WHERE id = $1',
    [claims.id],
  );
  const member = rows[0];
  if (!member) throw ApiError.unauthorized('Invalid or expired token');
  if (member.status === 'suspended') {
    throw ApiError.forbidden('This membership is suspended. Contact the library desk.');
  }

  req.auth = { id: member.id, email: member.email, role: member.role };
  next();
});

/** Must run after requireAuth. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.auth) throw ApiError.unauthorized();
  if (req.auth.role !== 'admin') throw ApiError.forbidden('Administrator access required');
  next();
}
