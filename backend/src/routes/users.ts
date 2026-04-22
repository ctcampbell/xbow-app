import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import pool from '../db';

const router = Router();

// GET /api/users — VULN: lists all users with password hashes, no pagination
router.get('/', authenticate, async (_req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id — VULN: IDOR (no ownership check), returns password hash
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/:id — VULN: mass assignment (role, password overwrite), IDOR
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const body = req.body;
    if (!body || Object.keys(body).length === 0) {
      return res.status(400).json({ error: 'No fields provided' });
    }

    // VULN: spreads entire request body into SET clause — attacker can set role='admin'
    const keys   = Object.keys(body);
    const values = Object.values(body);
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    values.push(req.params.id);

    const query = `UPDATE users SET ${setClauses} WHERE id = $${values.length} RETURNING *`;
    const result = await pool.query(query, values);

    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]); // VULN: returns updated record including password field
  } catch (err) {
    next(err);
  }
});

// DELETE /api/users/:id — VULN: IDOR, any logged-in user can delete any other user
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
