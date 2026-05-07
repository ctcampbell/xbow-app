import { Request, Response, NextFunction } from 'express';

// Errors caused by automated scanners hammering the deliberately broken
// routes (SQL syntax errors from injection probes, HTTP 4xx from path
// traversal, etc.) are *expected* and not bugs in the app. Logging a full
// stack for each one fills the container's log pipeline and can starve
// real diagnostics. We compact those to a single line. Anything else
// still gets a full dump.
function isExpectedScannerError(err: any): boolean {
  if (!err) return false;
  // pg errors carry a SQLSTATE code as a string (e.g. '42601', '22P02').
  if (typeof err.code === 'string' && /^[0-9A-Z]{5}$/.test(err.code)) return true;
  // http-errors / send 4xx (ForbiddenError, NotFoundError, etc.).
  const status = err.status || err.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) return true;
  return false;
}

// VULN: returns full stack trace, SQL error detail, and raw query to client
export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  if (isExpectedScannerError(err)) {
    console.error(`[${err.code || err.status || err.statusCode}] ${req.method} ${req.originalUrl}: ${err.message}`);
  } else {
    console.error(err);
  }
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
