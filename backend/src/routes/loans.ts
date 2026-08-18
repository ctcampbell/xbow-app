import { Router } from 'express';
import { config } from '../config';
import pool, { withTransaction } from '../db';
import { ApiError } from '../lib/errors';
import { LOAN_SELECT } from '../lib/loans';
import { borrowSchema, idParam, loanQuerySchema } from '../lib/schemas';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validate';

const router = Router();

router.use(requireAuth);

/**
 * POST /api/loans — borrow a copy.
 *
 * The whole check-then-write runs in one transaction, and the book row is
 * locked first. Two members racing for the last copy therefore serialise:
 * the second one sees the first one's loan and is refused, instead of both
 * reading "1 available" and both succeeding.
 */
router.post(
  '/',
  validate(borrowSchema),
  asyncHandler(async (req, res) => {
    const memberId = req.auth!.id;
    const bookId = req.body.book_id;

    const loanId = await withTransaction(async (client) => {
      const book = await client.query(
        'SELECT id, title, total_copies FROM books WHERE id = $1 FOR UPDATE',
        [bookId],
      );
      if (!book.rows[0]) throw ApiError.notFound('Book not found');

      const onLoan = await client.query(
        'SELECT COUNT(*)::int AS n FROM loans WHERE book_id = $1 AND returned_at IS NULL',
        [bookId],
      );
      if (onLoan.rows[0].n >= book.rows[0].total_copies) {
        throw ApiError.conflict('No copies are available. You can place a hold instead.');
      }

      const mine = await client.query(
        'SELECT COUNT(*)::int AS n FROM loans WHERE member_id = $1 AND returned_at IS NULL',
        [memberId],
      );
      if (mine.rows[0].n >= config.maxOpenLoans) {
        throw ApiError.conflict(`You already have the maximum of ${config.maxOpenLoans} books on loan`);
      }

      const duplicate = await client.query(
        'SELECT 1 FROM loans WHERE book_id = $1 AND member_id = $2 AND returned_at IS NULL',
        [bookId, memberId],
      );
      if (duplicate.rowCount > 0) throw ApiError.conflict('You already have this title on loan');

      const inserted = await client.query(
        `INSERT INTO loans (book_id, member_id, due_date)
         VALUES ($1, $2, CURRENT_DATE + $3::int) RETURNING id`,
        [bookId, memberId, config.loanDays],
      );

      // Borrowing satisfies any hold this member was holding on the title.
      await client.query(
        `UPDATE holds SET status = 'fulfilled'
          WHERE book_id = $1 AND member_id = $2 AND status = 'active'`,
        [bookId, memberId],
      );

      return inserted.rows[0].id;
    });

    const { rows } = await pool.query(`${LOAN_SELECT} WHERE ln.id = $1`, [loanId]);
    res.status(201).json({ loan: rows[0] });
  }),
);

/** POST /api/loans/:id/return — members return their own; admins return any. */
router.post(
  '/:id/return',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const loan = await pool.query('SELECT id, member_id, returned_at FROM loans WHERE id = $1', [
      req.params.id,
    ]);
    if (!loan.rows[0]) throw ApiError.notFound('Loan not found');
    if (req.auth!.role !== 'admin' && loan.rows[0].member_id !== req.auth!.id) {
      throw ApiError.forbidden('This loan belongs to another member');
    }
    if (loan.rows[0].returned_at) throw ApiError.conflict('This loan has already been returned');

    await pool.query('UPDATE loans SET returned_at = NOW() WHERE id = $1 AND returned_at IS NULL', [
      req.params.id,
    ]);

    const { rows } = await pool.query(`${LOAN_SELECT} WHERE ln.id = $1`, [req.params.id]);
    res.json({ loan: rows[0] });
  }),
);

/** POST /api/loans/:id/renew — extend, unless someone else is waiting. */
router.post(
  '/:id/renew',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const id = req.params.id;

    await withTransaction(async (client) => {
      const loan = await client.query(
        'SELECT id, book_id, member_id, due_date, returned_at, renewals FROM loans WHERE id = $1 FOR UPDATE',
        [id],
      );
      const row = loan.rows[0];
      if (!row) throw ApiError.notFound('Loan not found');
      if (req.auth!.role !== 'admin' && row.member_id !== req.auth!.id) {
        throw ApiError.forbidden('This loan belongs to another member');
      }
      if (row.returned_at) throw ApiError.conflict('This loan has already been returned');
      if (row.renewals >= config.maxRenewals) {
        throw ApiError.conflict(`A loan can be renewed at most ${config.maxRenewals} times`);
      }

      const waiting = await client.query(
        `SELECT COUNT(*)::int AS n FROM holds
          WHERE book_id = $1 AND status = 'active' AND member_id <> $2`,
        [row.book_id, row.member_id],
      );
      if (waiting.rows[0].n > 0) {
        throw ApiError.conflict('Another member has placed a hold on this title, so it cannot be renewed');
      }

      // Renewing early should not stack time: the new term runs from today.
      await client.query(
        `UPDATE loans SET due_date = CURRENT_DATE + $1::int, renewals = renewals + 1 WHERE id = $2`,
        [config.loanDays, id],
      );
    });

    const { rows } = await pool.query(`${LOAN_SELECT} WHERE ln.id = $1`, [id]);
    res.json({ loan: rows[0] });
  }),
);

/** GET /api/loans — the whole circulation desk view. Admin only. */
router.get(
  '/',
  requireAdmin,
  validate(loanQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { status, member_id, book_id, page, page_size } = req.query as any;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (status === 'open') conditions.push('ln.returned_at IS NULL');
    if (status === 'returned') conditions.push('ln.returned_at IS NOT NULL');
    if (status === 'overdue') conditions.push('ln.returned_at IS NULL AND ln.due_date < CURRENT_DATE');
    if (member_id) {
      params.push(member_id);
      conditions.push(`ln.member_id = $${params.length}`);
    }
    if (book_id) {
      params.push(book_id);
      conditions.push(`ln.book_id = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const totalResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM loans ln ${where}`,
      params,
    );
    const total = totalResult.rows[0].total;

    const offset = (page - 1) * page_size;
    const { rows } = await pool.query(
      `${LOAN_SELECT} ${where} ORDER BY ln.returned_at IS NOT NULL, ln.due_date ASC, ln.id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, page_size, offset],
    );

    res.json({
      loans: rows,
      pagination: { page, page_size, total, pages: Math.max(1, Math.ceil(total / page_size)) },
    });
  }),
);

export default router;
