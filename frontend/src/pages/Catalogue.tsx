import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client, { errorMessage } from '../api/client';
import Alert from '../components/Alert';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import Spinner from '../components/Spinner';
import { Book, Pagination as PaginationMeta } from '../types';

export default function Catalogue() {
  const [books, setBooks] = useState<Book[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, page_size: 20, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ q: '', genre: '', available: '', sort: 'title', page: 1 });

  useEffect(() => {
    client.get('/books/genres').then(({ data }) => setGenres(data.genres)).catch(() => setGenres([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.get('/books', {
        params: {
          q: filters.q || undefined,
          genre: filters.genre || undefined,
          available: filters.available || undefined,
          sort: filters.sort,
          direction: filters.sort === 'newest' ? 'desc' : 'asc',
          page: filters.page,
          page_size: 12,
        },
      });
      setBooks(data.books);
      setMeta(data.pagination);
    } catch (err) {
      setError(errorMessage(err, 'Could not load the catalogue'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Catalogue</h1>

      <form
        className="card mt-6 flex flex-wrap items-end gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters((f) => ({ ...f, q: search, page: 1 }));
        }}
      >
        <div className="min-w-[16rem] flex-1">
          <label className="label" htmlFor="search">Search title, author or ISBN</label>
          <input id="search" className="input" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="e.g. Ursula Le Guin" />
        </div>

        <div>
          <label className="label" htmlFor="genre">Genre</label>
          <select id="genre" className="input" value={filters.genre}
            onChange={(e) => setFilters((f) => ({ ...f, genre: e.target.value, page: 1 }))}>
            <option value="">All genres</option>
            {genres.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="available">Availability</label>
          <select id="available" className="input" value={filters.available}
            onChange={(e) => setFilters((f) => ({ ...f, available: e.target.value, page: 1 }))}>
            <option value="">Everything</option>
            <option value="true">On the shelf</option>
            <option value="false">All copies out</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="sort">Sort by</label>
          <select id="sort" className="input" value={filters.sort}
            onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value, page: 1 }))}>
            <option value="title">Title</option>
            <option value="author">Author</option>
            <option value="year">Year</option>
            <option value="newest">Recently added</option>
          </select>
        </div>

        <button type="submit" className="btn-primary">Search</button>
      </form>

      {error && <div className="mt-6"><Alert onDismiss={() => setError(null)}>{error}</Alert></div>}

      {loading ? (
        <Spinner label="Fetching books" />
      ) : books.length === 0 ? (
        <div className="card mt-6"><EmptyState title="No books match that search" hint="Try a broader term or clear the filters." /></div>
      ) : (
        <>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {books.map((book) => (
              <li key={book.id} className="card flex flex-col p-5">
                <h2 className="text-lg font-semibold leading-snug">
                  <Link to={`/books/${book.id}`} className="hover:text-clay-600">{book.title}</Link>
                </h2>
                <p className="mt-1 text-sm text-ink-700">{book.author}</p>
                <p className="mt-1 text-xs text-ink-700">
                  {[book.genre, book.published_year].filter(Boolean).join(' · ') || '—'}
                </p>

                <div className="mt-4 flex items-center justify-between">
                  {book.available_copies > 0 ? (
                    <span className="badge bg-emerald-50 text-emerald-700">
                      {book.available_copies} of {book.total_copies} on the shelf
                    </span>
                  ) : (
                    <span className="badge bg-amber-50 text-amber-800">
                      All out{book.active_holds > 0 ? ` · ${book.active_holds} waiting` : ''}
                    </span>
                  )}
                  <Link to={`/books/${book.id}`} className="text-sm font-medium text-clay-600 hover:underline">
                    Details
                  </Link>
                </div>
              </li>
            ))}
          </ul>

          <div className="card mt-6">
            <Pagination meta={meta} onChange={(page) => setFilters((f) => ({ ...f, page }))} />
          </div>
        </>
      )}
    </div>
  );
}
