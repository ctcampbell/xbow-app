import { z } from 'zod';

/** Shared field shapes, so the same rule cannot drift between routes. */
export const email = z.string().trim().toLowerCase().email('Must be a valid email address').max(255);
export const password = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(200, 'Password must be at most 200 characters');
export const name = z.string().trim().min(1).max(100);

export const idParam = z.object({
  id: z.coerce.number().int().positive('Must be a positive integer'),
});

export const registerSchema = z.object({
  email,
  password,
  first_name: name,
  last_name: name,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(200),
});

export const updateProfileSchema = z
  .object({
    email: email.optional(),
    first_name: name.optional(),
    last_name: name.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: password,
});

export const createAccessTokenSchema = z.object({
  name: z.string().trim().min(1).max(100),
  expires_in_days: z.number().int().min(1).max(365).default(365),
});

const isbn = z
  .string()
  .trim()
  .regex(/^[0-9-]{10,20}$/, 'ISBN may contain digits and hyphens only')
  .nullable()
  .optional();

export const createBookSchema = z.object({
  isbn,
  title: z.string().trim().min(1).max(500),
  author: z.string().trim().min(1).max(255),
  publisher: z.string().trim().max(255).nullable().optional(),
  published_year: z.coerce.number().int().min(1450).max(2200).nullable().optional(),
  genre: z.string().trim().max(100).nullable().optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  total_copies: z.coerce.number().int().min(0).max(10_000).default(1),
});

/** Every field optional, but at least one present. */
export const updateBookSchema = createBookSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const catalogQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  genre: z.string().trim().max(100).optional(),
  author: z.string().trim().max(255).optional(),
  available: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  // Whitelisted: these become an ORDER BY clause, so they can never be free text.
  sort: z.enum(['title', 'author', 'year', 'newest']).default('title'),
  direction: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});

export const borrowSchema = z.object({
  book_id: z.coerce.number().int().positive(),
});

export const loanQuerySchema = z.object({
  status: z.enum(['open', 'overdue', 'returned', 'all']).default('all'),
  member_id: z.coerce.number().int().positive().optional(),
  book_id: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});

export const memberQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  role: z.enum(['member', 'admin']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateMemberSchema = z
  .object({
    role: z.enum(['member', 'admin']).optional(),
    status: z.enum(['active', 'suspended']).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });
