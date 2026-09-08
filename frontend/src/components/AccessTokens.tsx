import { FormEvent, useEffect, useState } from 'react';
import client, { errorMessage } from '../api/client';
import { formatDate } from '../lib/format';
import Alert from './Alert';

interface AccessToken {
  id: number;
  name: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export default function AccessTokens() {
  const [tokens, setTokens] = useState<AccessToken[]>([]);
  const [name, setName] = useState('');
  const [days, setDays] = useState(365);
  const [created, setCreated] = useState<{ token: string; id: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    client.get('/me/tokens')
      .then(({ data }) => { if (active) setTokens(data.tokens); })
      .catch((err) => { if (active) setError(errorMessage(err, 'Could not load access tokens')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function generate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data } = await client.post('/me/tokens', { name, expires_in_days: days });
      setTokens((current) => [data.access_token, ...current]);
      setCreated({ token: data.token, id: data.access_token.id });
      setCopied(false);
      setName('');
    } catch (err) {
      setError(errorMessage(err, 'Could not generate access token'));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(token: AccessToken) {
    setBusy(true);
    setError(null);
    try {
      await client.delete(`/me/tokens/${token.id}`);
      setTokens((current) => current.map((t) => t.id === token.id ? { ...t, revoked_at: new Date().toISOString() } : t));
      if (created?.id === token.id) setCreated(null);
    } catch (err) {
      setError(errorMessage(err, 'Could not revoke access token'));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(created!.token);
      setCopied(true);
    } catch {
      setError('Could not copy automatically. Select and copy the token below.');
    }
  }

  return (
    <section className="card mt-6 space-y-4 p-6" aria-labelledby="access-tokens-heading">
      <h2 id="access-tokens-heading" className="text-lg font-semibold">Personal access tokens</h2>
      <p className="text-sm text-ink-700">
        Use a token in the Authorization header for API calls. It grants your current account permissions.
        Sign in to the web UI with your email and password.
        Keep it private. Signing out or changing your password does not revoke it.
      </p>
      {error && <Alert onDismiss={() => setError(null)}>{error}</Alert>}

      {created && (
        <div className="space-y-3 rounded-lg border border-clay-600 p-4">
          <p className="text-sm font-medium">Copy your token now. You cannot view it again after leaving this page.</p>
          <label className="label" htmlFor="created-token">New access token</label>
          <textarea id="created-token" className="input font-mono text-sm" readOnly rows={3}
            value={created.token} onFocus={(event) => event.target.select()} />
          <div className="flex gap-3">
            <button type="button" className="btn-primary" onClick={copy}>{copied ? 'Copied' : 'Copy token'}</button>
            <button type="button" className="btn-secondary" onClick={() => setCreated(null)}>Done</button>
          </div>
        </div>
      )}

      <form onSubmit={generate} className="space-y-4">
        <div>
          <label className="label" htmlFor="token-name">Token name</label>
          <input id="token-name" className="input" placeholder="e.g. Catalogue script" required maxLength={100}
            value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="token-expiry">Expires in</label>
          <select id="token-expiry" className="input" value={days} onChange={(event) => setDays(Number(event.target.value))}>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={365}>1 year</option>
          </select>
        </div>
        <button type="submit" className="btn-primary" disabled={busy || loading || !!created || !name.trim()}>
          Generate token
        </button>
      </form>

      <p className="text-sm text-ink-700">Send API requests with <code>Authorization: Bearer YOUR_TOKEN</code>.</p>
      {loading ? <p className="text-sm">Loading tokens…</p> : tokens.length === 0 ? (
        <p className="text-sm text-ink-700">You have no personal access tokens.</p>
      ) : (
        <ul className="divide-y">
          {tokens.map((token) => {
            const expired = new Date(token.expires_at).getTime() <= Date.now();
            return (
              <li key={token.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="break-words font-medium">{token.name}</p>
                  <p className="text-xs text-ink-700">
                    Created {formatDate(token.created_at)} · {token.revoked_at ? 'Revoked' : `${expired ? 'Expired' : 'Expires'} ${formatDate(token.expires_at)}`}
                  </p>
                </div>
                {!token.revoked_at && !expired && (
                  <button type="button" className="btn-secondary" disabled={busy} onClick={() => revoke(token)}
                    aria-label={`Revoke ${token.name}`}>Revoke</button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
