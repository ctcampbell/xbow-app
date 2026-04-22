import { Router, Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import jwt from 'jsonwebtoken';
import pool from '../db';

const router = Router();

function md5(s: string): string {
  return crypto.createHash('md5').update(s).digest('hex');
}

// POST /api/admin/login — admin-specific login, checks role='admin' in DB
// VULN: SQLi via email, user enumeration, MD5 password, weak JWT secret, no expiry
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const hashed = md5(password || '');

    // VULN: SQLi via email
    const result = await pool.query(
      `SELECT * FROM users WHERE email = '${email}' AND password = '${hashed}'`
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Not an admin account' });
    }

    // VULN: no expiry, weak secret 'secret'
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'secret'
    );

    res.json({ token, user });
  } catch (err) {
    next(err);
  }
});

// VULN: role taken from JWT payload — never verified against DB
// An attacker who knows the secret (or uses alg:none) can forge admin tokens
function adminOnly(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Admin token required' });
  }
  try {
    const token = authHeader.replace('Bearer ', '');
    // VULN: accepts none algorithm, role taken from payload without DB check
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret', {
      algorithms: ['HS256', 'none'] as any,
    }) as any;
    if (payload.role !== 'admin') {
      return res.status(403).json({ error: 'Admin role required' });
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Users
router.get('/users', adminOnly, async (_req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY id');
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.get('/users/:id', adminOnly, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.put('/users/:id', adminOnly, async (req, res, next) => {
  try {
    const body = req.body;
    const keys   = Object.keys(body);
    const values = Object.values(body);
    const set    = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE users SET ${set} WHERE id = $${values.length} RETURNING *`,
      values
    );
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.delete('/users/:id', adminOnly, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (err) { next(err); }
});

// Courses
router.get('/courses', adminOnly, async (_req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM courses ORDER BY id');
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.post('/courses', adminOnly, async (req, res, next) => {
  try {
    const { name, location, description, par, slope_rating, course_rating, holes } = req.body;
    const result = await pool.query(
      `INSERT INTO courses (name, location, description, par, slope_rating, course_rating, holes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, location, description, par, slope_rating, course_rating, holes || 18]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

router.put('/courses/:id', adminOnly, async (req, res, next) => {
  try {
    const { name, location, description, par, slope_rating, course_rating, holes } = req.body;
    const result = await pool.query(
      `UPDATE courses SET name=$1, location=$2, description=$3, par=$4,
       slope_rating=$5, course_rating=$6, holes=$7 WHERE id=$8 RETURNING *`,
      [name, location, description, par, slope_rating, course_rating, holes || 18, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.delete('/courses/:id', adminOnly, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM courses WHERE id = $1', [req.params.id]);
    res.json({ message: 'Course deleted' });
  } catch (err) { next(err); }
});

// Rounds
router.get('/rounds', adminOnly, async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT r.*, c.name as course_name, u.email, u.first_name, u.last_name
       FROM rounds r
       JOIN courses c ON c.id = r.course_id
       JOIN users u ON u.id = r.user_id
       ORDER BY r.id`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.delete('/rounds/:id', adminOnly, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM rounds WHERE id = $1', [req.params.id]);
    res.json({ message: 'Round deleted' });
  } catch (err) { next(err); }
});

export default router;
