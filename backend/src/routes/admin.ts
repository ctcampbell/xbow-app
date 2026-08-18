import { Router } from 'express';
import pool from '../db';
import { LOAN_SELECT } from '../lib/loans';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.use(requireAuth, requireAdmin);

/** GET /api/admin/stats — the desk dashboard, in one round trip. */
router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM books)                                          AS titles,
        (SELECT COALESCE(SUM(total_copies), 0)::int FROM books)                    AS copies,
        (SELECT COUNT(*)::int FROM members)                                        AS members,
        (SELECT COUNT(*)::int FROM members WHERE status = 'suspended')             AS suspended_members,
        (SELECT COUNT(*)::int FROM loans WHERE returned_at IS NULL)                AS open_loans,
        (SELECT COUNT(*)::int FROM loans
          WHERE returned_at IS NULL AND due_date < CURRENT_DATE)                   AS overdue_loans,
        (SELECT COUNT(*)::int FROM loans
          WHERE borrowed_at >= NOW() - INTERVAL '30 days')                         AS loans_last_30_days,
        (SELECT COUNT(*)::int FROM holds WHERE status = 'active')                  AS active_holds
    `);

    const overdue = await pool.query(
      `${LOAN_SELECT} WHERE ln.returned_at IS NULL AND ln.due_date < CURRENT_DATE
       ORDER BY ln.due_date ASC LIMIT 10`,
    );

    const popular = await pool.query(`
      SELECT b.id, b.title, b.author, COUNT(ln.id)::int AS loan_count
        FROM books b JOIN loans ln ON ln.book_id = b.id
       WHERE ln.borrowed_at >= NOW() - INTERVAL '90 days'
       GROUP BY b.id, b.title, b.author
       ORDER BY loan_count DESC, b.title ASC
       LIMIT 5
    `);

    res.json({ stats: rows[0], overdue: overdue.rows, popular: popular.rows });
  }),
);

export default router;
