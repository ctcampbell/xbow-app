interface HoleScore {
  hole_number: number;
  score: number;
  par: number;
}

interface Props {
  holeScores: HoleScore[];
  editable?: boolean;
  onChange?: (hole: number, score: number) => void;
  pars?: number[];
}

const STANDARD_PARS = [4,4,4,3,5,3,4,4,4, 4,4,3,5,4,3,4,5,4];

function scoreClass(score: number, par: number) {
  const diff = score - par;
  if (diff <= -2) return 'bg-yellow-300 font-bold';
  if (diff === -1) return 'bg-red-200';
  if (diff === 0)  return 'bg-white';
  if (diff === 1)  return 'bg-blue-100';
  if (diff === 2)  return 'bg-blue-200';
  return 'bg-blue-300';
}

export default function HoleScoreGrid({ holeScores, editable, onChange, pars }: Props) {
  const coursePars = pars || STANDARD_PARS;
  const front9 = Array.from({ length: 9 }, (_, i) => i + 1);
  const back9  = Array.from({ length: 9 }, (_, i) => i + 10);

  const getScore = (hole: number) => holeScores.find(h => h.hole_number === hole);

  const renderHalf = (holes: number[]) => (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="bg-green-700 text-white">
          <th className="px-2 py-1 text-left">Hole</th>
          {holes.map(h => <th key={h} className="px-2 py-1 text-center w-8">{h}</th>)}
          <th className="px-2 py-1 text-center">Total</th>
        </tr>
        <tr className="bg-green-100">
          <th className="px-2 py-1 text-left text-xs">Par</th>
          {holes.map(h => <th key={h} className="px-2 py-1 text-center text-xs">{coursePars[h-1]}</th>)}
          <th className="px-2 py-1 text-center text-xs">{holes.reduce((s, h) => s + coursePars[h-1], 0)}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="px-2 py-1 font-medium text-xs">Score</td>
          {holes.map(h => {
            const hs = getScore(h);
            const par = coursePars[h - 1];
            return (
              <td key={h} className={`px-1 py-1 text-center ${hs ? scoreClass(hs.score, par) : ''}`}>
                {editable ? (
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={hs?.score ?? ''}
                    onChange={e => onChange?.(h, Number(e.target.value))}
                    className="w-8 text-center border rounded"
                  />
                ) : (
                  <span>{hs?.score ?? '-'}</span>
                )}
              </td>
            );
          })}
          <td className="px-2 py-1 text-center font-semibold">
            {holes.reduce((s, h) => s + (getScore(h)?.score ?? 0), 0) || '-'}
          </td>
        </tr>
      </tbody>
    </table>
  );

  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs text-gray-500 mb-1">Front Nine</p>
        {renderHalf(front9)}
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1">Back Nine</p>
        {renderHalf(back9)}
      </div>
    </div>
  );
}
