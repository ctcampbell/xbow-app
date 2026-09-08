-- Raw personal access tokens are only returned when created.
CREATE TABLE IF NOT EXISTS access_tokens (
  id         SERIAL PRIMARY KEY,
  member_id  INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  token_hash CHAR(64) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS access_tokens_by_member ON access_tokens (member_id);
