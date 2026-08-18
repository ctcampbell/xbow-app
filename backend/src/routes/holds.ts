import { Router } from 'express';
import pool, { withTransaction } from '../db';
import { ApiError } from '../lib/errors';
import { borrowSchema, idParam } from '../lib/schemas';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validate';

const router = Router();

router.use(requireAuth);

const HOLD_SELECT = `
  SELECT h.id, h.book_id, h.member_id, h.placed_at, h.status,
         b.title, b.author,
         m.first_name, m.last_name, m.email
    FROM holds h
    JOIN books b   ON b.id = h.book_id
    JOIN members m ON m.id = h.member_id
`;

/** POST /api/holds — queue for a title whose copies are all out. */
router.post(
  '/',
  validate(borrowSchema),
  asyncHandler(async (req, res) => {
    const memberId = req.auth!.id;
    const bookId = req.body.book_id;

    const holdId = await withTransaction(async (client) => {
      const book = await client.query('SELECT id, total_copies FROM books WHERE id = $1 FOR UPDATE', [
        bookId,
      ]);
      if (!book.rows[0]) throw ApiError.notFound('Book not found');

      const onLoan = await client.query(
        'SELECT COUNT(*)::int AS n FROM loans WHERE book_id = $1 AND returned_at IS NULL',
        [bookId],
      );
      if (onLoan.rows[0].n < book.rows[0].total_copies) {
        throw ApiError.conflict('A copy is available — borrow it rather than placing a hold');
      }

      const holding = await client.query(
        'SELECT 1 FROM loans WHERE book_id = $1 AND member_id = $2 AND returned_at IS NULL',
        [bookId, memberId],
      );
      if (holding.rowCount > 0) throw ApiError.conflict('You already have this title on loan');

      const existing = await client.query(
        `SELECT 1 FROM holds WHERE book_id = $1 AND member_id = $2 AND status = 'active'`,
        [bookId, memberId],
      );
      if (existing.rowCount > 0) throw ApiError.conflict('You already have a hold on this title');

      const inserted = await client.query(
        'INSERT INTO holds (book_id, member_id) VALUES ($1, $2) RETURNING id',
        [bookId, memberId],
      );
      return inserted.rows[0].id;
    });

    const { rows } = await pool.query(`${HOLD_SELECT} WHERE h.id = $1`, [holdId]);
    res.status(201).json({ hold: rows[0] });
  }),
);

/** DELETE /api/holds/:id — cancel. Members cancel their own, admins any. */
router.delete(
  '/:id',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const hold = await pool.query('SELECT id, member_id, status FROM holds WHERE id = $1', [
      req.params.id,
    ]);
    if (!hold.rows[0]) throw ApiError.notFound('Hold not found');
    if (req.auth!.role !== 'admin' && hold.rows[0].member_id !== req.auth!.id) {
      throw ApiError.forbidden('This hold belongs to another member');
    }
    if (hold.rows[0].status !== 'active') throw ApiError.conflict('This hold is no longer active');

    await pool.query(`UPDATE holds SET status = 'cancelled' WHERE id = $1`, [req.params.id]);
    res.status(204).send();
  }),
);

/** GET /api/holds — the full queue. Admin only; members use /api/me/holds. */
router.get(
  '/',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      `${HOLD_SELECT} WHERE h.status = 'active' ORDER BY h.placed_at ASC`,
    );
    res.json({ holds: rows });
  }),
);

export default router;
