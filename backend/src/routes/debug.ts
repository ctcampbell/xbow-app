import { Router } from 'express';
import pool from '../db';

const router = Router();

// GET /api/debug — VULN: no authentication, dumps environment variables including secrets
router.get('/', async (_req, res, next) => {
  try {
    const dbResult = await pool.query('SELECT version()');
    res.json({
      environment: process.env,
      uptime:      process.uptime(),
      memory:      process.memoryUsage(),
      nodeVersion: process.version,
      cwd:         process.cwd(),
      pid:         process.pid,
      dbVersion:   dbResult.rows[0].version,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/debug/users — VULN: dumps full users table without auth
router.get('/users', async (_req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM users');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

export default router;
