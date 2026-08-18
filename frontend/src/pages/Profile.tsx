import { FormEvent, useState } from 'react';
import client, { errorMessage } from '../api/client';
import Alert from '../components/Alert';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../lib/format';

export default function Profile() {
  const { member, refresh } = useAuth();

  const [details, setDetails] = useState({
    first_name: member?.first_name || '',
    last_name: member?.last_name || '',
    email: member?.email || '',
  });
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '' });

  const [detailsState, setDetailsState] = useState<{ error?: string; notice?: string; busy?: boolean }>({});
  const [passwordState, setPasswordState] = useState<{ error?: string; notice?: string; busy?: boolean }>({});

  if (!member) return null;

  async function saveDetails(event: FormEvent) {
    event.preventDefault();
    setDetailsState({ busy: true });
    try {
      await client.patch('/me', details);
      await refresh();
      setDetailsState({ notice: 'Details updated.' });
    } catch (err) {
      setDetailsState({ error: errorMessage(err, 'Could not update your details') });
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setPasswordState({ busy: true });
    try {
      await client.post('/me/password', passwords);
      setPasswords({ current_password: '', new_password: '' });
      setPasswordState({ notice: 'Password changed.' });
    } catch (err) {
      setPasswordState({ error: errorMessage(err, 'Could not change your password') });
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Your membership</h1>
      <p className="mt-1 text-sm text-ink-700">
        Member since {formatDate(member.joined_at)} · {member.role === 'admin' ? 'Administrator' : 'Member'}
      </p>

      <form onSubmit={saveDetails} className="card mt-6 space-y-4 p-6">
        <h2 className="text-lg font-semibold">Details</h2>
        {detailsState.error && <Alert onDismiss={() => setDetailsState({})}>{detailsState.error}</Alert>}
        {detailsState.notice && <Alert kind="success" onDismiss={() => setDetailsState({})}>{detailsState.notice}</Alert>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="first_name">First name</label>
            <input id="first_name" className="input" value={details.first_name}
              onChange={(e) => setDetails((d) => ({ ...d, first_name: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="last_name">Last name</label>
            <input id="last_name" className="input" value={details.last_name}
              onChange={(e) => setDetails((d) => ({ ...d, last_name: e.target.value }))} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" value={details.email}
            onChange={(e) => setDetails((d) => ({ ...d, email: e.target.value }))} />
        </div>

        <button type="submit" className="btn-primary" disabled={detailsState.busy}>Save details</button>
      </form>

      <form onSubmit={changePassword} className="card mt-6 space-y-4 p-6">
        <h2 className="text-lg font-semibold">Password</h2>
        {passwordState.error && <Alert onDismiss={() => setPasswordState({})}>{passwordState.error}</Alert>}
        {passwordState.notice && <Alert kind="success" onDismiss={() => setPasswordState({})}>{passwordState.notice}</Alert>}

        <div>
          <label className="label" htmlFor="current_password">Current password</label>
          <input id="current_password" type="password" className="input" autoComplete="current-password" required
            value={passwords.current_password}
            onChange={(e) => setPasswords((p) => ({ ...p, current_password: e.target.value }))} />
        </div>

        <div>
          <label className="label" htmlFor="new_password">New password</label>
          <input id="new_password" type="password" className="input" autoComplete="new-password" required minLength={10}
            value={passwords.new_password}
            onChange={(e) => setPasswords((p) => ({ ...p, new_password: e.target.value }))} />
          <p className="mt-1 text-xs text-ink-700">At least 10 characters.</p>
        </div>

        <button type="submit" className="btn-primary" disabled={passwordState.busy}>Change password</button>
      </form>
    </div>
  );
}
