/**
 * Environment configuration, resolved once at boot.
 *
 * Anything missing that the process cannot safely invent is a startup failure
 * rather than a surprise at first request. JWT_SECRET is the important one:
 * defaulting it would mean every deploy signs tokens with a value an attacker
 * can read in this repository.
 */

function required(name: string): string {
  const value = (process.env[name] || '').trim();
  if (value === '') {
    throw new Error(`${name} is required but not set`);
  }
  return value;
}

function intFromEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = (process.env[name] || '').trim();
  if (raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    console.warn(`[config] ${name}='${raw}' is not an integer in ${min}..${max}; using ${fallback}`);
    return fallback;
  }
  return parsed;
}

export const config = {
  port: intFromEnv('PORT', 3001, 1, 65535),
  nodeEnv: process.env.NODE_ENV || 'development',
  // npm run dev sets NODE_ENV explicitly through the local Compose stack.
  // Keep limiting enabled when NODE_ENV is missing or unrecognized.
  rateLimitEnabled: process.env.NODE_ENV !== 'development',
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN || '12h').trim(),

  /** Origins allowed to make browser calls. Comma separated; '*' is rejected. */
  corsOrigins: (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o !== '' && o !== '*'),

  /** Lending policy. */
  loanDays: intFromEnv('LOAN_DAYS', 21, 1, 365),
  maxOpenLoans: intFromEnv('MAX_OPEN_LOANS', 5, 1, 100),
  maxRenewals: intFromEnv('MAX_RENEWALS', 2, 0, 10),

  bcryptRounds: intFromEnv('BCRYPT_ROUNDS', 12, 10, 15),
};

export type Config = typeof config;
