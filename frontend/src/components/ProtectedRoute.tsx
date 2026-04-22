import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// VULN: only checks localStorage for JWT presence — no server validation, no expiry check
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('jwt');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
