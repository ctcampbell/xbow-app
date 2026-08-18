/**
 * Source-IP access control: CIDR parsing/matching, client-IP resolution and
 * the allow/deny decision. Framework-agnostic and side-effect free so it can
 * be unit tested directly.
 *
 * Design notes
 * ------------
 * Railway has no native inbound IP allowlist (its edge WAF only offers Under
 * Attack Mode), so this is enforced in-process. Two properties matter:
 *
 *  1. FAIL CLOSED. A missing, empty or malformed allowlist denies every
 *     request. Running without an allowlist has to be an explicit, auditable
 *     choice (IP_ALLOWLIST_MODE=disabled), never the result of a typo.
 *
 *  2. SPOOF RESISTANCE. Railway's edge *appends* the real client IP to
 *     X-Forwarded-For, so the trustworthy value is the Nth entry counted from
 *     the RIGHT, where N is the number of proxies that append on the way in
 *     (1 for Railway alone, 2 with Cloudflare in front). Anything a client
 *     puts in the header lands to the left of that and is ignored. We count
 *     from the right explicitly rather than relying on Express's `trust proxy`
 *     so the hop count is visible and testable.
 *
 * All addresses are normalised into 128-bit IPv6 space, with IPv4 mapped into
 * ::ffff:0:0/96, so a v4 rule matches a v4-mapped client (`::ffff:1.2.3.4`)
 * without special casing at the call site.
 */

const MAX_128 = (1n << 128n) - 1n;
const V4_MAPPED_PREFIX = 0xffffn << 32n; // ::ffff:0:0/96
const V4_WITH_PORT = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d{1,5}$/;

export type Mode = 'enforce' | 'report-only' | 'disabled';

export interface Rule {
  /** Network address, normalised to 128-bit space. */
  base: bigint;
  /** Prefix length in 128-bit space (an IPv4 /24 becomes 120). */
  prefix: number;
  /** The entry as written, for logging. */
  raw: string;
}

export interface AccessConfig {
  mode: Mode;
  rules: Rule[];
  /** Entries that failed to parse. Non-empty means the config is unusable. */
  invalidEntries: string[];
  /** ALLOWED_IPS contained at least one entry. */
  configured: boolean;
  /** Number of trusted proxies that append to X-Forwarded-For. */
  proxyHops: number;
  /** Overrides XFF entirely, e.g. 'cf-connecting-ip'. */
  clientIpHeader: string | null;
  /** Paths exempt from the allowlist (health checks). */
  bypassPaths: string[];
  /** Problems found while loading config, for startup logging. */
  warnings: string[];
}

export type DenyReason =
  | 'bad-config' // malformed entries; refuse to guess
  | 'no-rules' // enabled but nothing allowlisted
  | 'unresolvable' // could not derive a trustworthy client IP
  | 'no-match'; // resolved fine, simply not on the list

export interface Verdict {
  /** Effective outcome. False means the request must be rejected. */
  allowed: boolean;
  /** The raw verdict, before report-only downgrades it to an allow. */
  wouldBlock: boolean;
  /** Resolved client IP as a string, or null if it could not be determined. */
  ip: string | null;
  /** Where the IP came from: 'xff', a header name, 'socket', or 'none'. */
  source: string;
  reason: DenyReason | 'match' | 'disabled' | 'bypass';
}

/* -------------------------------------------------------------------------- */
/* Address parsing                                                            */
/* -------------------------------------------------------------------------- */

function parseIPv4(input: string): bigint | null {
  const parts = input.split('.');
  if (parts.length !== 4) return null;
  let value = 0n;
  for (const part of parts) {
    // Reject leading zeros: '010' is octal in some resolvers and decimal in
    // others, and that ambiguity has been used to slip past allowlists.
    if (!/^\d{1,3}$/.test(part)) return null;
    if (part.length > 1 && part[0] === '0') return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = (value << 8n) | BigInt(octet);
  }
  return V4_MAPPED_PREFIX | value;
}

function parseHextet(group: string): bigint | null {
  if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
  return BigInt(parseInt(group, 16));
}

function parseIPv6(input: string): bigint | null {
  const doubleColon = input.indexOf('::');
  // At most one '::' is permitted.
  if (doubleColon !== -1 && input.indexOf('::', doubleColon + 1) !== -1) return null;

  const headStr = doubleColon === -1 ? input : input.slice(0, doubleColon);
  const tailStr = doubleColon === -1 ? '' : input.slice(doubleColon + 2);
  const split = (s: string) => (s === '' ? [] : s.split(':'));
  const head = split(headStr);
  const tail = split(tailStr);

  // A dotted-quad may only appear as the final token (e.g. ::ffff:1.2.3.4).
  const tokens = [...head, ...tail];
  if (tokens.some((t, i) => t.includes('.') && i !== tokens.length - 1)) return null;

  let trailingV4: bigint | null = null;
  if (tokens.length > 0 && tokens[tokens.length - 1].includes('.')) {
    const mapped = parseIPv4(tokens[tokens.length - 1]);
    if (mapped === null) return null;
    trailingV4 = mapped & 0xffffffffn;
    if (tail.length > 0) tail.pop();
    else head.pop();
  }

  // A dotted-quad occupies the final two hextets.
  const groups = head.length + tail.length + (trailingV4 !== null ? 2 : 0);
  if (doubleColon === -1) {
    if (groups !== 8) return null;
  } else if (groups > 7) {
    // '::' must stand for at least one zero group.
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

/**
 * Parse a bare IPv4 or IPv6 address into 128-bit space. Tolerates the wrappers
 * that show up in real request metadata: IPv6 zone IDs (`%eth0`), bracketed
 * forms (`[::1]`) and `host:port` for IPv4. Returns null on anything invalid —
 * callers must treat null as "deny", never as "allow".
 */
export function parseIp(input: string): bigint | null {
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

/**
 * Parse one allowlist entry: a bare address, or CIDR notation. Prefix lengths
 * are validated against the address family, so `10.0.0.0/33` is rejected
 * rather than silently clamped.
 */
export function parseRule(entry: string): Rule | null {
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

export function matches(addr: bigint, rule: Rule): boolean {
  if (rule.prefix === 0) return true;
  const mask = MAX_128 ^ ((1n << BigInt(128 - rule.prefix)) - 1n);
  return (addr & mask) === (rule.base & mask);
}

export function matchesAny(addr: bigint, rules: Rule[]): boolean {
  return rules.some((rule) => matches(addr, rule));
}

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

const MODES: Mode[] = ['enforce', 'report-only', 'disabled'];

export function loadConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AccessConfig {
  const warnings: string[] = [];

  const rawMode = (env.IP_ALLOWLIST_MODE || 'enforce').trim().toLowerCase();
  let mode: Mode = 'enforce';
  if (MODES.includes(rawMode as Mode)) {
    mode = rawMode as Mode;
  } else {
    warnings.push(
      `IP_ALLOWLIST_MODE='${rawMode}' is not one of ${MODES.join('|')}; falling back to 'enforce'.`,
    );
  }

  // Accept commas, whitespace and newlines as separators so the value can be
  // pasted as a list in the Railway dashboard.
  const entries = (env.ALLOWED_IPS || '')
    .split(/[\s,]+/)
    .map((e) => e.trim())
    .filter(Boolean);

  const rules: Rule[] = [];
  const invalidEntries: string[] = [];
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

export interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  socketRemoteAddress?: string | null;
  path?: string;
}

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | null {
  const value = headers[name];
  if (value === undefined) return null;
  // Node joins repeated headers with ', '; the rightmost value is the one our
  // own edge set, matching the append-order logic used for XFF below.
  if (Array.isArray(value)) return value.length ? value[value.length - 1] : null;
  return value;
}

export function resolveClientIp(
  req: RequestLike,
  cfg: AccessConfig,
): { ip: string | null; source: string } {
  // An explicit header (Cloudflare's CF-Connecting-IP) is authoritative when
  // configured: it carries exactly one address and our edge overwrites it.
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
    // Our proxies append, so count in from the right.
    const index = tokens.length - cfg.proxyHops;
    if (index < 0 || index >= tokens.length) {
      // Chain is shorter than the configured hop count: either the hop count
      // is wrong or the request did not come through the expected edge.
      // Either way we cannot identify the caller.
      return { ip: null, source: 'xff' };
    }
    return { ip: tokens[index], source: 'xff' };
  }

  // No XFF at all: a direct connection, e.g. over Railway's private network.
  // The socket address still has to be on the allowlist to be admitted.
  const socket = req.socketRemoteAddress;
  if (socket) return { ip: socket, source: 'socket' };
  return { ip: null, source: 'none' };
}

/* -------------------------------------------------------------------------- */
/* Decision                                                                   */
/* -------------------------------------------------------------------------- */

function deny(reason: DenyReason, ip: string | null, source: string, mode: Mode): Verdict {
  return { allowed: mode === 'report-only', wouldBlock: true, ip, source, reason };
}

export function evaluate(req: RequestLike, cfg: AccessConfig): Verdict {
  if (cfg.mode === 'disabled') {
    return { allowed: true, wouldBlock: false, ip: null, source: 'none', reason: 'disabled' };
  }

  if (req.path !== undefined && cfg.bypassPaths.includes(req.path)) {
    return { allowed: true, wouldBlock: false, ip: null, source: 'none', reason: 'bypass' };
  }

  // Fail closed: refuse to operate on a config we could not fully parse,
  // rather than enforcing a partial list the operator did not intend.
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
