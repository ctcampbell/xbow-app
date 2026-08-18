import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function linkClass({ isActive }: { isActive: boolean }): string {
  return `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-ink-100 text-ink-900' : 'text-ink-700 hover:bg-ink-100/60'
  }`;
}

export default function Navbar() {
  const { member, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  if (!member) return null;

  return (
    <header className="border-b border-ink-100 bg-white">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
        <Link to="/catalogue" className="mr-4 text-lg font-semibold tracking-tight">
          📚 Library
        </Link>

        <NavLink to="/catalogue" className={linkClass}>Catalogue</NavLink>
        <NavLink to="/my-loans" className={linkClass}>My loans</NavLink>
        {isAdmin && (
          <>
            <span className="mx-1 hidden h-5 w-px bg-ink-100 sm:block" />
            <NavLink to="/admin" end className={linkClass}>Dashboard</NavLink>
            <NavLink to="/admin/books" className={linkClass}>Books</NavLink>
            <NavLink to="/admin/members" className={linkClass}>Members</NavLink>
            <NavLink to="/admin/loans" className={linkClass}>Circulation</NavLink>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          <NavLink to="/profile" className={linkClass}>
            {member.first_name}
            {isAdmin && <span className="badge ml-2 bg-clay-100 text-clay-700">staff</span>}
          </NavLink>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
          >
            Sign out
          </button>
        </div>
      </nav>
    </header>
  );
}
