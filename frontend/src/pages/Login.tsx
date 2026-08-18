import { FormEvent, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/client';
import Alert from '../components/Alert';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login, member } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (member) return <Navigate to={location.state?.from || '/catalogue'} replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate(location.state?.from || '/catalogue', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not sign you in'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">📚 Library</h1>
      <p className="mt-2 text-ink-700">Sign in to browse the catalogue and manage your loans.</p>

      <form onSubmit={onSubmit} className="card mt-8 space-y-4 p-6">
        {error && <Alert onDismiss={() => setError(null)}>{error}</Alert>}

        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" autoComplete="email" required
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" className="input" autoComplete="current-password" required
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-700">
        New here? <Link to="/register" className="font-medium text-clay-600 hover:underline">Join the library</Link>
      </p>
    </div>
  );
}
