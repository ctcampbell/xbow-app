import { Router } from 'express';
import pool from '../db';
import { ApiError } from '../lib/errors';
import { LOAN_SELECT } from '../lib/loans';
import { hashPassword, verifyPassword } from '../lib/password';
import { changePasswordSchema, updateProfileSchema } from '../lib/schemas';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validate';

const router = Router();

router.use(requireAuth);

const PUBLIC_FIELDS = 'id, email, first_name, last_name, role, status, joined_at';

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(`SELECT ${PUBLIC_FIELDS} FROM members WHERE id = $1`, [
      req.auth!.id,
    ]);
    res.json({ member: rows[0] });
  }),
);

/**
 * PATCH /api/me — name and email only.
 *
 * Role and status are deliberately absent from updateProfileSchema: a member
 * must not be able to promote themselves by adding a field to the request.
 */
router.patch(
  '/',
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const assignments: string[] = [];
    const params: unknown[] = [];
    for (const [column, value] of Object.entries(req.body)) {
      params.push(value);
      assignments.push(`${column} = $${params.length}`);
    }
    params.push(req.auth!.id);

    try {
      await pool.query(
        `UPDATE members SET ${assignments.join(', ')} WHERE id = $${params.length}`,
        params,
      );
    } catch (err: any) {
      if (err && err.code === '23505') throw ApiError.conflict('That email address is already registered');
      throw err;
    }

    const { rows } = await pool.query(`SELECT ${PUBLIC_FIELDS} FROM members WHERE id = $1`, [
      req.auth!.id,
    ]);
    res.json({ member: rows[0] });
  }),
);

router.post(
  '/password',
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT password_hash FROM members WHERE id = $1', [
      req.auth!.id,
    ]);
    if (!rows[0]) throw ApiError.unauthorized();

    const ok = await verifyPassword(req.body.current_password, rows[0].password_hash);
    if (!ok) throw ApiError.badRequest('Current password is incorrect');

    await pool.query('UPDATE members SET password_hash = $1 WHERE id = $2', [
      await hashPassword(req.body.new_password),
      req.auth!.id,
    ]);

    // Existing tokens stay valid until they expire; this app has no token
    // store to revoke them against.
    res.json({ ok: true });
  }),
);

/** GET /api/me/loans?status=open|all — scoped to the caller by the query itself. */
router.get(
  '/loans',
  asyncHandler(async (req, res) => {
    const openOnly = req.query.status === 'open';
    const { rows } = await pool.query(
      `${LOAN_SELECT} WHERE ln.member_id = $1 ${openOnly ? 'AND ln.returned_at IS NULL' : ''}
       ORDER BY ln.returned_at IS NOT NULL, ln.due_date ASC, ln.id DESC`,
      [req.auth!.id],
    );
    res.json({ loans: rows });
  }),
);

router.get(
  '/holds',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT h.id, h.book_id, h.placed_at, h.status, b.title, b.author,
              (SELECT COUNT(*)::int FROM holds q
                WHERE q.book_id = h.book_id AND q.status = 'active' AND q.placed_at < h.placed_at) + 1
                AS queue_position
         FROM holds h JOIN books b ON b.id = h.book_id
        WHERE h.member_id = $1 AND h.status = 'active'
        ORDER BY h.placed_at ASC`,
      [req.auth!.id],
    );
    res.json({ holds: rows });
  }),
);

export default router;
