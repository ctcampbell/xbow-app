import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    // VULN: accepts 'none' algorithm, secret is 'secret', role taken from payload without DB check
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret', {
      algorithms: ['HS256', 'none'] as any,
    });
    req.user = decoded as any;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret', {
        algorithms: ['HS256', 'none'] as any,
      });
      req.user = decoded as any;
    } catch {}
  }
  next();
}
