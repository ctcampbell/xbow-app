-- Library book management system.
--
-- Availability is derived, never stored: a title's free copies are
-- total_copies minus its open loans. A denormalised counter would drift the
-- first time a loan row was touched outside the checkout path.

CREATE TABLE IF NOT EXISTS members (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'member'
                  CHECK (role IN ('member', 'admin')),
  status        VARCHAR(20) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'suspended')),
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS books (
  id             SERIAL PRIMARY KEY,
  isbn           VARCHAR(20) UNIQUE,
  title          VARCHAR(500) NOT NULL,
  author         VARCHAR(255) NOT NULL,
  publisher      VARCHAR(255),
  published_year INTEGER CHECK (published_year BETWEEN 1450 AND 2200),
  genre          VARCHAR(100),
  description    TEXT,
  total_copies   INTEGER NOT NULL DEFAULT 1 CHECK (total_copies >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loans (
  id          SERIAL PRIMARY KEY,
  book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
  member_id   INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  borrowed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date    DATE NOT NULL,
  returned_at TIMESTAMPTZ,
  renewals    INTEGER NOT NULL DEFAULT 0 CHECK (renewals >= 0)
);

CREATE TABLE IF NOT EXISTS holds (
  id        SERIAL PRIMARY KEY,
  book_id   INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status    VARCHAR(20) NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'fulfilled', 'cancelled'))
);

-- Open loans and active holds are the hot path for every availability check.
CREATE INDEX IF NOT EXISTS loans_open_by_book   ON loans (book_id) WHERE returned_at IS NULL;
CREATE INDEX IF NOT EXISTS loans_by_member      ON loans (member_id);
CREATE INDEX IF NOT EXISTS loans_due            ON loans (due_date) WHERE returned_at IS NULL;
CREATE INDEX IF NOT EXISTS holds_active_by_book ON holds (book_id) WHERE status = 'active';

-- A member may hold one copy of a given title at a time, and queue once for it.
CREATE UNIQUE INDEX IF NOT EXISTS loans_one_open_per_member_book
  ON loans (book_id, member_id) WHERE returned_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS holds_one_active_per_member_book
  ON holds (book_id, member_id) WHERE status = 'active';

-- Case-insensitive catalogue search.
CREATE INDEX IF NOT EXISTS books_title_lower  ON books (LOWER(title));
CREATE INDEX IF NOT EXISTS books_author_lower ON books (LOWER(author));
