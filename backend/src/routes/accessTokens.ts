import { Router } from 'express';
import pool from '../db';
import { generateAccessToken, hashAccessToken } from '../lib/accessToken';
import { ApiError } from '../lib/errors';
import { createAccessTokenSchema, idParam } from '../lib/schemas';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validate';

// Mounted under /api/me after requireAuth.
const router = Router();
const PUBLIC_FIELDS = 'id, name, created_at, expires_at, revoked_at';

router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_FIELDS} FROM access_tokens WHERE member_id = $1 ORDER BY created_at DESC, id DESC`,
    [req.auth!.id],
  );
  res.json({ tokens: rows });
}));

router.post('/', validate(createAccessTokenSchema), asyncHandler(async (req, res) => {
  const token = generateAccessToken();
  const { rows } = await pool.query(
    `INSERT INTO access_tokens (member_id, name, token_hash, expires_at)
     VALUES ($1, $2, $3, NOW() + $4 * INTERVAL '1 day') RETURNING ${PUBLIC_FIELDS}`,
    [req.auth!.id, req.body.name, hashAccessToken(token), req.body.expires_in_days],
  );
  res.status(201).json({ token, access_token: rows[0] });
}));

router.delete('/:id', validate(idParam, 'params'), asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query(
    `UPDATE access_tokens SET revoked_at = COALESCE(revoked_at, NOW())
      WHERE id = $1 AND member_id = $2`,
    [req.params.id, req.auth!.id],
  );
  if (!rowCount) throw ApiError.notFound('Access token not found');
  res.status(204).end();
}));

export default router;
