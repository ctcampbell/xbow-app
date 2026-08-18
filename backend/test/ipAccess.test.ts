import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  AccessConfig,
  evaluate,
  loadConfigFromEnv,
  matchesAny,
  parseIp,
  parseRule,
  resolveClientIp,
} from '../src/lib/ipAccess';

function cfg(env: Record<string, string | undefined>): AccessConfig {
  return loadConfigFromEnv(env as NodeJS.ProcessEnv);
}

/** Build a request as Railway's edge would present it: real IP appended last. */
function fromEdge(clientIp: string, spoofed?: string, path = '/api/books') {
  const chain = spoofed ? `${spoofed}, ${clientIp}` : clientIp;
  return {
    headers: { 'x-forwarded-for': chain },
    socketRemoteAddress: 'fd12::1',
    path,
  };
}

const rules = (...entries: string[]) => entries.map((e) => parseRule(e)!);

describe('parseIp', () => {
  it('parses IPv4 and maps it into v4-mapped v6 space', () => {
    assert.equal(parseIp('0.0.0.0'), 0xffff00000000n);
    assert.equal(parseIp('255.255.255.255'), 0xffffffffffffn);
    assert.equal(parseIp('1.2.3.4'), parseIp('::ffff:1.2.3.4'));
  });

  it('parses IPv6 in compressed, full and embedded-v4 forms', () => {
    assert.equal(parseIp('::'), 0n);
    assert.equal(parseIp('::1'), 1n);
    assert.equal(parseIp('0:0:0:0:0:0:0:1'), 1n);
    assert.equal(parseIp('2001:db8::1'), parseIp('2001:0db8:0000:0000:0000:0000:0000:0001'));
    assert.equal(parseIp('1:2:3:4:5:6:1.2.3.4'), parseIp('1:2:3:4:5:6:102:304'));
  });

  it('tolerates zone IDs, brackets and IPv4 ports', () => {
    assert.equal(parseIp('fe80::1%eth0'), parseIp('fe80::1'));
    assert.equal(parseIp('[::1]'), 1n);
    assert.equal(parseIp('1.2.3.4:8080'), parseIp('1.2.3.4'));
    assert.equal(parseIp('  1.2.3.4  '), parseIp('1.2.3.4'));
  });

  it('rejects malformed input rather than guessing', () => {
    for (const bad of [
      '',
      '   ',
      'localhost',
      '1.2.3',
      '1.2.3.4.5',
      '256.1.1.1',
      '1.2.3.-1',
      '1.2.3.4a',
      '::1::2',
      '1:2:3:4:5:6:7',
      '1:2:3:4:5:6:7:8:9',
      'gggg::1',
      '12345::1',
      '1.2.3.4/24',
      '::ffff:1.2.3.4.5',
      '1.2.3.4:99999999',
      '[::1',
    ]) {
      assert.equal(parseIp(bad), null, `expected ${JSON.stringify(bad)} to be rejected`);
    }
  });

  it('rejects leading zeros, which parse inconsistently across resolvers', () => {
    assert.equal(parseIp('010.1.1.1'), null);
    assert.equal(parseIp('1.2.3.04'), null);
  });

  it('rejects non-strings without throwing', () => {
    assert.equal(parseIp(undefined as unknown as string), null);
    assert.equal(parseIp(null as unknown as string), null);
    assert.equal(parseIp(12345 as unknown as string), null);
  });
});

describe('parseRule', () => {
  it('defaults a bare address to an exact host match', () => {
    const rule = parseRule('1.2.3.4')!;
    assert.equal(rule.prefix, 128);
    assert.ok(matchesAny(parseIp('1.2.3.4')!, [rule]));
    assert.ok(!matchesAny(parseIp('1.2.3.5')!, [rule]));
  });

  it('shifts IPv4 prefixes into 128-bit space', () => {
    assert.equal(parseRule('10.0.0.0/8')!.prefix, 104);
    assert.equal(parseRule('10.0.0.0/32')!.prefix, 128);
    assert.equal(parseRule('10.0.0.0/0')!.prefix, 96);
    assert.equal(parseRule('2001:db8::/32')!.prefix, 32);
  });

  it('rejects out-of-range and malformed prefixes', () => {
    for (const bad of [
      '10.0.0.0/33',
      '10.0.0.0/-1',
      '10.0.0.0/',
      '10.0.0.0/8/8',
      '10.0.0.0/abc',
      '2001:db8::/129',
      'notanip/24',
      '',
      '   ',
    ]) {
      assert.equal(parseRule(bad), null, `expected ${JSON.stringify(bad)} to be rejected`);
    }
  });
});

describe('CIDR matching', () => {
  it('matches inside an IPv4 range and rejects just outside it', () => {
    const list = rules('203.0.113.0/24');
    assert.ok(matchesAny(parseIp('203.0.113.0')!, list));
    assert.ok(matchesAny(parseIp('203.0.113.255')!, list));
    assert.ok(!matchesAny(parseIp('203.0.112.255')!, list));
    assert.ok(!matchesAny(parseIp('203.0.114.0')!, list));
  });

  it('handles non-byte-aligned prefixes', () => {
    const list = rules('10.1.2.0/23'); // covers 10.1.2.0 - 10.1.3.255
    assert.ok(matchesAny(parseIp('10.1.3.200')!, list));
    assert.ok(!matchesAny(parseIp('10.1.4.0')!, list));

    const thirty = rules('192.0.2.4/30'); // .4 - .7
    assert.ok(matchesAny(parseIp('192.0.2.7')!, thirty));
    assert.ok(!matchesAny(parseIp('192.0.2.8')!, thirty));
  });

  it('ignores host bits set in the rule', () => {
    const list = rules('203.0.113.77/24');
    assert.ok(matchesAny(parseIp('203.0.113.1')!, list));
  });

  it('matches IPv6 ranges', () => {
    const list = rules('2001:db8:abcd::/48');
    assert.ok(matchesAny(parseIp('2001:db8:abcd:1234::1')!, list));
    assert.ok(!matchesAny(parseIp('2001:db8:abce::1')!, list));
  });

  it('matches a v4-mapped client against a plain v4 rule', () => {
    const list = rules('203.0.113.0/24');
    assert.ok(matchesAny(parseIp('::ffff:203.0.113.9')!, list));
  });

  it('keeps IPv4 and IPv6 loopback distinct', () => {
    assert.ok(!matchesAny(parseIp('::1')!, rules('127.0.0.1')));
    assert.ok(!matchesAny(parseIp('127.0.0.1')!, rules('::1')));
  });

  it('does not let an IPv4 rule leak into general IPv6 space', () => {
    // 0.0.0.0/0 becomes ::ffff:0:0/96 and must not match native IPv6.
    assert.ok(!matchesAny(parseIp('2001:db8::1')!, rules('0.0.0.0/0')));
    assert.ok(matchesAny(parseIp('8.8.8.8')!, rules('0.0.0.0/0')));
  });
});

describe('client IP resolution', () => {
  const base = cfg({ ALLOWED_IPS: '1.1.1.1' });

  it('takes the rightmost XFF entry with the default single hop', () => {
    const { ip, source } = resolveClientIp(
      { headers: { 'x-forwarded-for': '9.9.9.9, 203.0.113.5' } },
      base,
    );
    assert.equal(ip, '203.0.113.5');
    assert.equal(source, 'xff');
  });

  it('counts in from the right for a two-hop chain', () => {
    const twoHops = cfg({ ALLOWED_IPS: '1.1.1.1', TRUSTED_PROXY_HOPS: '2' });
    const { ip } = resolveClientIp(
      { headers: { 'x-forwarded-for': '203.0.113.5, 172.68.1.1' } },
      twoHops,
    );
    assert.equal(ip, '203.0.113.5');
  });

  it('refuses to guess when the chain is shorter than the hop count', () => {
    const twoHops = cfg({ ALLOWED_IPS: '1.1.1.1', TRUSTED_PROXY_HOPS: '2' });
    const { ip } = resolveClientIp({ headers: { 'x-forwarded-for': '203.0.113.5' } }, twoHops);
    assert.equal(ip, null);
  });

  it('falls back to the socket address when there is no XFF', () => {
    const { ip, source } = resolveClientIp(
      { headers: {}, socketRemoteAddress: 'fd12::3' },
      base,
    );
    assert.equal(ip, 'fd12::3');
    assert.equal(source, 'socket');
  });

  it('uses a configured header in preference to XFF', () => {
    const withHeader = cfg({ ALLOWED_IPS: '1.1.1.1', CLIENT_IP_HEADER: 'CF-Connecting-IP' });
    const { ip, source } = resolveClientIp(
      {
        headers: { 'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': '9.9.9.9, 172.68.1.1' },
      },
      withHeader,
    );
    assert.equal(ip, '203.0.113.9');
    assert.equal(source, 'cf-connecting-ip');
  });

  it('resolves nothing when the configured header is absent', () => {
    const withHeader = cfg({ ALLOWED_IPS: '1.1.1.1', CLIENT_IP_HEADER: 'cf-connecting-ip' });
    const { ip } = resolveClientIp({ headers: { 'x-forwarded-for': '203.0.113.9' } }, withHeader);
    assert.equal(ip, null);
  });

  it('takes the last value when a header is repeated', () => {
    const { ip } = resolveClientIp(
      { headers: { 'x-forwarded-for': ['9.9.9.9', '8.8.8.8, 203.0.113.5'] } },
      base,
    );
    assert.equal(ip, '203.0.113.5');
  });
});

describe('fail-closed behaviour', () => {
  it('denies everything when ALLOWED_IPS is unset', () => {
    const verdict = evaluate(fromEdge('203.0.113.5'), cfg({}));
    assert.equal(verdict.allowed, false);
    assert.equal(verdict.reason, 'no-rules');
  });

  it('denies everything when ALLOWED_IPS is empty or only separators', () => {
    for (const value of ['', '   ', ',', ' , , ']) {
      const verdict = evaluate(fromEdge('203.0.113.5'), cfg({ ALLOWED_IPS: value }));
      assert.equal(verdict.allowed, false, `expected ${JSON.stringify(value)} to deny`);
      assert.equal(verdict.reason, 'no-rules');
    }
  });

  it('denies everything when any entry is malformed, rather than enforcing the rest', () => {
    const verdict = evaluate(
      fromEdge('203.0.113.5'),
      cfg({ ALLOWED_IPS: '203.0.113.0/24, 10.0.0.0/33' }),
    );
    assert.equal(verdict.allowed, false);
    assert.equal(verdict.reason, 'bad-config');
  });

  it('treats an unrecognised mode as enforce', () => {
    const config = cfg({ IP_ALLOWLIST_MODE: 'off', ALLOWED_IPS: '203.0.113.0/24' });
    assert.equal(config.mode, 'enforce');
    assert.ok(config.warnings.length > 0);
    assert.equal(evaluate(fromEdge('8.8.8.8'), config).allowed, false);
  });

  it('denies when no trustworthy IP can be derived', () => {
    const config = cfg({ ALLOWED_IPS: '203.0.113.0/24' });
    const verdict = evaluate({ headers: {}, socketRemoteAddress: null, path: '/api/x' }, config);
    assert.equal(verdict.allowed, false);
    assert.equal(verdict.reason, 'unresolvable');
  });

  it('denies when the resolved IP is unparseable', () => {
    const config = cfg({ ALLOWED_IPS: '203.0.113.0/24' });
    const verdict = evaluate({ headers: { 'x-forwarded-for': 'not-an-ip' }, path: '/api/x' }, config);
    assert.equal(verdict.allowed, false);
    assert.equal(verdict.reason, 'unresolvable');
  });

  it('only runs open when explicitly disabled', () => {
    const config = cfg({ IP_ALLOWLIST_MODE: 'disabled' });
    const verdict = evaluate(fromEdge('8.8.8.8'), config);
    assert.equal(verdict.allowed, true);
    assert.equal(verdict.reason, 'disabled');
  });
});

describe('spoofing resistance', () => {
  const config = cfg({ ALLOWED_IPS: '203.0.113.0/24' });

  it('admits an allowlisted client', () => {
    const verdict = evaluate(fromEdge('203.0.113.5'), config);
    assert.equal(verdict.allowed, true);
    assert.equal(verdict.reason, 'match');
    assert.equal(verdict.ip, '203.0.113.5');
  });

  it('ignores a client-supplied allowlisted IP to the left of the real one', () => {
    const verdict = evaluate(fromEdge('8.8.8.8', '203.0.113.5'), config);
    assert.equal(verdict.allowed, false);
    assert.equal(verdict.reason, 'no-match');
    assert.equal(verdict.ip, '8.8.8.8');
  });

  it('ignores a long forged chain', () => {
    const forged = '203.0.113.1, 203.0.113.2, 203.0.113.3';
    const verdict = evaluate(fromEdge('8.8.8.8', forged), config);
    assert.equal(verdict.allowed, false);
    assert.equal(verdict.ip, '8.8.8.8');
  });

  it('is not fooled by a trailing comma in the forged header', () => {
    const verdict = evaluate(
      { headers: { 'x-forwarded-for': '203.0.113.5,, 8.8.8.8' }, path: '/api/x' },
      config,
    );
    assert.equal(verdict.allowed, false);
    assert.equal(verdict.ip, '8.8.8.8');
  });

  it('ignores a forged X-Real-IP, which is not consulted', () => {
    const verdict = evaluate(
      {
        headers: { 'x-real-ip': '203.0.113.5', 'x-forwarded-for': '8.8.8.8' },
        path: '/api/x',
      },
      config,
    );
    assert.equal(verdict.allowed, false);
  });

  it('ignores a forged CF-Connecting-IP unless that header is configured', () => {
    const verdict = evaluate(
      {
        headers: { 'cf-connecting-ip': '203.0.113.5', 'x-forwarded-for': '8.8.8.8' },
        path: '/api/x',
      },
      config,
    );
    assert.equal(verdict.allowed, false);
  });

  it('does not admit a private-network caller unless it is allowlisted', () => {
    const verdict = evaluate({ headers: {}, socketRemoteAddress: 'fd12::9', path: '/api/x' }, config);
    assert.equal(verdict.allowed, false);
    assert.equal(verdict.reason, 'no-match');

    const withPrivate = cfg({ ALLOWED_IPS: '203.0.113.0/24, fd00::/8' });
    const allowed = evaluate({ headers: {}, socketRemoteAddress: 'fd12::9', path: '/api/x' }, withPrivate);
    assert.equal(allowed.allowed, true);
  });
});

describe('report-only mode', () => {
  const config = cfg({ IP_ALLOWLIST_MODE: 'report-only', ALLOWED_IPS: '203.0.113.0/24' });

  it('allows a request that would be blocked, but flags it', () => {
    const verdict = evaluate(fromEdge('8.8.8.8'), config);
    assert.equal(verdict.allowed, true);
    assert.equal(verdict.wouldBlock, true);
    assert.equal(verdict.reason, 'no-match');
  });

  it('does not flag a request that matches', () => {
    const verdict = evaluate(fromEdge('203.0.113.5'), config);
    assert.equal(verdict.allowed, true);
    assert.equal(verdict.wouldBlock, false);
  });

  it('still reports rather than blocks on a broken config', () => {
    const broken = cfg({ IP_ALLOWLIST_MODE: 'report-only', ALLOWED_IPS: 'bogus' });
    const verdict = evaluate(fromEdge('8.8.8.8'), broken);
    assert.equal(verdict.allowed, true);
    assert.equal(verdict.wouldBlock, true);
    assert.equal(verdict.reason, 'bad-config');
  });
});

describe('bypass paths', () => {
  it('exempts /healthz by default even with no rules configured', () => {
    const verdict = evaluate({ headers: {}, path: '/healthz' }, cfg({}));
    assert.equal(verdict.allowed, true);
    assert.equal(verdict.reason, 'bypass');
  });

  it('does not exempt anything else', () => {
    const verdict = evaluate({ headers: {}, path: '/healthz/../api/debug' }, cfg({}));
    assert.equal(verdict.allowed, false);
  });

  it('can be emptied so nothing is exempt', () => {
    const config = cfg({ IP_ALLOWLIST_BYPASS_PATHS: '', ALLOWED_IPS: '203.0.113.0/24' });
    assert.deepEqual(config.bypassPaths, []);
    assert.equal(evaluate({ headers: {}, path: '/healthz' }, config).allowed, false);
  });
});

describe('config parsing', () => {
  it('accepts commas, spaces and newlines as separators', () => {
    const config = cfg({ ALLOWED_IPS: '1.1.1.1, 2.2.2.2\n3.3.3.3\t4.4.4.4' });
    assert.equal(config.rules.length, 4);
    assert.deepEqual(config.invalidEntries, []);
  });

  it('warns when a rule matches everything', () => {
    const config = cfg({ ALLOWED_IPS: '::/0' });
    assert.ok(config.warnings.some((w) => w.includes('no-op')));
  });

  it('falls back to one hop on a bad TRUSTED_PROXY_HOPS', () => {
    for (const bad of ['-1', '1.5', 'two', '99']) {
      const config = cfg({ TRUSTED_PROXY_HOPS: bad, ALLOWED_IPS: '1.1.1.1' });
      assert.equal(config.proxyHops, 1, `expected ${bad} to fall back`);
      assert.ok(config.warnings.length > 0);
    }
  });

  it('allows zero hops for a directly exposed service', () => {
    const config = cfg({ TRUSTED_PROXY_HOPS: '0', ALLOWED_IPS: '1.1.1.1' });
    assert.equal(config.proxyHops, 0);
    assert.deepEqual(config.warnings, []);
  });
});
