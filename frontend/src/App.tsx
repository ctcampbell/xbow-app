import { ReactNode } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import RequireNumericId from './components/RequireNumericId';

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
import NotFound     from './pages/NotFound';

function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"            element={<Layout><Dashboard /></Layout>} />
          <Route path="/login"       element={<Layout><Login /></Layout>} />
          <Route path="/register"    element={<Layout><Register /></Layout>} />
          <Route path="/courses"     element={<Layout><Courses /></Layout>} />
          <Route path="/courses/:id" element={<Layout><RequireNumericId><CourseDetail /></RequireNumericId></Layout>} />
          <Route path="/rounds"      element={<Layout><ProtectedRoute><Rounds /></ProtectedRoute></Layout>} />
          <Route path="/rounds/new"  element={<Layout><ProtectedRoute><RoundForm /></ProtectedRoute></Layout>} />
          <Route path="/rounds/:id"  element={<Layout><ProtectedRoute><RequireNumericId><RoundDetail /></RequireNumericId></ProtectedRoute></Layout>} />
          <Route path="/rounds/:id/edit" element={<Layout><ProtectedRoute><RequireNumericId><RoundForm /></RequireNumericId></ProtectedRoute></Layout>} />
          <Route path="/profile/:id" element={<Layout><ProtectedRoute><RequireNumericId><Profile /></RequireNumericId></ProtectedRoute></Layout>} />
          {/* VULN: admin route has no server-side role check — frontend-only guard */}
          <Route path="/admin"       element={<Layout><Admin /></Layout>} />
          <Route path="*"            element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
