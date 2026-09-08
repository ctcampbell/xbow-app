import { strict as assert } from 'node:assert';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { test } from 'node:test';
import express from 'express';
import { Pool } from 'pg';
import { runMigrations } from '../src/migrate';

test('personal access token lifecycle against PostgreSQL', async (t) => {
  assert.ok(process.env.TEST_DATABASE_URL, 'Set TEST_DATABASE_URL to a disposable PostgreSQL database');
  const database = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const schema = `token_test_${randomBytes(8).toString('hex')}`;
  await database.query(`CREATE SCHEMA ${schema}`);
  t.after(async () => {
    await database.query(`DROP SCHEMA ${schema} CASCADE`);
    await database.end();
  });
  const url = new URL(process.env.TEST_DATABASE_URL!);
  url.searchParams.set('options', `-c search_path=${schema}`);
  process.env.DATABASE_URL = url.toString();
  process.env.JWT_SECRET = randomBytes(32).toString('hex');

  const { default: pool } = await import('../src/db');
  t.after(() => pool.end());
  await runMigrations(pool);
  await runMigrations(pool); // Existing installations can restart safely.
  const { rows: members } = await pool.query(
    `INSERT INTO members (email, password_hash, first_name, last_name)
     VALUES ('one@example.test', 'unused', 'One', 'Test'),
            ('two@example.test', 'unused', 'Two', 'Test') RETURNING *`,
  );
  const { issueToken } = await import('../src/lib/token');
  const { hashAccessToken, generateAccessToken } = await import('../src/lib/accessToken');
  const { requireAuth, requireAdmin } = await import('../src/middleware/auth');
  const { errorHandler } = await import('../src/middleware/errorHandler');
  const { default: meRoutes } = await import('../src/routes/me');
  const { default: bookRoutes } = await import('../src/routes/books');
  const app = express();
  app.use(express.json());
  app.use('/api/me', meRoutes);
  app.use('/api/books', bookRoutes);
  app.get('/api/admin-probe', requireAuth, requireAdmin, (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((err) => err ? reject(err) : resolve());
    server.closeAllConnections();
  }));
  await once(server, 'listening');
  const address = server.address() as { port: number };
  const firstSession = issueToken(members[0]);
  const secondSession = issueToken(members[1]);
  async function request(path: string, token?: string, method = 'GET', body?: unknown) {
    return fetch(`http://127.0.0.1:${address.port}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  for (const method of ['GET', 'POST', 'DELETE']) {
    assert.equal((await request(`/me/tokens${method === 'DELETE' ? '/1' : ''}`, undefined, method)).status, 401);
  }
  assert.equal((await request('/me/tokens', firstSession, 'POST', { name: ' ', expires_in_days: 999 })).status, 400);
  const response = await request('/me/tokens', firstSession, 'POST', { name: 'Automation', member_id: members[1].id });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const created = await response.json() as any;
  const token = created.token as string;
  const id = created.access_token.id;
  assert.ok(Date.parse(created.access_token.expires_at) - Date.now() > 364 * 86400_000);
  assert.equal(created.access_token.token_hash, undefined);
  const { rows: stored } = await pool.query('SELECT * FROM access_tokens WHERE id = $1', [id]);
  assert.equal(stored[0].token_hash, hashAccessToken(token));
  assert.equal(stored[0].member_id, members[0].id);
  assert.ok(!JSON.stringify(stored).includes(token));

  // A PAT is accepted only as an Authorization header.
  assert.equal((await request(`/me?access_token=${token}`)).status, 401);
  assert.equal((await request('/me', undefined, 'PATCH', { token, access_token: token })).status, 401);
  const cookieResponse = await fetch(`http://127.0.0.1:${address.port}/api/me`, {
    headers: { Cookie: `token=${token}; access_token=${token}; library.token=${token}` },
  });
  assert.equal(cookieResponse.status, 401);

  const profile = await request('/me', token);
  assert.equal(profile.status, 200);
  assert.equal(((await profile.json()) as any).member.id, members[0].id);
  assert.equal((await request('/books', token)).status, 200);
  assert.equal((await request('/admin-probe', token)).status, 403);
  await pool.query("UPDATE members SET role = 'admin' WHERE id = $1", [members[0].id]);
  assert.equal((await request('/admin-probe', token)).status, 200);
  await pool.query("UPDATE members SET role = 'member', status = 'suspended' WHERE id = $1", [members[0].id]);
  assert.equal((await request('/me', token)).status, 403);
  await pool.query("UPDATE members SET status = 'active' WHERE id = $1", [members[0].id]);
  assert.equal((await request('/admin-probe', token)).status, 403);

  const list = await request('/me/tokens', firstSession);
  const listBody = await list.text();
  assert.ok(!listBody.includes(token));
  assert.ok(!listBody.includes('token_hash'));
  assert.equal(JSON.parse(listBody).tokens.length, 1);
  assert.deepEqual(await (await request('/me/tokens', secondSession)).json(), { tokens: [] });
  assert.equal((await request(`/me/tokens/${id}`, secondSession, 'DELETE')).status, 404);
  assert.equal((await request('/me', token)).status, 200);
  assert.equal((await request(`/me/tokens/${id}`, firstSession, 'DELETE')).status, 204);
  assert.equal((await request('/me', token)).status, 401);
  assert.equal((await request(`/me/tokens/${id}`, firstSession, 'DELETE')).status, 204);
  assert.equal((await request('/me/tokens/nope', firstSession, 'DELETE')).status, 400);

  const expiring = await (await request('/me/tokens', firstSession, 'POST', { name: 'Expires', expires_in_days: 30 })).json() as any;
  assert.ok(Date.parse(expiring.access_token.expires_at) - Date.now() < 31 * 86400_000);
  await pool.query("UPDATE access_tokens SET expires_at = NOW() - INTERVAL '1 second' WHERE id = $1", [expiring.access_token.id]);
  assert.equal((await request('/me', expiring.token)).status, 401);
  for (const invalid of [generateAccessToken(), 'lpat_bad', `${token} extra`, 'invalid.jwt.value']) {
    assert.equal((await request('/me', invalid)).status, 401);
  }
  assert.equal((await request('/me', firstSession)).status, 200);
  const orphan = await (await request('/me/tokens', firstSession, 'POST', { name: 'Deleted member' })).json() as any;
  await pool.query('DELETE FROM members WHERE id = $1', [members[0].id]);
  assert.equal((await request('/me', orphan.token)).status, 401);
  assert.equal((await pool.query('SELECT * FROM access_tokens WHERE member_id = $1', [members[0].id])).rowCount, 0);
});
