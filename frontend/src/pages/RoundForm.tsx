import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import client from '../api/client';
import HoleScoreGrid from '../components/HoleScoreGrid';

const STANDARD_PARS = [4,4,4,3,5,3,4,4,4, 4,4,3,5,4,3,4,5,4];

export default function RoundForm() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const isEdit     = Boolean(id);

  const [courses, setCourses]   = useState<any[]>([]);
  const [courseId, setCourseId] = useState('');
  const [datePlayed, setDatePlayed] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes]       = useState('');
  const [holeScores, setHoleScores] = useState<{ hole_number: number; score: number; par: number }[]>(
    STANDARD_PARS.map((par, i) => ({ hole_number: i + 1, score: par, par }))
  );
  const [error, setError] = useState('');

  useEffect(() => {
    client.get('/courses').then(res => setCourses(res.data));
    if (isEdit) {
      client.get(`/rounds/${id}`).then(res => {
        const r = res.data;
        setCourseId(String(r.course_id));
        setDatePlayed(r.date_played.split('T')[0]);
        setNotes(r.notes || '');
        if (r.hole_scores?.length) setHoleScores(r.hole_scores);
      });
    }
  }, [id]);

  const setScore = (hole: number, score: number) => {
    setHoleScores(prev => prev.map(hs =>
      hs.hole_number === hole ? { ...hs, score } : hs
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const totalScore = holeScores.reduce((s, hs) => s + hs.score, 0);
    const payload = {
      course_id: Number(courseId),
      date_played: datePlayed,
      total_score: totalScore,
      notes,
      hole_scores: holeScores,
    };
    try {
      if (isEdit) {
        await client.put(`/rounds/${id}`, payload);
      } else {
        await client.post('/rounds', payload);
      }
      navigate('/rounds');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save round');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-green-800 mb-6">
        {isEdit ? 'Edit Round' : 'Log New Round'}
      </h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
            <select
              value={courseId}
              onChange={e => setCourseId(e.target.value)}
              required
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
            >
              <option value="">Select a course...</option>
              {courses.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name} — {c.location}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Played</label>
            <input
              type="date"
              value={datePlayed}
              onChange={e => setDatePlayed(e.target.value)}
              required
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
              placeholder="How did it go? (HTML allowed)"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold text-gray-700 mb-4">Hole-by-Hole Scores</h2>
          <HoleScoreGrid
            holeScores={holeScores}
            editable
            onChange={setScore}
          />
          <p className="text-right font-bold mt-4 text-lg">
            Total: {holeScores.reduce((s, hs) => s + hs.score, 0)}
          </p>
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => navigate(-1)}
            className="border px-4 py-2 rounded hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit"
            className="bg-green-700 text-white px-6 py-2 rounded font-semibold hover:bg-green-800">
            {isEdit ? 'Save Changes' : 'Log Round'}
          </button>
        </div>
      </form>
    </div>
  );
}
