import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';

/**
 * Applies db/migrations/001_init.sql. Every statement in it is guarded with
 * IF NOT EXISTS, so a boot against an already-migrated database is a no-op.
 *
 * The path is resolved relative to the compiled file, which lives in dist/,
 * so the migrations directory is one level up from there in both the dev
 * (ts-node from src/) and production (node from dist/) layouts.
 */
const MIGRATION = join(__dirname, '..', 'db', 'migrations', '001_init.sql');

export async function runMigrations(pool: Pool): Promise<void> {
  const sql = readFileSync(MIGRATION, 'utf8');
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('Migration complete');
  } finally {
    client.release();
  }
}
