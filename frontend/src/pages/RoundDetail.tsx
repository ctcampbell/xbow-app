import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import client from '../api/client';
import HoleScoreGrid from '../components/HoleScoreGrid';

export default function RoundDetail() {
  const { id }           = useParams();
  const navigate         = useNavigate();
  const [round, setRound]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    client.get(`/rounds/${id}`)
      .then(res => setRound(res.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load round'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('Delete this round?')) return;
    await client.delete(`/rounds/${id}`);
    navigate('/rounds');
  };

  const handleExport = async (format: string) => {
    // VULN: format param sent to command injection endpoint
    const res = await client.get(`/export/scorecard/${id}`, { params: { format } });
    alert(`Export result:\n${JSON.stringify(res.data, null, 2)}`);
  };

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-8 text-gray-400">Loading...</div>;
  if (error)   return <div className="max-w-4xl mx-auto px-4 py-8 text-red-500">{error}</div>;
  if (!round)  return null;

  const diff = round.total_score - round.course_par;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link to="/rounds" className="text-sm text-green-700 hover:underline mb-4 block">← All Rounds</Link>

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold text-green-800">{round.course_name}</h1>
            <p className="text-gray-500">
              {round.first_name} {round.last_name} &middot; {new Date(round.date_played).toLocaleDateString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold">{round.total_score}</p>
            <p className={`text-lg font-semibold ${diff <= 0 ? 'text-red-500' : 'text-blue-500'}`}>
              {diff > 0 ? `+${diff}` : diff}
            </p>
          </div>
        </div>

        {round.notes && (
          <div className="mb-4 p-3 bg-gray-50 rounded">
            <p className="text-xs text-gray-400 mb-1">Notes</p>
            {/* VULN: stored XSS — notes rendered without sanitization */}
            <div
              className="text-gray-700 text-sm"
              dangerouslySetInnerHTML={{ __html: round.notes }}
            />
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <Link to={`/rounds/${id}/edit`}
            className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
            Edit
          </Link>
          <button onClick={handleDelete}
            className="text-sm bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600">
            Delete
          </button>
          <div className="flex gap-1 ml-auto">
            <span className="text-xs text-gray-400 self-center">Export:</span>
            {['json', 'pdf', 'csv'].map(fmt => (
              <button key={fmt} onClick={() => handleExport(fmt)}
                className="text-xs border px-2 py-1 rounded hover:bg-gray-100">
                {fmt.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="font-semibold text-gray-700 mb-4">Scorecard</h2>
        <HoleScoreGrid holeScores={round.hole_scores || []} />
      </div>
    </div>
  );
}
