import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Spinner from './Spinner';

/**
 * These guards decide what to render, not what is permitted. Every route they
 * cover is enforced again by the API, which is the only place the decision
 * actually holds.
 */
export function RequireAuth() {
  const { member, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Checking your session" />;
  if (!member) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <Outlet />;
}

export function RequireAdmin() {
  const { member, loading } = useAuth();

  if (loading) return <Spinner label="Checking your session" />;
  if (!member) return <Navigate to="/login" replace />;
  if (member.role !== 'admin') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Staff only</h1>
        <p className="mt-2 text-ink-700">
          This part of the library console is limited to administrators.
        </p>
      </div>
    );
  }
  return <Outlet />;
}
