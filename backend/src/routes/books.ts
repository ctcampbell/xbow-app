import { Router } from 'express';
import pool from '../db';
import { BOOK_FROM, BOOK_SELECT, SORT_COLUMNS, likeTerm } from '../lib/catalog';
import { ApiError } from '../lib/errors';
import { catalogQuerySchema, createBookSchema, idParam, updateBookSchema } from '../lib/schemas';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validate';

const router = Router();

/** GET /api/books — catalogue search. Any signed-in member may browse. */
router.get(
  '/',
  requireAuth,
  validate(catalogQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { q, genre, author, available, sort, direction, page, page_size } = req.query as any;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (q) {
      params.push(likeTerm(q));
      const p = `$${params.length}`;
      conditions.push(`(b.title ILIKE ${p} ESCAPE '\\' OR b.author ILIKE ${p} ESCAPE '\\' OR b.isbn ILIKE ${p} ESCAPE '\\')`);
    }
    if (genre) {
      params.push(genre);
      conditions.push(`LOWER(b.genre) = LOWER($${params.length})`);
    }
    if (author) {
      params.push(likeTerm(author));
      conditions.push(`b.author ILIKE $${params.length} ESCAPE '\\'`);
    }
    if (available === true) {
      conditions.push('(b.total_copies - COALESCE(l.open_count, 0)) > 0');
    } else if (available === false) {
      conditions.push('(b.total_copies - COALESCE(l.open_count, 0)) <= 0');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    // Both come from enum-validated keys, never from raw input.
    const orderBy = `${SORT_COLUMNS[sort]} ${direction === 'desc' ? 'DESC' : 'ASC'}`;

    const totalResult = await pool.query(
      `SELECT COUNT(*)::int AS total ${BOOK_FROM} ${where}`,
      params,
    );
    const total = totalResult.rows[0].total;

    const offset = (page - 1) * page_size;
    const { rows } = await pool.query(
      `${BOOK_SELECT} ${where} ORDER BY ${orderBy}, b.id ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, page_size, offset],
    );

    res.json({
      books: rows,
      pagination: { page, page_size, total, pages: Math.max(1, Math.ceil(total / page_size)) },
    });
  }),
);

/** GET /api/books/genres — the distinct genre list, for filter controls. */
router.get(
  '/genres',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT DISTINCT genre FROM books WHERE genre IS NOT NULL AND genre <> '' ORDER BY genre`,
    );
    res.json({ genres: rows.map((r) => r.genre) });
  }),
);

router.get(
  '/:id',
  requireAuth,
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(`${BOOK_SELECT} WHERE b.id = $1`, [req.params.id]);
    if (!rows[0]) throw ApiError.notFound('Book not found');
    res.json({ book: rows[0] });
  }),
);

router.post(
  '/',
  requireAuth,
  requireAdmin,
  validate(createBookSchema),
  asyncHandler(async (req, res) => {
    const { isbn, title, author, publisher, published_year, genre, description, total_copies } = req.body;
    try {
      const { rows } = await pool.query(
        `INSERT INTO books (isbn, title, author, publisher, published_year, genre, description, total_copies)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [isbn ?? null, title, author, publisher ?? null, published_year ?? null, genre ?? null, description ?? null, total_copies],
      );
      const created = await pool.query(`${BOOK_SELECT} WHERE b.id = $1`, [rows[0].id]);
      res.status(201).json({ book: created.rows[0] });
    } catch (err: any) {
      if (err && err.code === '23505') throw ApiError.conflict('A book with that ISBN already exists');
      throw err;
    }
  }),
);

router.patch(
  '/:id',
  requireAuth,
  requireAdmin,
  validate(idParam, 'params'),
  validate(updateBookSchema),
  asyncHandler(async (req, res) => {
    const id = req.params.id;

    // Column names come from the schema's own key set, so a caller cannot name
    // a column the schema does not define.
    const assignments: string[] = [];
    const params: unknown[] = [];
    for (const [column, value] of Object.entries(req.body)) {
      params.push(value);
      assignments.push(`${column} = $${params.length}`);
    }
    params.push(id);

    // Reducing total_copies below what is currently lent out would make
    // availability negative, so refuse rather than silently allow it.
    if (req.body.total_copies !== undefined) {
      const open = await pool.query(
        'SELECT COUNT(*)::int AS n FROM loans WHERE book_id = $1 AND returned_at IS NULL',
        [id],
      );
      if (req.body.total_copies < open.rows[0].n) {
        throw ApiError.conflict(
          `${open.rows[0].n} copies are currently on loan; total_copies cannot be lower than that`,
        );
      }
    }

    try {
      const { rowCount } = await pool.query(
        `UPDATE books SET ${assignments.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
        params,
      );
      if (rowCount === 0) throw ApiError.notFound('Book not found');
    } catch (err: any) {
      if (err && err.code === '23505') throw ApiError.conflict('A book with that ISBN already exists');
      throw err;
    }

    const { rows } = await pool.query(`${BOOK_SELECT} WHERE b.id = $1`, [id]);
    res.json({ book: rows[0] });
  }),
);

router.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const id = req.params.id;

    // Loan history is worth more than the ability to delete a row. A title
    // that has ever circulated is retired by setting total_copies to 0.
    const loans = await pool.query('SELECT COUNT(*)::int AS n FROM loans WHERE book_id = $1', [id]);
    if (loans.rows[0].n > 0) {
      throw ApiError.conflict(
        'This book has loan history and cannot be deleted. Set total_copies to 0 to retire it.',
      );
    }

    const { rowCount } = await pool.query('DELETE FROM books WHERE id = $1', [id]);
    if (rowCount === 0) throw ApiError.notFound('Book not found');
    res.status(204).send();
  }),
);

export default router;
