import { Router } from 'express';
import pool from '../db';
import { likeTerm } from '../lib/catalog';
import { ApiError } from '../lib/errors';
import { LOAN_SELECT } from '../lib/loans';
import { idParam, memberQuerySchema, updateMemberSchema } from '../lib/schemas';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validate';

const router = Router();

// Everything here is administrative. password_hash is never in a projection.
router.use(requireAuth, requireAdmin);

const MEMBER_SELECT = `
  SELECT m.id, m.email, m.first_name, m.last_name, m.role, m.status, m.joined_at,
         COALESCE(o.open_loans, 0)::int    AS open_loans,
         COALESCE(v.overdue_loans, 0)::int AS overdue_loans
    FROM members m
    LEFT JOIN (
      SELECT member_id, COUNT(*) AS open_loans
        FROM loans WHERE returned_at IS NULL GROUP BY member_id
    ) o ON o.member_id = m.id
    LEFT JOIN (
      SELECT member_id, COUNT(*) AS overdue_loans
        FROM loans WHERE returned_at IS NULL AND due_date < CURRENT_DATE GROUP BY member_id
    ) v ON v.member_id = m.id
`;

router.get(
  '/',
  validate(memberQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { q, role, status, page, page_size } = req.query as any;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (q) {
      params.push(likeTerm(q));
      const p = `$${params.length}`;
      conditions.push(
        `(m.email ILIKE ${p} ESCAPE '\\' OR m.first_name ILIKE ${p} ESCAPE '\\' OR m.last_name ILIKE ${p} ESCAPE '\\')`,
      );
    }
    if (role) {
      params.push(role);
      conditions.push(`m.role = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`m.status = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const totalResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM members m ${where}`,
      params,
    );
    const total = totalResult.rows[0].total;

    const offset = (page - 1) * page_size;
    const { rows } = await pool.query(
      `${MEMBER_SELECT} ${where} ORDER BY m.last_name ASC, m.first_name ASC, m.id ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, page_size, offset],
    );

    res.json({
      members: rows,
      pagination: { page, page_size, total, pages: Math.max(1, Math.ceil(total / page_size)) },
    });
  }),
);

router.get(
  '/:id',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(`${MEMBER_SELECT} WHERE m.id = $1`, [req.params.id]);
    if (!rows[0]) throw ApiError.notFound('Member not found');

    const loans = await pool.query(
      `${LOAN_SELECT} WHERE ln.member_id = $1 ORDER BY ln.returned_at IS NOT NULL, ln.due_date ASC`,
      [req.params.id],
    );

    res.json({ member: rows[0], loans: loans.rows });
  }),
);

/** PATCH /api/members/:id — role and status only. */
router.patch(
  '/:id',
  validate(idParam, 'params'),
  validate(updateMemberSchema),
  asyncHandler(async (req, res) => {
    // Coerced to a number by idParam; Number() only restates that for the compiler.
    const id = Number(req.params.id);

    // Refusing self-edits is also what guarantees the library always keeps a
    // way in: the caller is necessarily an active admin, so demoting or
    // suspending anyone *else* still leaves the caller holding the keys. An
    // explicit "last administrator" check on top of this would be unreachable.
    if (id === req.auth!.id) {
      throw ApiError.badRequest('You cannot change your own role or status');
    }

    const target = await pool.query('SELECT id FROM members WHERE id = $1', [id]);
    if (!target.rows[0]) throw ApiError.notFound('Member not found');

    const assignments: string[] = [];
    const params: unknown[] = [];
    for (const [column, value] of Object.entries(req.body)) {
      params.push(value);
      assignments.push(`${column} = $${params.length}`);
    }
    params.push(id);

    await pool.query(`UPDATE members SET ${assignments.join(', ')} WHERE id = $${params.length}`, params);

    const { rows } = await pool.query(`${MEMBER_SELECT} WHERE m.id = $1`, [id]);
    res.json({ member: rows[0] });
  }),
);

export default router;
