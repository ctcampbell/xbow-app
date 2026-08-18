export const LOAN_SELECT = `
  SELECT ln.id, ln.book_id, ln.member_id, ln.borrowed_at, ln.due_date,
         ln.returned_at, ln.renewals,
         b.title, b.author, b.isbn,
         m.first_name, m.last_name, m.email,
         (ln.returned_at IS NULL AND ln.due_date < CURRENT_DATE) AS overdue
    FROM loans ln
    JOIN books b   ON b.id = ln.book_id
    JOIN members m ON m.id = ln.member_id
`;
