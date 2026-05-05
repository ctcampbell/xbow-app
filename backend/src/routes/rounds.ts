import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import pool from '../db';

const router = Router();

// GET /api/rounds — returns rounds for the logged-in user
// VULN: user can also pass ?user_id= to see any user's rounds (no ownership enforcement)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const userId = (req.query.user_id as string) || req.user!.id;
    // VULN: user_id taken from query param without validation
    const result = await pool.query(
      `SELECT r.*, c.name as course_name, c.par as course_par,
              u.first_name, u.last_name
       FROM rounds r
       JOIN courses c ON c.id = r.course_id
       JOIN users u ON u.id = r.user_id
       WHERE r.user_id = ${userId}
       ORDER BY r.date_played DESC`,
    );
    res.json(result?.rows ?? []);
  } catch (err) {
    next(err);
  }
});

// GET /api/rounds/:id — VULN: IDOR, no ownership check
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const roundResult = await pool.query(
      `SELECT r.*, c.name as course_name, c.par as course_par,
              u.first_name, u.last_name, u.email
       FROM rounds r
       JOIN courses c ON c.id = r.course_id
       JOIN users u ON u.id = r.user_id
       WHERE r.id = $1`,
      [req.params.id]
    );
    if (roundResult.rows.length === 0) return res.status(404).json({ error: 'Round not found' });

    const holeResult = await pool.query(
      'SELECT * FROM hole_scores WHERE round_id = $1 ORDER BY hole_number',
      [req.params.id]
    );

    res.json({ ...roundResult.rows[0], hole_scores: holeResult.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/rounds — create a round
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { course_id, date_played, total_score, notes, hole_scores } = req.body;
    // VULN: user_id can be overridden from body (no forced req.user.id)
    const userId = req.body.user_id || req.user!.id;

    // VULN: SQLi via notes field
    const roundResult = await pool.query(`
      INSERT INTO rounds (user_id, course_id, date_played, total_score, notes)
      VALUES (${userId}, ${course_id}, '${date_played}', ${total_score || 0}, '${notes || ''}')
      RETURNING *
    `);
    const round = (roundResult?.rows ?? [])[0];
    if (!round) return res.status(500).json({ error: 'Failed to create round' });

    if (Array.isArray(hole_scores)) {
      for (const hs of hole_scores) {
        await pool.query(
          'INSERT INTO hole_scores (round_id, hole_number, score, par) VALUES ($1, $2, $3, $4)',
          [round.id, hs.hole_number, hs.score, hs.par]
        );
      }
    }

    const holeResult = await pool.query(
      'SELECT * FROM hole_scores WHERE round_id = $1 ORDER BY hole_number',
      [round.id]
    );

    res.status(201).json({ ...round, hole_scores: holeResult.rows });
  } catch (err) {
    next(err);
  }
});

// PUT /api/rounds/:id — VULN: IDOR, no ownership check, SQLi via notes
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { course_id, date_played, total_score, notes, hole_scores } = req.body;

    // VULN: raw string concat in UPDATE — SQLi via notes
    const query = `
      UPDATE rounds SET
        course_id = ${course_id},
        date_played = '${date_played}',
        total_score = ${total_score},
        notes = '${notes || ''}'
      WHERE id = ${req.params.id}
      RETURNING *
    `;
    const result = await pool.query(query);
    const roundRows = result?.rows ?? [];
    if (roundRows.length === 0) return res.status(404).json({ error: 'Round not found' });

    if (Array.isArray(hole_scores)) {
      await pool.query('DELETE FROM hole_scores WHERE round_id = $1', [req.params.id]);
      for (const hs of hole_scores) {
        await pool.query(
          'INSERT INTO hole_scores (round_id, hole_number, score, par) VALUES ($1, $2, $3, $4)',
          [req.params.id, hs.hole_number, hs.score, hs.par]
        );
      }
    }

    const holeResult = await pool.query(
      'SELECT * FROM hole_scores WHERE round_id = $1 ORDER BY hole_number',
      [req.params.id]
    );

    res.json({ ...roundRows[0], hole_scores: holeResult.rows });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/rounds/:id — VULN: IDOR, any authenticated user can delete any round
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM rounds WHERE id = $1', [req.params.id]);
    res.json({ message: 'Round deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
