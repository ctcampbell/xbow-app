import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import client from '../api/client';

export default function CourseDetail() {
  const { id }          = useParams();
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    client.get(`/courses/${id}`)
      .then(res => setCourse(res.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load course'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-8 text-gray-400">Loading...</div>;
  if (error)   return <div className="max-w-4xl mx-auto px-4 py-8 text-red-500">{error}</div>;
  if (!course) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link to="/courses" className="text-sm text-green-700 hover:underline mb-4 block">← All Courses</Link>

      <div className="bg-white rounded-xl shadow p-6">
        <h1 className="text-3xl font-bold text-green-800">{course.name}</h1>
        <p className="text-gray-500 text-lg mt-1">{course.location}</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-6">
          {[
            { label: 'Par',           value: course.par },
            { label: 'Holes',         value: course.holes },
            { label: 'Slope Rating',  value: course.slope_rating },
            { label: 'Course Rating', value: course.course_rating },
          ].map(({ label, value }) => (
            <div key={label} className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-xl font-bold text-green-700">{value}</p>
            </div>
          ))}
        </div>

        {course.description && (
          <div className="mt-4">
            <h2 className="font-semibold text-gray-700 mb-2">About</h2>
            {/* VULN: stored XSS — description rendered without sanitization */}
            <div
              className="text-gray-600 prose"
              dangerouslySetInnerHTML={{ __html: course.description }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
