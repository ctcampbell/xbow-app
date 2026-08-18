import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client, { errorMessage } from '../../api/client';
import Alert from '../../components/Alert';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import Spinner from '../../components/Spinner';
import { Book, Pagination as PaginationMeta } from '../../types';

export default function AdminBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, page_size: 20, total: 0, pages: 1 });
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState({ q: '', page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await client.get('/books', {
        params: { q: query.q || undefined, page: query.page, page_size: 20 },
      });
      setBooks(data.books);
      setMeta(data.pagination);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Could not load the catalogue'));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(book: Book) {
    if (!window.confirm(`Delete "${book.title}"? This cannot be undone.`)) return;
    setError(null);
    setNotice(null);
    try {
      await client.delete(`/books/${book.id}`);
      setNotice(`"${book.title}" was deleted.`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Books</h1>
        <Link to="/admin/books/new" className="btn-primary">Add a book</Link>
      </div>

      <form
        className="mt-6 flex gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery({ q: search, page: 1 });
        }}
      >
        <input className="input max-w-sm" placeholder="Search title, author or ISBN" value={search}
          onChange={(e) => setSearch(e.target.value)} />
        <button type="submit" className="btn-secondary">Search</button>
      </form>

      <div className="mt-4 space-y-3">
        {error && <Alert onDismiss={() => setError(null)}>{error}</Alert>}
        {notice && <Alert kind="success" onDismiss={() => setNotice(null)}>{notice}</Alert>}
      </div>

      <div className="card mt-4 overflow-hidden">
        {loading ? (
          <Spinner />
        ) : books.length === 0 ? (
          <EmptyState title="No books found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-700">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Author</th>
                  <th className="px-4 py-3">ISBN</th>
                  <th className="px-4 py-3 text-right">Copies</th>
                  <th className="px-4 py-3 text-right">Out</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {books.map((book) => (
                  <tr key={book.id}>
                    <td className="px-4 py-3">
                      <Link to={`/books/${book.id}`} className="font-medium hover:text-clay-600">{book.title}</Link>
                    </td>
                    <td className="px-4 py-3 text-ink-700">{book.author}</td>
                    <td className="px-4 py-3 text-ink-700">{book.isbn || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{book.total_copies}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{book.on_loan}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Link to={`/admin/books/${book.id}/edit`} className="btn-secondary">Edit</Link>
                        <button className="btn-danger" onClick={() => remove(book)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination meta={meta} onChange={(page) => setQuery((q) => ({ ...q, page }))} />
      </div>
    </div>
  );
}
