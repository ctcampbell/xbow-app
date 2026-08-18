/**
 * Source-IP access control for the frontend service.
 *
 * This is a deliberate, behaviour-identical port of backend/src/lib/ipAccess.ts.
 * The two services are built and deployed independently (see .github/workflows
 * and each service's railway.toml), so neither can import from the other or
 * from a shared parent directory. backend/test/parity.test.ts runs a shared
 * case table through both implementations and fails if they ever diverge —
 * update both files together, or that test will tell you.
 *
 * See the backend file for the full rationale. The two properties that matter:
 * fail closed on missing/malformed config, and resolve the client IP by
 * counting X-Forwarded-For entries from the right (Railway's edge appends).
 */

const MAX_128 = (1n << 128n) - 1n;
const V4_MAPPED_PREFIX = 0xffffn << 32n; // ::ffff:0:0/96
const V4_WITH_PORT = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d{1,5}$/;

const MODES = ['enforce', 'report-only', 'disabled'];

/* -------------------------------------------------------------------------- */
/* Address parsing                                                            */
/* -------------------------------------------------------------------------- */

function parseIPv4(input) {
  const parts = input.split('.');
  if (parts.length !== 4) return null;
  let value = 0n;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    if (part.length > 1 && part[0] === '0') return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = (value << 8n) | BigInt(octet);
  }
  return V4_MAPPED_PREFIX | value;
}

function parseHextet(group) {
  if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
  return BigInt(parseInt(group, 16));
}

function parseIPv6(input) {
  const doubleColon = input.indexOf('::');
  if (doubleColon !== -1 && input.indexOf('::', doubleColon + 1) !== -1) return null;

  const headStr = doubleColon === -1 ? input : input.slice(0, doubleColon);
  const tailStr = doubleColon === -1 ? '' : input.slice(doubleColon + 2);
  const split = (s) => (s === '' ? [] : s.split(':'));
  const head = split(headStr);
  const tail = split(tailStr);

  const tokens = [...head, ...tail];
  if (tokens.some((t, i) => t.includes('.') && i !== tokens.length - 1)) return null;

  let trailingV4 = null;
  if (tokens.length > 0 && tokens[tokens.length - 1].includes('.')) {
    const mapped = parseIPv4(tokens[tokens.length - 1]);
    if (mapped === null) return null;
    trailingV4 = mapped & 0xffffffffn;
    if (tail.length > 0) tail.pop();
    else head.pop();
  }

  const groups = head.length + tail.length + (trailingV4 !== null ? 2 : 0);
  if (doubleColon === -1) {
    if (groups !== 8) return null;
  } else if (groups > 7) {
    return null;
  }

  let value = 0n;
  for (const group of head) {
    const hextet = parseHextet(group);
    if (hextet === null) return null;
    value = (value << 16n) | hextet;
  }
  for (let i = 0; i < 8 - groups; i++) value <<= 16n;
  for (const group of tail) {
    const hextet = parseHextet(group);
    if (hextet === null) return null;
    value = (value << 16n) | hextet;
  }
  if (trailingV4 !== null) value = (value << 32n) | trailingV4;
  return value;
}

export function parseIp(input) {
  if (typeof input !== 'string') return null;
  let s = input.trim();
  if (s === '') return null;

  const zone = s.indexOf('%');
  if (zone !== -1) s = s.slice(0, zone);

  if (s.startsWith('[')) {
    const end = s.indexOf(']');
    if (end === -1) return null;
    s = s.slice(1, end);
  }

  const withPort = V4_WITH_PORT.exec(s);
  if (withPort) s = withPort[1];

  if (s === '') return null;
  return s.includes(':') ? parseIPv6(s) : parseIPv4(s);
}

export function parseRule(entry) {
  const raw = entry.trim();
  if (raw === '') return null;

  const slash = raw.lastIndexOf('/');
  if (slash === -1) {
    const base = parseIp(raw);
    if (base === null) return null;
    return { base, prefix: 128, raw };
  }

  const addrPart = raw.slice(0, slash);
  const lenPart = raw.slice(slash + 1);
  if (!/^\d{1,3}$/.test(lenPart)) return null;

  const declared = Number(lenPart);
  const isV4 = !addrPart.includes(':');
  if (declared > (isV4 ? 32 : 128)) return null;

  const base = parseIp(addrPart);
  if (base === null) return null;

  return { base, prefix: isV4 ? declared + 96 : declared, raw };
}

export function matches(addr, rule) {
  if (rule.prefix === 0) return true;
  const mask = MAX_128 ^ ((1n << BigInt(128 - rule.prefix)) - 1n);
  return (addr & mask) === (rule.base & mask);
}

export function matchesAny(addr, rules) {
  return rules.some((rule) => matches(addr, rule));
}

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

export function loadConfigFromEnv(env = process.env) {
  const warnings = [];

  const rawMode = (env.IP_ALLOWLIST_MODE || 'enforce').trim().toLowerCase();
  let mode = 'enforce';
  if (MODES.includes(rawMode)) {
    mode = rawMode;
  } else {
    warnings.push(
      `IP_ALLOWLIST_MODE='${rawMode}' is not one of ${MODES.join('|')}; falling back to 'enforce'.`,
    );
  }

  const entries = (env.ALLOWED_IPS || '')
    .split(/[\s,]+/)
    .map((e) => e.trim())
    .filter(Boolean);

  const rules = [];
  const invalidEntries = [];
  for (const entry of entries) {
    const rule = parseRule(entry);
    if (rule) rules.push(rule);
    else invalidEntries.push(entry);
  }

  for (const rule of rules) {
    if (rule.prefix === 0) {
      warnings.push(`Allowlist entry '${rule.raw}' matches every address — the allowlist is a no-op.`);
    }
  }

  let proxyHops = 1;
  const rawHops = (env.TRUSTED_PROXY_HOPS || '').trim();
  if (rawHops !== '') {
    const parsed = Number(rawHops);
    if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 16) {
      proxyHops = parsed;
    } else {
      warnings.push(`TRUSTED_PROXY_HOPS='${rawHops}' is not an integer in 0..16; using 1 (Railway default).`);
    }
  }

  const rawHeader = (env.CLIENT_IP_HEADER || '').trim().toLowerCase();
  const clientIpHeader = rawHeader === '' ? null : rawHeader;

  const bypassRaw = env.IP_ALLOWLIST_BYPASS_PATHS;
  const bypassPaths = (bypassRaw === undefined ? '/healthz' : bypassRaw)
    .split(/[\s,]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return {
    mode,
    rules,
    invalidEntries,
    configured: entries.length > 0,
    proxyHops,
    clientIpHeader,
    bypassPaths,
    warnings,
  };
}

/* -------------------------------------------------------------------------- */
/* Client IP resolution                                                       */
/* -------------------------------------------------------------------------- */

function headerValue(headers, name) {
  const value = headers[name];
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.length ? value[value.length - 1] : null;
  return value;
}

export function resolveClientIp(req, cfg) {
  if (cfg.clientIpHeader) {
    const raw = headerValue(req.headers, cfg.clientIpHeader);
    if (raw === null) return { ip: null, source: cfg.clientIpHeader };
    const first = raw.split(',')[0].trim();
    return { ip: first === '' ? null : first, source: cfg.clientIpHeader };
  }

  // Zero trusted hops means the service is exposed directly: X-Forwarded-For
  // is entirely attacker-controlled and must be ignored.
  const xff = cfg.proxyHops === 0 ? null : headerValue(req.headers, 'x-forwarded-for');
  if (xff !== null && xff.trim() !== '') {
    const tokens = xff
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const index = tokens.length - cfg.proxyHops;
    if (index < 0 || index >= tokens.length) {
      return { ip: null, source: 'xff' };
    }
    return { ip: tokens[index], source: 'xff' };
  }

  const socket = req.socketRemoteAddress;
  if (socket) return { ip: socket, source: 'socket' };
  return { ip: null, source: 'none' };
}

/* -------------------------------------------------------------------------- */
/* Decision                                                                   */
/* -------------------------------------------------------------------------- */

function deny(reason, ip, source, mode) {
  return { allowed: mode === 'report-only', wouldBlock: true, ip, source, reason };
}

export function evaluate(req, cfg) {
  if (cfg.mode === 'disabled') {
    return { allowed: true, wouldBlock: false, ip: null, source: 'none', reason: 'disabled' };
  }

  if (req.path !== undefined && cfg.bypassPaths.includes(req.path)) {
    return { allowed: true, wouldBlock: false, ip: null, source: 'none', reason: 'bypass' };
  }

  if (cfg.invalidEntries.length > 0) {
    return deny('bad-config', null, 'none', cfg.mode);
  }
  if (!cfg.configured || cfg.rules.length === 0) {
    return deny('no-rules', null, 'none', cfg.mode);
  }

  const { ip, source } = resolveClientIp(req, cfg);
  if (ip === null) return deny('unresolvable', null, source, cfg.mode);

  const addr = parseIp(ip);
  if (addr === null) return deny('unresolvable', ip, source, cfg.mode);

  if (matchesAny(addr, cfg.rules)) {
    return { allowed: true, wouldBlock: false, ip, source, reason: 'match' };
  }
  return deny('no-match', ip, source, cfg.mode);
}

/* -------------------------------------------------------------------------- */
/* Express glue                                                               */
/* -------------------------------------------------------------------------- */

const LOG_FLUSH_MS = 10_000;

export function logStartupState(cfg, label = 'ip-allowlist') {
  for (const warning of cfg.warnings) console.warn(`[${label}] ${warning}`);

  if (cfg.mode === 'disabled') {
    console.warn(`[${label}] DISABLED by IP_ALLOWLIST_MODE — every source IP can reach this service.`);
    return;
  }
  if (cfg.invalidEntries.length > 0) {
    console.error(
      `[${label}] unparseable ALLOWED_IPS entries: ${cfg.invalidEntries.join(', ')}. ` +
        `Refusing to enforce a partial list — ALL requests will be denied until this is fixed.`,
    );
    return;
  }
  if (!cfg.configured || cfg.rules.length === 0) {
    console.error(
      `[${label}] ALLOWED_IPS is empty while mode=${cfg.mode}. ` +
        `ALL requests will be denied. Set ALLOWED_IPS, or set IP_ALLOWLIST_MODE=disabled to run open.`,
    );
    return;
  }
  console.log(
    `[${label}] mode=${cfg.mode} rules=${cfg.rules.length} hops=${cfg.proxyHops} ` +
      `header=${cfg.clientIpHeader ?? 'x-forwarded-for'} bypass=${cfg.bypassPaths.join(',') || 'none'}`,
  );
  console.log(`[${label}] allowing ${cfg.rules.map((r) => r.raw).join(', ')}`);
}

export function createIpAllowlist(cfg) {
  const counts = new Map();
  const samples = new Map();
  let timer = null;

  const flush = () => {
    for (const [reason, count] of counts) {
      if (count > 1) {
        console.warn(
          `[ip-allowlist] deny reason=${reason} count=${count} in last ${LOG_FLUSH_MS / 1000}s ` +
            `(first: ${samples.get(reason)})`,
        );
      }
    }
    counts.clear();
    samples.clear();
  };

  const record = (verdict) => {
    const previous = counts.get(verdict.reason) || 0;
    counts.set(verdict.reason, previous + 1);
    if (previous === 0) {
      samples.set(verdict.reason, `ip=${verdict.ip ?? 'unknown'} source=${verdict.source}`);
      console.warn(`[ip-allowlist] deny reason=${verdict.reason} ${samples.get(verdict.reason)}`);
    }
    if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        flush();
      }, LOG_FLUSH_MS);
      if (typeof timer.unref === 'function') timer.unref();
    }
  };

  return function ipAllowlist(req, res, next) {
    const verdict = evaluate(
      {
        headers: req.headers,
        socketRemoteAddress: req.socket?.remoteAddress ?? null,
        path: req.path,
      },
      cfg,
    );

    if (verdict.wouldBlock) {
      record(verdict);
      if (!verdict.allowed) {
        res.status(403).type('text/plain').send('Forbidden');
        return;
      }
    }

    if (verdict.ip) req.clientIp = verdict.ip;
    next();
  };
}
