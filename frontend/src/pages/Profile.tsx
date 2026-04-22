import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import client from '../api/client';

export default function Profile() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { user: currentUser, login } = useAuth();

  const [profile, setProfile]   = useState<any>(null);
  const [editing, setEditing]   = useState(false);
  const [form, setForm]         = useState<any>({});
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  useEffect(() => {
    // VULN: fetches any user profile by id — IDOR
    client.get(`/users/${id}`)
      .then(res => {
        setProfile(res.data);
        setForm({
          first_name: res.data.first_name,
          last_name:  res.data.last_name,
          handicap:   res.data.handicap,
          bio:        res.data.bio || '',
          avatar_url: res.data.avatar_url || '',
        });
      })
      .catch(() => setError('User not found'));
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      // VULN: sends entire form as body — attacker can inject role='admin' via extra fields
      const res = await client.put(`/users/${id}`, form);
      setProfile(res.data);
      setSuccess('Profile updated');
      setEditing(false);
      // Update local auth state if editing own profile
      if (Number(id) === currentUser?.id) {
        login(localStorage.getItem('jwt')!, res.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Update failed');
    }
  };

  if (error && !profile) return <div className="max-w-2xl mx-auto px-4 py-8 text-red-500">{error}</div>;
  if (!profile) return <div className="max-w-2xl mx-auto px-4 py-8 text-gray-400">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-green-800">
              {profile.first_name} {profile.last_name}
            </h1>
            <p className="text-gray-500">{profile.email}</p>
            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${
              profile.role === 'admin' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
            }`}>
              {profile.role}
            </span>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-green-700">{profile.handicap}</p>
            <p className="text-xs text-gray-400">Handicap</p>
          </div>
        </div>

        {/* VULN: stored XSS — bio rendered without sanitization */}
        {!editing && profile.bio && (
          <div className="mb-4 p-3 bg-gray-50 rounded">
            <p className="text-xs text-gray-400 mb-1">Bio</p>
            <div dangerouslySetInnerHTML={{ __html: profile.bio }} className="text-gray-700 text-sm" />
          </div>
        )}

        {/* VULN: password hash displayed */}
        <div className="mb-4 p-3 bg-red-50 rounded text-xs text-gray-400 font-mono break-all">
          <span className="text-gray-300">pw_hash: </span>{profile.password}
        </div>

        {success && <p className="text-green-600 text-sm mb-3">{success}</p>}
        {error   && <p className="text-red-500 text-sm mb-3">{error}</p>}

        {editing ? (
          <form onSubmit={handleSave} className="space-y-4">
            {[
              { label: 'First Name', key: 'first_name' },
              { label: 'Last Name',  key: 'last_name' },
              { label: 'Handicap',   key: 'handicap' },
              { label: 'Avatar URL', key: 'avatar_url' },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input
                  value={form[key] ?? ''}
                  onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
                  className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
                />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio (HTML allowed)</label>
              <textarea
                value={form.bio ?? ''}
                onChange={e => setForm((f: any) => ({ ...f, bio: e.target.value }))}
                rows={4}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800">
                Save
              </button>
              <button type="button" onClick={() => setEditing(false)}
                className="border px-4 py-2 rounded hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button onClick={() => setEditing(true)}
            className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800">
            Edit Profile
          </button>
        )}
      </div>
    </div>
  );
}
