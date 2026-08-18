import cors from 'cors';
import express from 'express';
import { config } from './config';
import pool from './db';
import { rateLimit } from './lib/rateLimit';
import { runMigrations } from './migrate';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { accessConfig, ipAllowlist, logStartupState } from './middleware/ipAllowlist';
import adminRoutes from './routes/admin';
import authRoutes from './routes/auth';
import bookRoutes from './routes/books';
import holdRoutes from './routes/holds';
import loanRoutes from './routes/loans';
import meRoutes from './routes/me';
import memberRoutes from './routes/members';

const app = express();

// Agree with the allowlist about how many proxies to count, so req.ip and the
// allowlist's resolved address can never disagree.
app.set('trust proxy', accessConfig.proxyHops);
app.disable('x-powered-by');

app.use(express.json({ limit: '100kb' }));

/**
 * Cross-origin access is restricted to the configured frontend origin(s).
 * With CORS_ORIGIN unset, only same-origin and non-browser callers get
 * through — a wildcard would let any site on the internet make credentialed
 * calls on a signed-in member's behalf.
 */
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (config.corsOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  }),
);

// Liveness probe ahead of the allowlist so the platform health check still
// passes while the allowlist is enforcing (it is also in the bypass list).
app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }));

logStartupState(accessConfig);
app.use(ipAllowlist);

app.use('/api/auth', rateLimit({ windowMs: 15 * 60_000, max: 20 }), authRoutes);
app.use('/api/me', meRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/holds', holdRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

runMigrations(pool)
  .then(() => {
    app.listen(config.port, '0.0.0.0', () => {
      // Configuration only. Never log DATABASE_URL or JWT_SECRET: platform
      // logs are widely readable and long-lived.
      console.log(`Library API listening on port ${config.port} (${config.nodeEnv})`);
      console.log(
        `[policy] loan=${config.loanDays}d max-open=${config.maxOpenLoans} renewals=${config.maxRenewals}`,
      );
      console.log(`[cors] ${config.corsOrigins.length ? config.corsOrigins.join(', ') : 'same-origin only'}`);
    });
  })
  .catch((err) => {
    console.error('Migration failed on boot:', err);
    process.exit(1);
  });
