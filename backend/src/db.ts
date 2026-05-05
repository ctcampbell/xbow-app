import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Without this handler, a dropped idle connection emits an unhandled 'error'
// event that crashes the Node process.  All query-level errors are still thrown
// from pool.query() and caught by the route try/catch blocks.
pool.on('error', (err) => {
  console.error('Unexpected idle client error:', err);
});

export default pool;
