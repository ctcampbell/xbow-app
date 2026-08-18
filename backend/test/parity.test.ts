import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import * as impl from '../src/lib/ipAccess';

/**
 * The frontend service carries its own copy of the access-control logic
 * (frontend/ipAccess.mjs) because the two services build and deploy
 * independently and cannot share code. This test drives one shared case table
 * through both implementations and fails on any disagreement, so the copies
 * cannot silently drift. If this fails, you changed one copy and not the other.
 */

const casesPath = join(__dirname, 'fixtures', 'accessCases.json');
const probePath = join(__dirname, 'helpers', 'frontendProbe.mjs');

interface Cases {
  addresses: string[];
  ruleEntries: string[];
  envs: Record<string, string>[];
  requests: impl.RequestLike[];
}

const cases: Cases = JSON.parse(readFileSync(casesPath, 'utf8'));

const frontend = JSON.parse(
  execFileSync(process.execPath, [probePath, casesPath], { encoding: 'utf8' }),
);

const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

describe('frontend/backend implementation parity', () => {
  it('agrees on every address parse', () => {
    const ours = cases.addresses.map((a) => str(impl.parseIp(a)));
    for (let i = 0; i < cases.addresses.length; i++) {
      assert.equal(
        ours[i],
        frontend.addresses[i],
        `parseIp disagreement on ${JSON.stringify(cases.addresses[i])}`,
      );
    }
  });

  it('agrees on every rule parse', () => {
    for (let i = 0; i < cases.ruleEntries.length; i++) {
      const rule = impl.parseRule(cases.ruleEntries[i]);
      const ours =
        rule === null ? null : { raw: rule.raw, base: String(rule.base), prefix: rule.prefix };
      assert.deepEqual(
        ours,
        frontend.ruleEntries[i],
        `parseRule disagreement on ${JSON.stringify(cases.ruleEntries[i])}`,
      );
    }
  });

  it('agrees on every config load', () => {
    for (let i = 0; i < cases.envs.length; i++) {
      const cfg = impl.loadConfigFromEnv(cases.envs[i] as NodeJS.ProcessEnv);
      const ours = {
        mode: cfg.mode,
        proxyHops: cfg.proxyHops,
        clientIpHeader: cfg.clientIpHeader,
        configured: cfg.configured,
        invalidEntries: cfg.invalidEntries,
        bypassPaths: cfg.bypassPaths,
        warnings: cfg.warnings,
        rules: cfg.rules.map((r) => `${r.raw}|${r.base}|${r.prefix}`),
      };
      assert.deepEqual(
        ours,
        frontend.configs[i],
        `config disagreement for env=${JSON.stringify(cases.envs[i])}`,
      );
    }
  });

  it('agrees on every verdict across the full env x request matrix', () => {
    let index = 0;
    for (const env of cases.envs) {
      const cfg = impl.loadConfigFromEnv(env as NodeJS.ProcessEnv);
      for (const req of cases.requests) {
        assert.deepEqual(
          impl.evaluate(req, cfg),
          frontend.verdicts[index],
          `verdict disagreement for env=${JSON.stringify(env)} req=${JSON.stringify(req)}`,
        );
        index++;
      }
    }
    assert.equal(index, cases.envs.length * cases.requests.length);
    assert.equal(frontend.verdicts.length, index);
  });
});
