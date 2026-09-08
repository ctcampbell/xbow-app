import { createHash, randomBytes } from 'node:crypto';

export function generateAccessToken(): string {
  return `lpat_${randomBytes(32).toString('hex')}`;
}

export function isAccessToken(token: string): boolean {
  return /^lpat_[a-f0-9]{64}$/.test(token);
}

export function hashAccessToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
