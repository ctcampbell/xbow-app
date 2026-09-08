import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';

/**
 * Applies the ordered, idempotent SQL files in db/migrations. Each statement
 * must be guarded so booting an already-migrated database is a no-op.
 *
 * The path is resolved relative to the compiled file, which lives in dist/,
 * so the migrations directory is one level up from there in both the dev
 * (ts-node from src/) and production (node from dist/) layouts.
 */
const MIGRATIONS = join(__dirname, '..', 'db', 'migrations');

export async function runMigrations(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    for (const file of readdirSync(MIGRATIONS).filter((f) => /^\d+_.*\.sql$/.test(f)).sort()) {
      await client.query(readFileSync(join(MIGRATIONS, file), 'utf8'));
    }
    console.log('Migration complete');
  } finally {
    client.release();
  }
}
