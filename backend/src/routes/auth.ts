import { Router } from 'express';
import pool from '../db';
import { ApiError } from '../lib/errors';
import { burnTime, hashPassword, verifyPassword } from '../lib/password';
import { loginSchema, registerSchema } from '../lib/schemas';
import { issueToken } from '../lib/token';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validate';

const router = Router();

const PUBLIC_FIELDS = 'id, email, first_name, last_name, role, status, joined_at';

router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { email, password, first_name, last_name } = req.body;
    const password_hash = await hashPassword(password);

    // Role is never read from the request: self-registration always produces a
    // member, and only an existing admin can promote one.
    let member;
    try {
      const { rows } = await pool.query(
        `INSERT INTO members (email, password_hash, first_name, last_name)
         VALUES ($1, $2, $3, $4)
         RETURNING ${PUBLIC_FIELDS}`,
        [email, password_hash, first_name, last_name],
      );
      member = rows[0];
    } catch (err: any) {
      if (err && err.code === '23505') throw ApiError.conflict('That email address is already registered');
      throw err;
    }

    res.status(201).json({ token: issueToken(member), member });
  }),
);

router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const { rows } = await pool.query(
      `SELECT ${PUBLIC_FIELDS}, password_hash FROM members WHERE email = $1`,
      [email],
    );
    const member = rows[0];

    if (!member) {
      // Spend the same time we would have on a real comparison.
      await burnTime();
      throw ApiError.unauthorized('Incorrect email or password');
    }

    const ok = await verifyPassword(password, member.password_hash);
    // The same message either way: distinguishing them tells an attacker which
    // addresses are registered.
    if (!ok) throw ApiError.unauthorized('Incorrect email or password');

    if (member.status === 'suspended') {
      throw ApiError.forbidden('This membership is suspended. Contact the library desk.');
    }

    delete member.password_hash;
    res.json({ token: issueToken(member), member });
  }),
);

export default router;
