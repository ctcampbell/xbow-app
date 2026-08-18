import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import client, { setAuthToken, setUnauthorizedHandler } from '../api/client';
import { Member } from '../types';

/**
 * The token lives in sessionStorage so a page reload keeps you signed in but
 * closing the tab does not. It is still reachable from JavaScript, which is
 * the accepted trade-off of bearer-token SPAs; the app never renders raw HTML
 * from the API, so there is no injection point to read it with.
 */
const TOKEN_KEY = 'library.token';

interface AuthState {
  member: Member | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; first_name: string; last_name: string }) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setAuthToken(null);
    setMember(null);
  }, []);

  const adopt = useCallback((token: string, nextMember: Member) => {
    sessionStorage.setItem(TOKEN_KEY, token);
    setAuthToken(token);
    setMember(nextMember);
  }, []);

  // Restore a session on first paint: the stored token might be expired or
  // belong to a membership that has since been suspended, so ask the API.
  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    const stored = sessionStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setLoading(false);
      return;
    }
    setAuthToken(stored);
    client
      .get('/me')
      .then(({ data }) => setMember(data.member))
      .catch(() => clearSession())
      .finally(() => setLoading(false));
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await client.post('/auth/login', { email, password });
      adopt(data.token, data.member);
    },
    [adopt],
  );

  const register = useCallback(
    async (input: { email: string; password: string; first_name: string; last_name: string }) => {
      const { data } = await client.post('/auth/register', input);
      adopt(data.token, data.member);
    },
    [adopt],
  );

  const refresh = useCallback(async () => {
    const { data } = await client.get('/me');
    setMember(data.member);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ member, loading, isAdmin: member?.role === 'admin', login, register, logout: clearSession, refresh }),
    [member, loading, login, register, clearSession, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
