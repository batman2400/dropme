import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNavBar from '../components/TopNavBar';
import BottomNavBar from '../components/BottomNavBar';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

export default function OnboardingSuccess() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  const handleGoToDashboard = async () => {
    setLoading(true);

    if (user) {
      // Extract metadata from sign-up (stored in user_metadata)
      const meta = user.user_metadata || {};
      const { error } = await supabase.from('users').upsert(
        {
          user_id: user.id,
          full_name: meta.full_name || meta.name || user.email?.split('@')[0] || 'New User',
          phone_number: meta.phone_number || '',
          user_type: meta.user_type || 'passenger',
          vehicle_type: meta.vehicle_type || null,
          license_plate: meta.license_plate || null,
        },
        { onConflict: 'user_id' }
      );

      if (error) {
        console.error('Profile creation error:', error.message);
      } else {
        // Refresh the profile in AuthContext so ProtectedRoute allows navigation
        await refreshProfile();
      }
    }

    navigate('/dashboard');
  };

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen flex flex-col overflow-x-hidden">
      <TopNavBar showNotification />

      {/* Main Canvas */}
      <main className="flex-grow flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
        {/* Abstract Background Shapes */}
        <div className="absolute top-20 -left-20 w-64 h-64 bg-primary-container/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-40 -right-20 w-80 h-80 bg-tertiary-container/10 rounded-full blur-3xl"></div>

        {/* Success Content Container */}
        <div className="max-w-md w-full flex flex-col items-center text-center space-y-10 relative z-10">
          {/* Central Visual */}
          <div className="relative group">
            <div className="absolute inset-0 bg-primary/10 rounded-full scale-150 blur-2xl group-hover:bg-primary/20 transition-all"></div>
            <div className="w-40 h-40 bg-white rounded-full flex items-center justify-center shadow-[0_12px_24px_rgba(11,28,48,0.06)] relative overflow-hidden border border-white/40">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent"></div>
              <span
                className="material-symbols-outlined text-8xl text-primary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                task_alt
              </span>
            </div>
            {/* Mini Floating Badges */}
            <div
              className="absolute -top-2 -right-4 glass-card p-3 rounded-2xl shadow-sm floating-element"
              style={{ animationDelay: '1s' }}
            >
              <span className="material-symbols-outlined text-tertiary-container">directions_car</span>
            </div>
            <div
              className="absolute bottom-4 -left-6 glass-card p-2 rounded-xl shadow-sm floating-element"
              style={{ animationDelay: '2s' }}
            >
              <span className="material-symbols-outlined text-primary">group</span>
            </div>
          </div>

          {/* Typography Header */}
          <div className="space-y-4">
            <h2 className="text-4xl font-extrabold font-headline text-on-surface tracking-tight leading-tight">
              Welcome to the Collective!
            </h2>
            <p className="text-on-surface-variant text-lg leading-relaxed max-w-[320px] mx-auto">
              Your profile is ready. Start connecting with fellow travelers today.
            </p>
          </div>

          {/* Stats Teaser Card */}
          <div className="w-full glass-card rounded-3xl p-6 flex items-center justify-between border border-white/50">
            <div className="text-left">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-1">
                First Ride Goal
              </p>
              <p className="font-headline font-bold text-lg">Share a ride this week</p>
              <p className="text-xs text-on-surface-variant">Save money on your daily commute</p>
            </div>
            <div className="w-12 h-12 bg-primary-container rounded-full flex items-center justify-center">
              <span
                className="material-symbols-outlined text-white"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                trending_up
              </span>
            </div>
          </div>

          {/* Primary Action */}
          <div className="w-full pt-4">
            <button
              onClick={handleGoToDashboard}
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary to-primary-container text-white font-headline font-bold py-5 rounded-full shadow-[0_12px_24px_rgba(0,74,198,0.2)] hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                  Setting up...
                </>
              ) : (
                <>
                  Go to Dashboard
                  <span className="material-symbols-outlined text-xl">arrow_forward</span>
                </>
              )}
            </button>
          </div>

          {/* Secondary Text */}
          <div className="flex gap-2 items-center justify-center opacity-40">
            <div className="h-px w-8 bg-outline"></div>
            <span className="text-[10px] font-bold uppercase tracking-widest">ready for departure</span>
            <div className="h-px w-8 bg-outline"></div>
          </div>
        </div>
      </main>

      <BottomNavBar activeTab="home" />

      {/* Subtle Grain Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] mix-blend-multiply">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <filter id="noiseFilter">
            <feTurbulence baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" type="fractalNoise" />
          </filter>
          <rect filter="url(#noiseFilter)" height="100%" width="100%" />
        </svg>
      </div>
    </div>
  );
}
