import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

import Dashboard    from './pages/Dashboard';
import Login        from './pages/Login';
import Register     from './pages/Register';
import Courses      from './pages/Courses';
import CourseDetail from './pages/CourseDetail';
import Rounds       from './pages/Rounds';
import RoundDetail  from './pages/RoundDetail';
import RoundForm    from './pages/RoundForm';
import Profile      from './pages/Profile';
import Admin        from './pages/Admin';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/"            element={<Dashboard />} />
          <Route path="/login"       element={<Login />} />
          <Route path="/register"    element={<Register />} />
          <Route path="/courses"     element={<Courses />} />
          <Route path="/courses/:id" element={<CourseDetail />} />
          <Route path="/rounds"      element={<ProtectedRoute><Rounds /></ProtectedRoute>} />
          <Route path="/rounds/new"  element={<ProtectedRoute><RoundForm /></ProtectedRoute>} />
          <Route path="/rounds/:id"  element={<ProtectedRoute><RoundDetail /></ProtectedRoute>} />
          <Route path="/rounds/:id/edit" element={<ProtectedRoute><RoundForm /></ProtectedRoute>} />
          <Route path="/profile/:id" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          {/* VULN: admin route has no server-side role check — frontend-only guard */}
          <Route path="/admin"       element={<Admin />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
