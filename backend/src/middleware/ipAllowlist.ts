import { Request, Response, NextFunction } from 'express';
import { AccessConfig, evaluate, loadConfigFromEnv, Verdict } from '../lib/ipAccess';

/**
 * Source-IP allowlist for the API.
 *
 * Fails closed: if ALLOWED_IPS is unset, empty, or contains an entry we cannot
 * parse, every request is denied. To run the service open you must say so
 * explicitly with IP_ALLOWLIST_MODE=disabled.
 *
 * Configuration (see .env.example):
 *   ALLOWED_IPS                 comma/space separated IPs and CIDRs, v4 and v6
 *   IP_ALLOWLIST_MODE           enforce (default) | report-only | disabled
 *   TRUSTED_PROXY_HOPS          proxies that append to XFF; 1 = Railway alone
 *   CLIENT_IP_HEADER            e.g. cf-connecting-ip, overrides XFF entirely
 *   IP_ALLOWLIST_BYPASS_PATHS   default /healthz
 */

/** Denials are noisy under scanner traffic, so aggregate and flush. */
const LOG_FLUSH_MS = 10_000;

class DenialLog {
  private counts = new Map<string, number>();
  private samples = new Map<string, string>();
  private timer: NodeJS.Timeout | null = null;

  record(verdict: Verdict): void {
    const key = verdict.reason;
    const previous = this.counts.get(key) || 0;
    this.counts.set(key, previous + 1);
    if (previous === 0) {
      this.samples.set(key, `ip=${verdict.ip ?? 'unknown'} source=${verdict.source}`);
      // Log the first of each kind immediately so a misconfiguration is
      // obvious straight away rather than up to a flush interval later.
      console.warn(`[ip-allowlist] deny reason=${key} ${this.samples.get(key)}`);
    }
    this.schedule();
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, LOG_FLUSH_MS);
    // Do not hold the event loop open on shutdown.
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  private flush(): void {
    for (const [reason, count] of this.counts) {
      if (count > 1) {
        console.warn(
          `[ip-allowlist] deny reason=${reason} count=${count} in last ${LOG_FLUSH_MS / 1000}s ` +
            `(first: ${this.samples.get(reason)})`,
        );
      }
    }
    this.counts.clear();
    this.samples.clear();
  }
}

export function logStartupState(cfg: AccessConfig, label = 'ip-allowlist'): void {
  for (const warning of cfg.warnings) console.warn(`[${label}] ${warning}`);

  if (cfg.mode === 'disabled') {
    console.warn(
      `[${label}] DISABLED by IP_ALLOWLIST_MODE — every source IP can reach this service.`,
    );
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

export function createIpAllowlist(cfg: AccessConfig) {
  const denials = new DenialLog();

  return function ipAllowlist(req: Request, res: Response, next: NextFunction): void {
    const verdict = evaluate(
      {
        headers: req.headers as Record<string, string | string[] | undefined>,
        socketRemoteAddress: req.socket?.remoteAddress ?? null,
        path: req.path,
      },
      cfg,
    );

    if (verdict.wouldBlock) {
      denials.record(verdict);
      if (!verdict.allowed) {
        // Deliberately terse: do not confirm to the caller that an allowlist
        // exists or echo back the IP we resolved.
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
    }

    // Expose the trustworthy IP for downstream handlers and logging, so nothing
    // else has to re-derive it (and get the hop counting wrong).
    if (verdict.ip) (req as Request & { clientIp?: string }).clientIp = verdict.ip;
    next();
  };
}

export const accessConfig = loadConfigFromEnv();
export const ipAllowlist = createIpAllowlist(accessConfig);
