import { useCallback, useEffect, useState } from 'react';
import client, { errorMessage } from '../../api/client';
import Alert from '../../components/Alert';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import Spinner from '../../components/Spinner';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate } from '../../lib/format';
import { Member, Pagination as PaginationMeta } from '../../types';

export default function AdminMembers() {
  const { member: signedIn } = useAuth();

  const [members, setMembers] = useState<Member[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, page_size: 20, total: 0, pages: 1 });
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState({ q: '', role: '', status: '', page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await client.get('/members', {
        params: {
          q: query.q || undefined,
          role: query.role || undefined,
          status: query.status || undefined,
          page: query.page,
          page_size: 20,
        },
      });
      setMembers(data.members);
      setMeta(data.pagination);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Could not load members'));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(target: Member, changes: Partial<Pick<Member, 'role' | 'status'>>, description: string) {
    setError(null);
    setNotice(null);
    try {
      await client.patch(`/members/${target.id}`, changes);
      setNotice(`${target.first_name} ${target.last_name} ${description}.`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Members</h1>

      <form
        className="mt-6 flex flex-wrap gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery((q) => ({ ...q, q: search, page: 1 }));
        }}
      >
        <input className="input max-w-sm" placeholder="Search name or email" value={search}
          onChange={(e) => setSearch(e.target.value)} />
        <select className="input max-w-[10rem]" value={query.role}
          onChange={(e) => setQuery((q) => ({ ...q, role: e.target.value, page: 1 }))}>
          <option value="">All roles</option>
          <option value="member">Members</option>
          <option value="admin">Administrators</option>
        </select>
        <select className="input max-w-[10rem]" value={query.status}
          onChange={(e) => setQuery((q) => ({ ...q, status: e.target.value, page: 1 }))}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <button type="submit" className="btn-secondary">Search</button>
      </form>

      <div className="mt-4 space-y-3">
        {error && <Alert onDismiss={() => setError(null)}>{error}</Alert>}
        {notice && <Alert kind="success" onDismiss={() => setNotice(null)}>{notice}</Alert>}
      </div>

      <div className="card mt-4 overflow-hidden">
        {loading ? (
          <Spinner />
        ) : members.length === 0 ? (
          <EmptyState title="No members found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-700">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3 text-right">On loan</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {members.map((row) => {
                  const isSelf = row.id === signedIn?.id;
                  return (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-medium">
                        {row.first_name} {row.last_name}
                        {isSelf && <span className="ml-2 text-xs text-ink-700">(you)</span>}
                      </td>
                      <td className="px-4 py-3 text-ink-700">{row.email}</td>
                      <td className="px-4 py-3 text-ink-700">{formatDate(row.joined_at)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.open_loans}
                        {row.overdue_loans ? <span className="ml-1 text-red-700">({row.overdue_loans} late)</span> : null}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${row.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                          {row.status}
                        </span>
                        {row.role === 'admin' && <span className="badge ml-1 bg-clay-50 text-clay-700">staff</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {/* The API refuses self-edits too; disabling here just avoids a pointless round trip. */}
                          <button className="btn-secondary" disabled={isSelf}
                            onClick={() => patch(row, { role: row.role === 'admin' ? 'member' : 'admin' },
                              row.role === 'admin' ? 'is now a member' : 'is now an administrator')}>
                            {row.role === 'admin' ? 'Demote' : 'Make admin'}
                          </button>
                          <button className={row.status === 'active' ? 'btn-danger' : 'btn-secondary'} disabled={isSelf}
                            onClick={() => patch(row, { status: row.status === 'active' ? 'suspended' : 'active' },
                              row.status === 'active' ? 'is suspended' : 'is active again')}>
                            {row.status === 'active' ? 'Suspend' : 'Reinstate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination meta={meta} onChange={(page) => setQuery((q) => ({ ...q, page }))} />
      </div>
    </div>
  );
}
