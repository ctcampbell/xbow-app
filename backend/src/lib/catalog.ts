/**
 * Availability is computed from open loans rather than stored, so every
 * catalogue read shares this projection instead of each route re-deriving it
 * (and getting it subtly different).
 */
export const BOOK_FROM = `
    FROM books b
    LEFT JOIN (
      SELECT book_id, COUNT(*) AS open_count
        FROM loans WHERE returned_at IS NULL GROUP BY book_id
    ) l ON l.book_id = b.id
    LEFT JOIN (
      SELECT book_id, COUNT(*) AS hold_count
        FROM holds WHERE status = 'active' GROUP BY book_id
    ) h ON h.book_id = b.id
`;

export const BOOK_SELECT = `
  SELECT b.id, b.isbn, b.title, b.author, b.publisher, b.published_year,
         b.genre, b.description, b.total_copies, b.created_at, b.updated_at,
         COALESCE(l.open_count, 0)::int                    AS on_loan,
         (b.total_copies - COALESCE(l.open_count, 0))::int AS available_copies,
         COALESCE(h.hold_count, 0)::int                    AS active_holds
  ${BOOK_FROM}
`;

/** Whitelist: the request only ever selects a key, never supplies SQL. */
export const SORT_COLUMNS: Record<string, string> = {
  title: 'b.title',
  author: 'b.author',
  year: 'b.published_year',
  newest: 'b.created_at',
};

/**
 * Escapes LIKE metacharacters so a search for "50%" looks for that text
 * instead of matching everything. Pair with ESCAPE '\' in the query.
 */
export function likeTerm(input: string): string {
  return `%${input.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
