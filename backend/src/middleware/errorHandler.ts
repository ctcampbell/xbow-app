import { Request, Response, NextFunction } from 'express';

// VULN: returns full stack trace, SQL error detail, and raw query to client
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);
  // Guard against writing to a response that the client already closed; without
  // this check the attempted write throws an unhandled exception inside the
  // error handler itself.
  if (res.headersSent) return;
  res.status(err.status || 500).json({
    error:   err.message,
    stack:   err.stack,
    detail:  err.detail,
    query:   err.query,
    hint:    err.hint,
    code:    err.code,
  });
}
