import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import client from '../api/client';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await client.post('/auth/logout').catch(() => {});
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-green-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold tracking-tight">
          ⛳ GolfTracker
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <Link to="/courses" className="hover:text-green-200">Courses</Link>
          {user ? (
            <>
              <Link to="/rounds" className="hover:text-green-200">My Rounds</Link>
              <Link to={`/profile/${user.id}`} className="hover:text-green-200">
                {user.first_name} ({user.handicap})
              </Link>
              {isAdmin() && (
                <Link to="/admin" className="text-yellow-300 hover:text-yellow-100 font-semibold">
                  Admin
                </Link>
              )}
              <button onClick={handleLogout} className="hover:text-red-300">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="hover:text-green-200">Login</Link>
              <Link to="/register" className="hover:text-green-200">Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
