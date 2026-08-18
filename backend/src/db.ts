import { Pool } from 'pg';
import { config } from './config';

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: Number(process.env.PG_POOL_MAX) || 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 10_000,
  query_timeout: 10_000,
});

// Without this handler a dropped idle connection emits an unhandled 'error'
// event and takes the process down. Query-level errors still reject from
// pool.query() and are handled by the route wrappers.
pool.on('error', (err) => {
  console.error('Unexpected idle client error:', err);
});

/**
 * Runs a set of queries inside a single transaction, rolling back on throw.
 * Checkout and return both depend on this: they read availability and write a
 * loan row, and must not interleave with a competing borrower.
 */
export async function withTransaction<T>(fn: (client: import('pg').PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export default pool;
