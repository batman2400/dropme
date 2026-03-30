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

  // Profile exists but no phone number → incomplete onboarding
  // Only redirect if we're NOT already on /welcome
  if (profile && !profile.phone_number && location.pathname !== '/welcome') {
    return <Navigate to="/welcome" replace />;
  }

  // No profile at all (brand new user, trigger hasn't fired yet)
  // → send to /welcome to set up their profile
  if (!profile && location.pathname !== '/welcome') {
    return <Navigate to="/welcome" replace />;
  }

  return children;
}
