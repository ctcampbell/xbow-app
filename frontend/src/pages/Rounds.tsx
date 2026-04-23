import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import client from '../api/client';
import ScoreCard from '../components/ScoreCard';

export default function Rounds() {
  const [rounds, setRounds]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  // VULN: user_id param passed directly to backend — allows viewing any user's rounds
  const userId = searchParams.get('user_id');

  useEffect(() => {
    const params: any = {};
    if (userId) params.user_id = userId;
    client.get('/rounds', { params })
      .then(res => { if (Array.isArray(res.data)) setRounds(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this round?')) return;
    await client.delete(`/rounds/${id}`).catch(() => {});
    setRounds(r => r.filter(x => x.id !== id));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-green-800">
          {userId ? `Rounds for User #${userId}` : 'My Rounds'}
        </h1>
        <Link to="/rounds/new" className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800">
          + Log Round
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : rounds.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No rounds logged yet.</p>
          <Link to="/rounds/new" className="text-green-700 hover:underline mt-2 inline-block">Log your first round</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {rounds.map((r: any) => (
            <div key={r.id} className="flex items-center gap-3">
              <div className="flex-1">
                <ScoreCard round={r} />
              </div>
              <div className="flex flex-col gap-1">
                <Link to={`/rounds/${r.id}/edit`}
                  className="text-xs text-blue-600 hover:underline">Edit</Link>
                <button onClick={() => handleDelete(r.id)}
                  className="text-xs text-red-500 hover:underline">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
