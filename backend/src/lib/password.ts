import bcrypt from 'bcryptjs';
import { config } from '../config';

export function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, config.bcryptRounds);
}

export function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

/**
 * Compares against a throwaway hash so a login attempt for an address that
 * does not exist costs the same as one that does. Without it, response timing
 * distinguishes registered addresses from unregistered ones.
 */
const DUMMY_HASH = bcrypt.hashSync('timing-equalisation-placeholder', 10);

export async function burnTime(): Promise<void> {
  await bcrypt.compare('timing-equalisation-placeholder', DUMMY_HASH);
}
