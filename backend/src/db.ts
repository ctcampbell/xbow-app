import { Pool } from 'pg';

// Larger pool + per-query timeouts so automated scanners hammering the
// SQLi endpoints can't starve out healthchecks or legitimate traffic.
// The vulnerable raw-SQL routes still execute exactly as before — these
// settings are about process resilience, not query semantics.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX) || 30,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 10_000,
  query_timeout: 10_000,
});

// Without this handler, a dropped idle connection emits an unhandled 'error'
// event that crashes the Node process.  All query-level errors are still thrown
// from pool.query() and caught by the route try/catch blocks.
pool.on('error', (err) => {
  console.error('Unexpected idle client error:', err);
});

export default pool;
