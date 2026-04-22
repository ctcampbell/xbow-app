import { Link } from 'react-router-dom';

interface Round {
  id: number;
  course_name: string;
  date_played: string;
  total_score: number;
  course_par?: number;
  notes?: string;
}

export default function ScoreCard({ round }: { round: Round }) {
  const diff = round.total_score - (round.course_par || 72);
  const diffStr = diff > 0 ? `+${diff}` : String(diff);

  return (
    <Link to={`/rounds/${round.id}`} className="block bg-white rounded-lg shadow hover:shadow-md transition p-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-semibold text-green-800">{round.course_name}</p>
          <p className="text-sm text-gray-500">{new Date(round.date_played).toLocaleDateString()}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{round.total_score}</p>
          <p className={`text-sm font-medium ${diff <= 0 ? 'text-red-500' : 'text-blue-500'}`}>
            {diffStr}
          </p>
        </div>
      </div>
    </Link>
  );
}
