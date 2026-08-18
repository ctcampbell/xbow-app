import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthContext, Role } from '../types';

interface TokenPayload {
  sub: string;
  email: string;
  role: Role;
}

export function issueToken(member: { id: number; email: string; role: Role }): string {
  const payload: TokenPayload = {
    sub: String(member.id),
    email: member.email,
    role: member.role,
  };
  const options: jwt.SignOptions = {
    // Validated shape ('12h', '30m', seconds as a number-string) is checked by
    // jsonwebtoken at sign time; the cast is only to satisfy its literal type.
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  };
  return jwt.sign(payload, config.jwtSecret, options);
}

/** Returns null for anything that is not a currently valid token we issued. */
export function verifyToken(token: string): AuthContext | null {
  try {
    // Pinning the algorithm stops a caller presenting an 'alg: none' token.
    const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as TokenPayload;
    const id = Number(decoded.sub);
    if (!Number.isInteger(id) || id <= 0) return null;
    if (decoded.role !== 'member' && decoded.role !== 'admin') return null;
    return { id, email: decoded.email, role: decoded.role };
  } catch {
    return null;
  }
}
