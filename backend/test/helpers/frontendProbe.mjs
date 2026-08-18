/**
 * Runs the shared access-control case table through the FRONTEND copy of the
 * logic (frontend/ipAccess.mjs) and prints the results as JSON.
 *
 * This runs as a separate process because the frontend copy is ESM while the
 * backend is compiled to CommonJS, and the two services deliberately share no
 * build. Keeping the comparison at the process boundary means the parity test
 * works on any supported Node version without module interop games.
 *
 * Usage: node test/helpers/frontendProbe.mjs <path-to-accessCases.json>
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const modulePath = join(here, '..', '..', '..', 'frontend', 'ipAccess.mjs');
const impl = await import(modulePath);

const casesPath = resolve(process.argv[2]);
const cases = JSON.parse(readFileSync(casesPath, 'utf8'));

const str = (v) => (v === null || v === undefined ? null : String(v));

const output = {
  addresses: cases.addresses.map((a) => str(impl.parseIp(a))),

  ruleEntries: cases.ruleEntries.map((entry) => {
    const rule = impl.parseRule(entry);
    return rule === null ? null : { raw: rule.raw, base: String(rule.base), prefix: rule.prefix };
  }),

  configs: cases.envs.map((env) => {
    const cfg = impl.loadConfigFromEnv(env);
    return {
      mode: cfg.mode,
      proxyHops: cfg.proxyHops,
      clientIpHeader: cfg.clientIpHeader,
      configured: cfg.configured,
      invalidEntries: cfg.invalidEntries,
      bypassPaths: cfg.bypassPaths,
      warnings: cfg.warnings,
      rules: cfg.rules.map((r) => `${r.raw}|${r.base}|${r.prefix}`),
    };
  }),

  verdicts: cases.envs.flatMap((env) => {
    const cfg = impl.loadConfigFromEnv(env);
    return cases.requests.map((req) => impl.evaluate(req, cfg));
  }),
};

process.stdout.write(JSON.stringify(output));
