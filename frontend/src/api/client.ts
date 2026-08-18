import axios from 'axios';

/**
 * Resolves the API base URL.
 *
 * A value with no scheme ("api.example.com") is a relative URL to the browser,
 * so it silently resolves against this origin and every call 404s against the
 * static server. Rather than fail that way, assume https and say so.
 */
export function resolveBaseUrl(raw: string | undefined): string {
  const value = (raw || '').trim().replace(/\/+$/, '');
  if (value === '') return '/api';
  if (/^https?:\/\//i.test(value)) return `${value}/api`;
  console.warn(`VITE_API_URL="${raw}" has no scheme; assuming https://`);
  return `https://${value}/api`;
}

const client = axios.create({
  baseURL: resolveBaseUrl((import.meta as any).env?.VITE_API_URL),
  headers: { 'Content-Type': 'application/json' },
});

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

/** Lets AuthContext clear its state when the API says the session is over. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

client.interceptors.request.use((config) => {
  if (authToken) config.headers.Authorization = `Bearer ${authToken}`;
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && onUnauthorized) onUnauthorized();
    return Promise.reject(error);
  },
);

/** Pulls the API's error message out of an axios failure. */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  const data = (err as any)?.response?.data;
  if (typeof data?.error === 'string') {
    const details = Array.isArray(data.details)
      ? data.details.map((d: any) => `${d.field}: ${d.message}`).join(', ')
      : '';
    return details ? `${data.error} — ${details}` : data.error;
  }
  if ((err as any)?.message === 'Network Error') {
    return 'Cannot reach the library API. Check your connection and try again.';
  }
  return fallback;
}

export default client;
