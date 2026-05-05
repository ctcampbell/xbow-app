import { Router } from 'express';
import * as crypto from 'crypto';
import jwt from 'jsonwebtoken';
import pool from '../db';

const router = Router();

function md5(s: string): string {
  return crypto.createHash('md5').update(s).digest('hex');
}

// POST /api/auth/register
// VULN: user enumeration (different error for existing vs new email), no input validation
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, first_name, last_name } = req.body;

    // VULN: user enumeration — different message reveals if email is taken
    const existing = await pool.query(`SELECT id FROM users WHERE email = '${email}'`);
    if ((existing?.rows ?? []).length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // VULN: MD5 password hashing
    const hashedPassword = md5(password);

    // VULN: SQLi via first_name/last_name/email (no parameterization)
    const result = await pool.query(`
      INSERT INTO users (email, password, first_name, last_name)
      VALUES ('${email}', '${hashedPassword}', '${first_name}', '${last_name}')
      RETURNING *
    `);

    const user = (result?.rows ?? [])[0];
    if (!user) return res.status(500).json({ error: 'Registration failed' });
    // VULN: no expiry on token, secret is weak
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'secret'
    );

    // VULN: returns full user record including password hash
    res.status(201).json({ token, user });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
// VULN: SQLi via email, user enumeration, MD5, no rate limiting
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const hashedPassword = md5(password || '');

    // VULN: raw string concatenation — SQLi via email field
    const query = `SELECT * FROM users WHERE email = '${email}' AND password = '${hashedPassword}'`;
    const result = await pool.query(query);
    // Guard against stacked-query injection returning a non-SELECT result (no .rows)
    const loginRows = result?.rows ?? [];

    if (loginRows.length === 0) {
      // VULN: user enumeration — check email separately to give a different error message
      const userCheck = await pool.query(`SELECT id FROM users WHERE email = '${email}'`);
      const checkRows = userCheck?.rows ?? [];
      if (checkRows.length > 0) {
        return res.status(401).json({ error: 'Invalid password' });
      }
      return res.status(401).json({ error: 'User not found' });
    }

    const user = loginRows[0];
    // VULN: no expiresIn, weak secret
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'secret'
    );

    // VULN: returns full user record including password hash
    res.json({ token, user });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout — stateless JWT, nothing to invalidate
router.post('/logout', (_req, res) => {
  res.json({ message: 'Logged out' });
});

export default router;
