import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { generateAccessToken, hashAccessToken, isAccessToken } from '../src/lib/accessToken';
import { createAccessTokenSchema } from '../src/lib/schemas';

test('personal access tokens are unique, recognizable, and stored as hashes', () => {
  const tokens = Array.from({ length: 100 }, generateAccessToken);
  assert.equal(new Set(tokens).size, tokens.length);
  for (const token of tokens) {
    assert.ok(isAccessToken(token));
    assert.match(hashAccessToken(token), /^[a-f0-9]{64}$/);
    assert.notEqual(hashAccessToken(token), token);
  }
  assert.equal(isAccessToken('lpat_short'), false);
  assert.equal(isAccessToken(`${tokens[0]} extra`), false);
});

test('token creation validates names and bounded lifetimes', () => {
  assert.deepEqual(createAccessTokenSchema.parse({ name: '  Automation  ', member_id: 42 }), {
    name: 'Automation', expires_in_days: 365,
  });
  for (const name of ['', '   ', 'x'.repeat(101)]) {
    assert.equal(createAccessTokenSchema.safeParse({ name }).success, false);
  }
  for (const expires_in_days of [0, -1, 366, 1.5, '365', null]) {
    assert.equal(createAccessTokenSchema.safeParse({ name: 'Test', expires_in_days }).success, false);
  }
});
