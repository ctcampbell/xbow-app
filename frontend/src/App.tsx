import { Navigate, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import { RequireAdmin, RequireAuth } from './components/RouteGuards';
import BookDetail from './pages/BookDetail';
import Catalogue from './pages/Catalogue';
import Login from './pages/Login';
import MyLoans from './pages/MyLoans';
import NotFound from './pages/NotFound';
import Profile from './pages/Profile';
import Register from './pages/Register';
import AdminBooks from './pages/admin/AdminBooks';
import AdminMembers from './pages/admin/AdminMembers';
import BookForm from './pages/admin/BookForm';
import Circulation from './pages/admin/Circulation';
import Dashboard from './pages/admin/Dashboard';

export default function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route element={<RequireAuth />}>
            <Route path="/" element={<Navigate to="/catalogue" replace />} />
            <Route path="/catalogue" element={<Catalogue />} />
            <Route path="/books/:id" element={<BookDetail />} />
            <Route path="/my-loans" element={<MyLoans />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

          <Route element={<RequireAdmin />}>
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/admin/books" element={<AdminBooks />} />
            <Route path="/admin/books/new" element={<BookForm />} />
            <Route path="/admin/books/:id/edit" element={<BookForm />} />
            <Route path="/admin/members" element={<AdminMembers />} />
            <Route path="/admin/loans" element={<Circulation />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}
