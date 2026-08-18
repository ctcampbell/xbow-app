import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { ApiError } from '../lib/errors';

type Source = 'body' | 'query' | 'params';

/**
 * Replaces req[source] with the parsed result, so handlers work from typed,
 * coerced values and never touch the raw input. Unknown keys are stripped by
 * the schemas themselves, which is what keeps mass-assignment out of the
 * update routes.
 */
export function validate(schema: ZodSchema, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join('.') || '(root)',
        message: i.message,
      }));
      throw ApiError.badRequest('Validation failed', details);
    }
    // req.query and req.params are getter-only in Express 5 but writable in 4;
    // assigning through defineProperty works on both.
    Object.defineProperty(req, source, { value: result.data, writable: true, configurable: true });
    next();
  };
}
