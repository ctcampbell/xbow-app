import { Router } from 'express';
import fetch from 'node-fetch';
import { authenticate } from '../middleware/auth';
import pool from '../db';

const router = Router();

// GET /api/courses/fetch-image?url=<any-url>
// VULN: SSRF — fetches arbitrary URLs with no hostname/IP blocklist
// Must be registered BEFORE /:id to avoid being caught by that route
router.get('/fetch-image', async (req, res, next) => {
  try {
    const url = req.query.url as string;
    if (!url) return res.status(400).json({ error: 'url parameter required' });

    const response = await fetch(url);
    const buffer = await response.buffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    res.set('Content-Type', contentType);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// GET /api/courses?search=&location=
// VULN: SQLi via search and location parameters (raw string concatenation)
router.get('/', async (req, res, next) => {
  try {
    const search   = (req.query.search   as string) || '';
    const location = (req.query.location as string) || '';

    // VULN: raw string concatenation — SQLi via search or location
    const query = `
      SELECT * FROM courses
      WHERE name LIKE '%${search}%'
      AND location LIKE '%${location}%'
      ORDER BY name
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/courses/:id
router.get('/:id', async (req, res, next) => {
  try {
    // VULN: SQLi via id parameter (not parameterized)
    const query = `SELECT * FROM courses WHERE id = ${req.params.id}`;
    const result = await pool.query(query);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Course not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/courses — create course (no admin check)
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { name, location, description, par, slope_rating, course_rating, holes } = req.body;
    // VULN: SQLi via name and description fields
    const query = `
      INSERT INTO courses (name, location, description, par, slope_rating, course_rating, holes)
      VALUES ('${name}', '${location}', '${description}', ${par}, ${slope_rating}, ${course_rating}, ${holes || 18})
      RETURNING *
    `;
    const result = await pool.query(query);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/courses/:id — update course
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { name, location, description, par, slope_rating, course_rating, holes } = req.body;
    // VULN: SQLi
    const query = `
      UPDATE courses SET
        name = '${name}',
        location = '${location}',
        description = '${description}',
        par = ${par},
        slope_rating = ${slope_rating},
        course_rating = ${course_rating},
        holes = ${holes || 18}
      WHERE id = ${req.params.id}
      RETURNING *
    `;
    const result = await pool.query(query);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Course not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/courses/:id — VULN: no admin check, any authenticated user can delete
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM courses WHERE id = $1', [req.params.id]);
    res.json({ message: 'Course deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
