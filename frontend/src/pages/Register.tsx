import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/client';
import Alert from '../components/Alert';
import { useAuth } from '../contexts/AuthContext';

export default function Register() {
  const { register, member } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (member) return <Navigate to="/catalogue" replace />;

  function update(field: keyof typeof form) {
    return (event: { target: { value: string } }) => setForm((f) => ({ ...f, [field]: event.target.value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(form);
      navigate('/catalogue', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not create your membership'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Join the library</h1>
      <p className="mt-2 text-ink-700">Membership is free and gives you access to the whole catalogue.</p>

      <form onSubmit={onSubmit} className="card mt-8 space-y-4 p-6">
        {error && <Alert onDismiss={() => setError(null)}>{error}</Alert>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="first_name">First name</label>
            <input id="first_name" className="input" required value={form.first_name} onChange={update('first_name')} />
          </div>
          <div>
            <label className="label" htmlFor="last_name">Last name</label>
            <input id="last_name" className="input" required value={form.last_name} onChange={update('last_name')} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" autoComplete="email" required
            value={form.email} onChange={update('email')} />
        </div>

        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" className="input" autoComplete="new-password" required minLength={10}
            value={form.password} onChange={update('password')} />
          <p className="mt-1 text-xs text-ink-700">At least 10 characters.</p>
        </div>

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Creating your membership…' : 'Create membership'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-700">
        Already a member? <Link to="/login" className="font-medium text-clay-600 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
