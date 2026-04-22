import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import client from '../api/client';
import ScoreCard from '../components/ScoreCard';

export default function Dashboard() {
  const { user } = useAuth();
  const [rounds, setRounds]     = useState<any[]>([]);
  const [courses, setCourses]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [coursesRes] = await Promise.all([
          client.get('/courses'),
        ]);
        setCourses(coursesRes.data.slice(0, 4));

        if (user) {
          const roundsRes = await client.get('/rounds');
          setRounds(roundsRes.data.slice(0, 5));
        }
      } catch {}
      setLoading(false);
    };
    fetchData();
  }, [user]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-green-800">
          {user ? `Welcome back, ${user.first_name}!` : 'Welcome to GolfTracker'}
        </h1>
        <p className="text-gray-500 mt-1">Track your rounds, improve your handicap.</p>
      </div>

      {!user && (
        <div className="bg-green-700 text-white rounded-xl p-6 mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Start tracking your game</h2>
            <p className="text-green-200 mt-1">Create an account to log rounds and monitor your handicap.</p>
          </div>
          <div className="flex gap-3">
            <Link to="/register" className="bg-white text-green-700 px-4 py-2 rounded font-semibold hover:bg-green-50">
              Register
            </Link>
            <Link to="/login" className="border border-white text-white px-4 py-2 rounded hover:bg-green-600">
              Login
            </Link>
          </div>
        </div>
      )}

      {user && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Handicap</p>
            <p className="text-3xl font-bold text-green-700">{user.handicap}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Rounds Logged</p>
            <p className="text-3xl font-bold text-green-700">{rounds.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 flex items-center justify-center">
            <Link to="/rounds/new" className="bg-green-700 text-white px-4 py-2 rounded font-semibold hover:bg-green-800">
              + Log New Round
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {user && rounds.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xl font-semibold text-gray-800">Recent Rounds</h2>
              <Link to="/rounds" className="text-sm text-green-700 hover:underline">View all</Link>
            </div>
            <div className="space-y-3">
              {rounds.map(r => <ScoreCard key={r.id} round={r} />)}
            </div>
          </div>
        )}

        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-semibold text-gray-800">Featured Courses</h2>
            <Link to="/courses" className="text-sm text-green-700 hover:underline">All courses</Link>
          </div>
          {loading ? (
            <p className="text-gray-400">Loading...</p>
          ) : (
            <div className="space-y-3">
              {courses.map((c: any) => (
                <Link key={c.id} to={`/courses/${c.id}`}
                  className="block bg-white rounded-lg shadow hover:shadow-md transition p-4">
                  <div className="flex justify-between">
                    <div>
                      <p className="font-semibold text-green-800">{c.name}</p>
                      <p className="text-sm text-gray-500">{c.location}</p>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      <p>Par {c.par}</p>
                      <p>Slope {c.slope_rating}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
