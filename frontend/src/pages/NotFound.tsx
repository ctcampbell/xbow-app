import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-3xl font-semibold">Not on the shelf</h1>
      <p className="mt-2 text-ink-700">That page does not exist.</p>
      <Link to="/catalogue" className="btn-primary mt-6">Back to the catalogue</Link>
    </div>
  );
}
