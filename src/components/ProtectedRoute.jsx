import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }) {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="bg-surface min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-primary text-5xl animate-spin">
            progress_activity
          </span>
          <p className="font-headline font-bold text-on-surface-variant text-sm uppercase tracking-widest">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  // Not logged in → go to Login
  if (!session) {
    return <Navigate to="/" replace />;
  }

  // Logged in but no profile yet, and trying to go somewhere other than /welcome
  // → force them to complete onboarding
  if (!profile && location.pathname !== '/welcome') {
    return <Navigate to="/welcome" replace />;
  }

  return children;
}
