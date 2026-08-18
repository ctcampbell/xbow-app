import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client, { errorMessage } from '../../api/client';
import Alert from '../../components/Alert';
import EmptyState from '../../components/EmptyState';
import Spinner from '../../components/Spinner';
import { formatDate, relativeDays } from '../../lib/format';
import { Loan } from '../../types';

interface Stats {
  titles: number;
  copies: number;
  members: number;
  suspended_members: number;
  open_loans: number;
  overdue_loans: number;
  loans_last_30_days: number;
  active_holds: number;
}

interface Popular {
  id: number;
  title: string;
  author: string;
  loan_count: number;
}

function Tile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-ink-700">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-700">{hint}</p>}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [overdue, setOverdue] = useState<Loan[]>([]);
  const [popular, setPopular] = useState<Popular[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    client
      .get('/admin/stats')
      .then(({ data }) => {
        setStats(data.stats);
        setOverdue(data.overdue);
        setPopular(data.popular);
      })
      .catch((err) => setError(errorMessage(err, 'Could not load the dashboard')))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="Gathering figures" />;
  if (error) return <div className="mx-auto max-w-6xl px-4 py-8"><Alert>{error}</Alert></div>;
  if (!stats) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Titles" value={stats.titles} hint={`${stats.copies} copies in total`} />
        <Tile label="Members" value={stats.members} hint={`${stats.suspended_members} suspended`} />
        <Tile label="On loan" value={stats.open_loans} hint={`${stats.loans_last_30_days} issued in 30 days`} />
        <Tile label="Overdue" value={stats.overdue_loans} hint={`${stats.active_holds} holds waiting`} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="border-b border-ink-100 px-5 py-4 text-lg font-semibold">Most overdue</h2>
          {overdue.length === 0 ? (
            <EmptyState title="Nothing overdue" hint="Every loan is within its term." />
          ) : (
            <ul className="divide-y divide-ink-100">
              {overdue.map((loan) => (
                <li key={loan.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{loan.title}</p>
                    <p className="text-ink-700">
                      {loan.first_name} {loan.last_name} · {loan.email}
                    </p>
                  </div>
                  <span className="badge shrink-0 bg-red-50 text-red-700">{relativeDays(loan.due_date).label}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-ink-100 px-5 py-3">
            <Link to="/admin/loans?status=overdue" className="text-sm font-medium text-clay-600 hover:underline">
              See all circulation →
            </Link>
          </div>
        </section>

        <section className="card">
          <h2 className="border-b border-ink-100 px-5 py-4 text-lg font-semibold">Most borrowed (90 days)</h2>
          {popular.length === 0 ? (
            <EmptyState title="No loans yet" hint="Borrowing activity will appear here." />
          ) : (
            <ul className="divide-y divide-ink-100">
              {popular.map((book) => (
                <li key={book.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <Link to={`/books/${book.id}`} className="truncate font-medium hover:text-clay-600">{book.title}</Link>
                    <p className="text-ink-700">{book.author}</p>
                  </div>
                  <span className="badge shrink-0 bg-clay-50 text-clay-700">{book.loan_count} loans</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="mt-8 text-xs text-ink-700">Figures as of {formatDate(new Date().toISOString())}.</p>
    </div>
  );
}
