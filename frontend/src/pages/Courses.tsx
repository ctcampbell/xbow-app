import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import client from '../api/client';

export default function Courses() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch]     = useState(searchParams.get('search') || '');
  const [location, setLocation] = useState(searchParams.get('location') || '');

  const searchTerm   = searchParams.get('search') || '';
  const locationTerm = searchParams.get('location') || '';

  useEffect(() => {
    setLoading(true);
    client.get('/courses', { params: { search: searchTerm, location: locationTerm } })
      .then(res => setCourses(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [searchTerm, locationTerm]);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSearchParams({ search, location });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-green-800 mb-6">Golf Courses</h1>

      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name..."
          className="flex-1 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <input
          value={location}
          onChange={e => setLocation(e.target.value)}
          placeholder="Filter by location..."
          className="flex-1 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button type="submit" className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800">
          Search
        </button>
      </form>

      {/* VULN: reflected XSS — searchTerm rendered with dangerouslySetInnerHTML */}
      {searchTerm && (
        <p className="text-sm text-gray-500 mb-4"
          dangerouslySetInnerHTML={{ __html: `Results for: "${searchTerm}"` }}
        />
      )}

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : courses.length === 0 ? (
        <p className="text-gray-500">No courses found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c: any) => (
            <Link key={c.id} to={`/courses/${c.id}`}
              className="bg-white rounded-lg shadow hover:shadow-md transition p-5 block">
              <h3 className="font-semibold text-green-800 text-lg">{c.name}</h3>
              <p className="text-sm text-gray-500 mb-3">{c.location}</p>
              <div className="flex gap-4 text-sm text-gray-700">
                <span>Par <strong>{c.par}</strong></span>
                <span>Slope <strong>{c.slope_rating}</strong></span>
                <span>Rating <strong>{c.course_rating}</strong></span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
