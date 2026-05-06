import { Pool, PoolClient } from 'pg';

export async function runMigrations(pool: Pool): Promise<void> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id         SERIAL PRIMARY KEY,
        email      VARCHAR(255) UNIQUE NOT NULL,
        password   VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name  VARCHAR(100),
        handicap   NUMERIC(4,1) DEFAULT 0,
        role       VARCHAR(20) DEFAULT 'user',
        bio        TEXT,
        avatar_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS courses (
        id            SERIAL PRIMARY KEY,
        name          VARCHAR(255) NOT NULL,
        location      VARCHAR(255),
        description   TEXT,
        par           INTEGER DEFAULT 72,
        slope_rating  NUMERIC(5,1),
        course_rating NUMERIC(4,1),
        holes         INTEGER DEFAULT 18,
        created_at    TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS rounds (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER REFERENCES users(id),
        course_id   INTEGER REFERENCES courses(id),
        date_played DATE NOT NULL,
        total_score INTEGER,
        notes       TEXT,
        created_at  TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS hole_scores (
        id          SERIAL PRIMARY KEY,
        round_id    INTEGER REFERENCES rounds(id) ON DELETE CASCADE,
        hole_number INTEGER NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
        score       INTEGER NOT NULL,
        par         INTEGER NOT NULL,
        created_at  TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Migration complete');
  } finally {
    client.release();
  }
}
