import { useEffect, useState } from 'react';
import client from '../api/client';

type Tab = 'users' | 'courses' | 'rounds';

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await client.post('/admin/login', { email, password });
      // VULN: admin token stored in localStorage — accessible to XSS
      localStorage.setItem('admin-jwt', res.data.token);
      localStorage.setItem('admin-user', JSON.stringify(res.data.user));
      onLogin();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-yellow-50">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold text-yellow-700 mb-2">Admin Login</h1>
        <p className="text-sm text-gray-500 mb-6">Sign in with an admin account to continue.</p>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="text"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              placeholder="admin@golf.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-yellow-600 text-white py-2 rounded font-semibold hover:bg-yellow-700 transition"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Admin() {
  const [authed, setAuthed]     = useState(!!localStorage.getItem('admin-jwt'));
  const [tab, setTab]           = useState<Tab>('users');
  const [users, setUsers]       = useState<any[]>([]);
  const [courses, setCourses]   = useState<any[]>([]);
  const [rounds, setRounds]     = useState<any[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [editUser, setEditUser]     = useState<any>(null);
  const [editCourse, setEditCourse] = useState<any>(null);
  const [newCourse, setNewCourse]   = useState(false);

  useEffect(() => {
    if (authed) fetchAll();
  }, [authed]);

  const handleLogin = () => setAuthed(true);

  const handleLogout = () => {
    localStorage.removeItem('admin-jwt');
    localStorage.removeItem('admin-user');
    setAuthed(false);
  };

  const fetchAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [u, c, r] = await Promise.all([
        client.get('/admin/users'),
        client.get('/admin/courses'),
        client.get('/admin/rounds'),
      ]);
      setUsers(u.data);
      setCourses(c.data);
      setRounds(r.data);
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem('admin-jwt');
        setAuthed(false);
      } else {
        setError(err.response?.data?.error || 'Failed to load admin data');
      }
    }
    setLoading(false);
  };

  if (!authed) return <AdminLogin onLogin={handleLogin} />;

  const deleteUser = async (id: number) => {
    if (!confirm('Delete user?')) return;
    await client.delete(`/admin/users/${id}`);
    setUsers(u => u.filter(x => x.id !== id));
  };

  const deleteCourse = async (id: number) => {
    if (!confirm('Delete course?')) return;
    await client.delete(`/admin/courses/${id}`);
    setCourses(c => c.filter(x => x.id !== id));
  };

  const deleteRound = async (id: number) => {
    if (!confirm('Delete round?')) return;
    await client.delete(`/admin/rounds/${id}`);
    setRounds(r => r.filter(x => x.id !== id));
  };

  const saveUser = async () => {
    await client.put(`/admin/users/${editUser.id}`, editUser);
    setEditUser(null);
    fetchAll();
  };

  const saveCourse = async () => {
    if (newCourse) {
      await client.post('/admin/courses', editCourse);
    } else {
      await client.put(`/admin/courses/${editCourse.id}`, editCourse);
    }
    setEditCourse(null);
    setNewCourse(false);
    fetchAll();
  };

  const tabs: Tab[] = ['users', 'courses', 'rounds'];
  const adminUser = JSON.parse(localStorage.getItem('admin-user') || 'null');

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-3xl font-bold text-yellow-700">Admin Panel</h1>
        <div className="flex items-center gap-3 text-sm">
          {adminUser && <span className="text-gray-500">Signed in as <strong>{adminUser.email}</strong></span>}
          <button onClick={handleLogout} className="text-red-500 hover:underline">Sign out</button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 rounded p-3 mb-4 text-sm">{error}</div>
      )}

      <div className="flex gap-2 mb-6">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded capitalize font-medium text-sm ${
              tab === t ? 'bg-yellow-600 text-white' : 'bg-white border hover:bg-gray-50'
            }`}>
            {t} ({t === 'users' ? users.length : t === 'courses' ? courses.length : rounds.length})
          </button>
        ))}
        <button onClick={fetchAll} className="ml-auto text-sm text-gray-500 hover:text-gray-700">
          Refresh
        </button>
      </div>

      {loading ? <p className="text-gray-400">Loading...</p> : (
        <>
          {tab === 'users' && (
            <div className="bg-white rounded-xl shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    {['ID','Email','Name','Role','Handicap','Password Hash','Actions'].map(h => (
                      <th key={h} className="px-3 py-2 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((u: any) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">{u.id}</td>
                      <td className="px-3 py-2">{u.email}</td>
                      <td className="px-3 py-2">{u.first_name} {u.last_name}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          u.role === 'admin' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                        }`}>{u.role}</span>
                      </td>
                      <td className="px-3 py-2">{u.handicap}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-400 max-w-xs truncate">{u.password}</td>
                      <td className="px-3 py-2 flex gap-2">
                        <button onClick={() => setEditUser({ ...u })}
                          className="text-blue-600 hover:underline text-xs">Edit</button>
                        <button onClick={() => deleteUser(u.id)}
                          className="text-red-500 hover:underline text-xs">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'courses' && (
            <div>
              <button onClick={() => { setEditCourse({ name:'',location:'',description:'',par:72,slope_rating:120,course_rating:72,holes:18 }); setNewCourse(true); }}
                className="mb-3 bg-green-700 text-white text-sm px-3 py-1 rounded hover:bg-green-800">
                + Add Course
              </button>
              <div className="bg-white rounded-xl shadow overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      {['ID','Name','Location','Par','Slope','Rating','Actions'].map(h => (
                        <th key={h} className="px-3 py-2 text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {courses.map((c: any) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">{c.id}</td>
                        <td className="px-3 py-2 font-medium">{c.name}</td>
                        <td className="px-3 py-2">{c.location}</td>
                        <td className="px-3 py-2">{c.par}</td>
                        <td className="px-3 py-2">{c.slope_rating}</td>
                        <td className="px-3 py-2">{c.course_rating}</td>
                        <td className="px-3 py-2 flex gap-2">
                          <button onClick={() => { setEditCourse({ ...c }); setNewCourse(false); }}
                            className="text-blue-600 hover:underline text-xs">Edit</button>
                          <button onClick={() => deleteCourse(c.id)}
                            className="text-red-500 hover:underline text-xs">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'rounds' && (
            <div className="bg-white rounded-xl shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    {['ID','User','Course','Date','Score','Notes','Actions'].map(h => (
                      <th key={h} className="px-3 py-2 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rounds.map((r: any) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">{r.id}</td>
                      <td className="px-3 py-2">{r.first_name} {r.last_name}</td>
                      <td className="px-3 py-2">{r.course_name}</td>
                      <td className="px-3 py-2">{new Date(r.date_played).toLocaleDateString()}</td>
                      <td className="px-3 py-2 font-bold">{r.total_score}</td>
                      <td className="px-3 py-2 max-w-xs truncate text-gray-500">{r.notes}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => deleteRound(r.id)}
                          className="text-red-500 hover:underline text-xs">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {editUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Edit User #{editUser.id}</h2>
            {['first_name','last_name','email','handicap','role'].map(field => (
              <div key={field} className="mb-3">
                <label className="block text-sm text-gray-600 mb-1 capitalize">{field.replace('_',' ')}</label>
                <input value={editUser[field] ?? ''} onChange={e => setEditUser((u: any) => ({ ...u, [field]: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
            ))}
            <div className="flex gap-3 mt-4">
              <button onClick={saveUser} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Save</button>
              <button onClick={() => setEditUser(null)} className="border px-4 py-2 rounded text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {editCourse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-bold mb-4">{newCourse ? 'Add Course' : `Edit Course #${editCourse.id}`}</h2>
            {['name','location','par','slope_rating','course_rating','holes'].map(field => (
              <div key={field} className="mb-3">
                <label className="block text-sm text-gray-600 mb-1 capitalize">{field.replace('_',' ')}</label>
                <input value={editCourse[field] ?? ''} onChange={e => setEditCourse((c: any) => ({ ...c, [field]: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
            ))}
            <div className="mb-3">
              <label className="block text-sm text-gray-600 mb-1">Description (HTML allowed)</label>
              <textarea value={editCourse.description ?? ''} onChange={e => setEditCourse((c: any) => ({ ...c, description: e.target.value }))}
                rows={3} className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={saveCourse} className="bg-green-700 text-white px-4 py-2 rounded text-sm">Save</button>
              <button onClick={() => { setEditCourse(null); setNewCourse(false); }} className="border px-4 py-2 rounded text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
