import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import client, { errorMessage } from '../api/client';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../lib/format';
import { Book, Loan } from '../types';

export default function BookDetail() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();

  const [book, setBook] = useState<Book | null>(null);
  const [myLoans, setMyLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bookResponse, loanResponse] = await Promise.all([
        client.get(`/books/${id}`),
        client.get('/me/loans', { params: { status: 'open' } }),
      ]);
      setBook(bookResponse.data.book);
      setMyLoans(loanResponse.data.loans);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Could not load this book'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(path: string, body: unknown, success: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await client.post(path, body);
      setNotice(success);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner label="Fetching the book" />;
  if (!book) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Alert>{error || 'Book not found'}</Alert>
        <Link to="/catalogue" className="btn-secondary mt-4">Back to catalogue</Link>
      </div>
    );
  }

  const borrowed = myLoans.find((loan) => loan.book_id === book.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/catalogue" className="text-sm text-clay-600 hover:underline">← Catalogue</Link>

      <div className="card mt-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">{book.title}</h1>
        <p className="mt-1 text-lg text-ink-700">{book.author}</p>

        {book.description && <p className="mt-4 leading-relaxed text-ink-800">{book.description}</p>}

        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-ink-100 pt-6 text-sm sm:grid-cols-3">
          <div><dt className="text-ink-700">Publisher</dt><dd className="font-medium">{book.publisher || '—'}</dd></div>
          <div><dt className="text-ink-700">Published</dt><dd className="font-medium">{book.published_year || '—'}</dd></div>
          <div><dt className="text-ink-700">Genre</dt><dd className="font-medium">{book.genre || '—'}</dd></div>
          <div><dt className="text-ink-700">ISBN</dt><dd className="font-medium">{book.isbn || '—'}</dd></div>
          <div><dt className="text-ink-700">Copies</dt><dd className="font-medium">{book.total_copies}</dd></div>
          <div><dt className="text-ink-700">Available</dt><dd className="font-medium">{book.available_copies}</dd></div>
        </dl>

        <div className="mt-6 space-y-3">
          {error && <Alert onDismiss={() => setError(null)}>{error}</Alert>}
          {notice && <Alert kind="success" onDismiss={() => setNotice(null)}>{notice}</Alert>}

          {borrowed ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="badge bg-clay-50 text-clay-700">
                You have this out — due {formatDate(borrowed.due_date)}
              </span>
              <button className="btn-secondary" disabled={busy}
                onClick={() => act(`/loans/${borrowed.id}/return`, {}, 'Returned. Thank you!')}>
                Return
              </button>
              <button className="btn-secondary" disabled={busy}
                onClick={() => act(`/loans/${borrowed.id}/renew`, {}, 'Renewed.')}>
                Renew
              </button>
            </div>
          ) : book.available_copies > 0 ? (
            <button className="btn-primary" disabled={busy}
              onClick={() => act('/loans', { book_id: book.id }, 'Borrowed. Enjoy!')}>
              {busy ? 'Working…' : 'Borrow this book'}
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="badge bg-amber-50 text-amber-800">
                All {book.total_copies} copies are out
                {book.active_holds > 0 ? ` · ${book.active_holds} member(s) waiting` : ''}
              </span>
              <button className="btn-secondary" disabled={busy}
                onClick={() => act('/holds', { book_id: book.id }, 'Hold placed. We will keep your place in the queue.')}>
                Place a hold
              </button>
            </div>
          )}

          {isAdmin && (
            <Link to={`/admin/books/${book.id}/edit`} className="btn-secondary mt-2 inline-flex">
              Edit this record
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
