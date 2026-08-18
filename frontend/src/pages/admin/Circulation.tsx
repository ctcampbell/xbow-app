import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import client, { errorMessage } from '../../api/client';
import Alert from '../../components/Alert';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import Spinner from '../../components/Spinner';
import { formatDate, relativeDays } from '../../lib/format';
import { Hold, Loan, Pagination as PaginationMeta } from '../../types';

type Status = 'all' | 'open' | 'overdue' | 'returned';

export default function Circulation() {
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') as Status) || 'open';

  const [loans, setLoans] = useState<Loan[]>([]);
  const [holds, setHolds] = useState<Hold[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, page_size: 20, total: 0, pages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [loanResponse, holdResponse] = await Promise.all([
        client.get('/loans', { params: { status, page, page_size: 20 } }),
        client.get('/holds'),
      ]);
      setLoans(loanResponse.data.loans);
      setMeta(loanResponse.data.pagination);
      setHolds(holdResponse.data.holds);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Could not load circulation'));
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function checkIn(loan: Loan) {
    setError(null);
    setNotice(null);
    try {
      await client.post(`/loans/${loan.id}/return`);
      setNotice(`"${loan.title}" checked in.`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function setStatus(next: Status) {
    setPage(1);
    setParams(next === 'open' ? {} : { status: next });
  }

  const TABS: Status[] = ['open', 'overdue', 'returned', 'all'];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Circulation</h1>

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button key={tab} type="button" onClick={() => setStatus(tab)}
            className={`rounded-md px-3 py-2 text-sm font-medium capitalize transition-colors ${
              status === tab ? 'bg-ink-900 text-white' : 'border border-ink-100 bg-white text-ink-700 hover:bg-ink-50'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {error && <Alert onDismiss={() => setError(null)}>{error}</Alert>}
        {notice && <Alert kind="success" onDismiss={() => setNotice(null)}>{notice}</Alert>}
      </div>

      <div className="card mt-4 overflow-hidden">
        {loading ? (
          <Spinner />
        ) : loans.length === 0 ? (
          <EmptyState title="Nothing to show" hint="No loans match this filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-700">
                <tr>
                  <th className="px-4 py-3">Book</th>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Borrowed</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {loans.map((loan) => {
                  const due = relativeDays(loan.due_date);
                  return (
                    <tr key={loan.id}>
                      <td className="px-4 py-3">
                        <Link to={`/books/${loan.book_id}`} className="font-medium hover:text-clay-600">{loan.title}</Link>
                        <p className="text-xs text-ink-700">{loan.author}</p>
                      </td>
                      <td className="px-4 py-3 text-ink-700">
                        {loan.first_name} {loan.last_name}
                        <p className="text-xs">{loan.email}</p>
                      </td>
                      <td className="px-4 py-3 text-ink-700">{formatDate(loan.borrowed_at)}</td>
                      <td className="px-4 py-3">
                        {loan.returned_at ? (
                          <span className="badge bg-ink-100 text-ink-700">returned {formatDate(loan.returned_at)}</span>
                        ) : (
                          <span className={`badge ${due.overdue ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {due.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!loan.returned_at && (
                          <button className="btn-secondary" onClick={() => checkIn(loan)}>Check in</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination meta={meta} onChange={setPage} />
      </div>

      <section className="card mt-8">
        <h2 className="border-b border-ink-100 px-5 py-4 text-lg font-semibold">
          Hold queue <span className="text-ink-700">({holds.length})</span>
        </h2>
        {holds.length === 0 ? (
          <EmptyState title="Nobody is waiting" />
        ) : (
          <ul className="divide-y divide-ink-100">
            {holds.map((hold) => (
              <li key={hold.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <Link to={`/books/${hold.book_id}`} className="min-w-[12rem] flex-1 font-medium hover:text-clay-600">
                  {hold.title}
                </Link>
                <span className="text-ink-700">{hold.first_name} {hold.last_name}</span>
                <span className="text-ink-700">since {formatDate(hold.placed_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
