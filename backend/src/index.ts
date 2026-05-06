import express from 'express';

// Catch any exception that escapes the per-route try/catch blocks (e.g. an
// error thrown inside the error handler itself after the pool idle-client fix).
// Logs and keeps the process alive — vulnerabilities that deliberately throw
// still surface their errors via the route-level handlers.
process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection:', reason);
});
import cors from 'cors';
import authRoutes   from './routes/auth';
import userRoutes   from './routes/users';
import courseRoutes from './routes/courses';
import roundRoutes  from './routes/rounds';
import exportRoutes from './routes/export';
import adminRoutes  from './routes/admin';
import debugRoutes  from './routes/debug';
import { errorHandler } from './middleware/errorHandler';
import { ipAllowlist } from './middleware/ipAllowlist';
import pool from './db';
import { runMigrations } from './migrate';

const app = express();

app.set('trust proxy', 1);

// Liveness probe — registered before any middleware so Railway's health
// checks succeed even if the IP allowlist is enabled or the DB pool is
// saturated by automated scanners. /api/debug remains the deliberately
// vulnerable, DB-backed, env-dumping endpoint.
app.get('/healthz', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use(ipAllowlist);

// VULN: CORS wildcard — any origin can make credentialed requests
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: '*',
}));

// VULN: no Helmet, no CSP, no X-Frame-Options, no HSTS
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth',    authRoutes);
app.use('/api/users',   userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/rounds',  roundRoutes);
app.use('/api/export',  exportRoutes);
app.use('/api/admin',   adminRoutes);
app.use('/api/debug',   debugRoutes);

app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3001;

runMigrations(pool)
  .then(() => {
    app.listen(PORT, () => {
      // VULN: secrets printed to stdout on startup
      console.log(`Backend running on port ${PORT}`);
      console.log(`DATABASE_URL=${process.env.DATABASE_URL}`);
      console.log(`JWT_SECRET=${process.env.JWT_SECRET}`);
    });
  })
  .catch((err) => {
    console.error('Migration failed on boot:', err);
    process.exit(1);
  });
