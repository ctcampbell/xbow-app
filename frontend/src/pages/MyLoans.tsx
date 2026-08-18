import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client, { errorMessage } from '../api/client';
import Alert from '../components/Alert';
import EmptyState from '../components/EmptyState';
import Spinner from '../components/Spinner';
import { formatDate, relativeDays } from '../lib/format';
import { Hold, Loan } from '../types';

export default function MyLoans() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [holds, setHolds] = useState<Hold[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [loanResponse, holdResponse] = await Promise.all([
        client.get('/me/loans'),
        client.get('/me/holds'),
      ]);
      setLoans(loanResponse.data.loans);
      setHolds(holdResponse.data.holds);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Could not load your loans'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: number, request: Promise<unknown>, success: string) {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      await request;
      setNotice(success);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <Spinner label="Fetching your loans" />;

  const open = loans.filter((loan) => !loan.returned_at);
  const history = loans.filter((loan) => loan.returned_at);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">My loans</h1>

      <div className="mt-4 space-y-3">
        {error && <Alert onDismiss={() => setError(null)}>{error}</Alert>}
        {notice && <Alert kind="success" onDismiss={() => setNotice(null)}>{notice}</Alert>}
      </div>

      <section className="card mt-6">
        <h2 className="border-b border-ink-100 px-5 py-4 text-lg font-semibold">
          On loan <span className="text-ink-700">({open.length})</span>
        </h2>

        {open.length === 0 ? (
          <EmptyState title="Nothing on loan" hint="Browse the catalogue to borrow something." />
        ) : (
          <ul className="divide-y divide-ink-100">
            {open.map((loan) => {
              const due = relativeDays(loan.due_date);
              return (
                <li key={loan.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="min-w-[14rem] flex-1">
                    <Link to={`/books/${loan.book_id}`} className="font-medium hover:text-clay-600">{loan.title}</Link>
                    <p className="text-sm text-ink-700">{loan.author}</p>
                  </div>
                  <div className="text-sm">
                    <p>Due {formatDate(loan.due_date)}</p>
                    <p className={due.overdue ? 'font-medium text-red-700' : 'text-ink-700'}>{due.label}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-secondary" disabled={busyId === loan.id}
                      onClick={() => act(loan.id, client.post(`/loans/${loan.id}/renew`), 'Renewed.')}>
                      Renew
                    </button>
                    <button className="btn-primary" disabled={busyId === loan.id}
                      onClick={() => act(loan.id, client.post(`/loans/${loan.id}/return`), 'Returned. Thank you!')}>
                      Return
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card mt-6">
        <h2 className="border-b border-ink-100 px-5 py-4 text-lg font-semibold">
          Holds <span className="text-ink-700">({holds.length})</span>
        </h2>

        {holds.length === 0 ? (
          <EmptyState title="No holds" hint="When every copy is out you can queue for the next one." />
        ) : (
          <ul className="divide-y divide-ink-100">
            {holds.map((hold) => (
              <li key={hold.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-[14rem] flex-1">
                  <Link to={`/books/${hold.book_id}`} className="font-medium hover:text-clay-600">{hold.title}</Link>
                  <p className="text-sm text-ink-700">{hold.author}</p>
                </div>
                <span className="badge bg-clay-50 text-clay-700">Position {hold.queue_position}</span>
                <p className="text-sm text-ink-700">Placed {formatDate(hold.placed_at)}</p>
                <button className="btn-danger" disabled={busyId === hold.id}
                  onClick={() => act(hold.id, client.delete(`/holds/${hold.id}`), 'Hold cancelled.')}>
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {history.length > 0 && (
        <section className="card mt-6">
          <h2 className="border-b border-ink-100 px-5 py-4 text-lg font-semibold">Previously borrowed</h2>
          <ul className="divide-y divide-ink-100">
            {history.map((loan) => (
              <li key={loan.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <Link to={`/books/${loan.book_id}`} className="min-w-[14rem] flex-1 font-medium hover:text-clay-600">
                  {loan.title}
                </Link>
                <span className="text-ink-700">
                  {formatDate(loan.borrowed_at)} → {formatDate(loan.returned_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
