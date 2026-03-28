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
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      // Pre-fill phone from metadata if available
      if (user?.user_metadata?.phone_number) {
        setPhone(user.user_metadata.phone_number);
      }
    };
    getUser();
  }, []);

  const handleGoToDashboard = async () => {
    // Validate WhatsApp number
    if (!phone.trim()) {
      setPhoneError('WhatsApp number is required to connect with riders.');
      return;
    }
    setPhoneError('');
    setLoading(true);

    if (user) {
      // Profile was auto-created by the signup trigger.
      // We just need to update it with the phone number.
      const { error } = await supabase
        .from('profiles')
        .update({ phone_number: phone.trim() })
        .eq('id', user.id);

      if (error) {
        console.error('Profile creation error:', error.message);
      } else {
        await refreshProfile();
      }
    }

    navigate('/dashboard');
  };

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen flex flex-col overflow-x-hidden">
      <TopNavBar showNotification />

      <main className="flex-grow flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
        {/* Background */}
        <div className="absolute top-20 -left-20 w-64 h-64 bg-primary-container/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-40 -right-20 w-80 h-80 bg-tertiary-container/10 rounded-full blur-3xl"></div>

        <div className="max-w-md w-full flex flex-col items-center text-center space-y-8 relative z-10 animate-fade-up">
          {/* Icon */}
          <div className="relative group">
            <div className="absolute inset-0 bg-primary/10 rounded-full scale-150 blur-2xl"></div>
            <div className="w-32 h-32 sm:w-40 sm:h-40 bg-white rounded-full flex items-center justify-center shadow-lg relative overflow-hidden border border-white/40">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent"></div>
              <span className="material-symbols-outlined text-7xl sm:text-8xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                task_alt
              </span>
            </div>
            <div className="absolute -top-2 -right-4 glass-card p-3 rounded-2xl shadow-sm floating-element" style={{ animationDelay: '1s' }}>
              <span className="material-symbols-outlined text-tertiary-container">directions_car</span>
            </div>
            <div className="absolute bottom-4 -left-6 glass-card p-2 rounded-xl shadow-sm floating-element" style={{ animationDelay: '2s' }}>
              <span className="material-symbols-outlined text-primary">group</span>
            </div>
          </div>

          {/* Text */}
          <div className="space-y-3">
            <h2 className="text-3xl sm:text-4xl font-extrabold font-headline text-on-surface tracking-tight leading-tight text-balance">
              Welcome to the Collective!
            </h2>
            <p className="text-on-surface-variant text-base sm:text-lg leading-relaxed max-w-[320px] mx-auto">
              Add your WhatsApp number so riders and drivers can reach you.
            </p>
          </div>

          {/* WhatsApp Number Input */}
          <div className="w-full space-y-2 animate-fade-up stagger-2">
            <label className="block text-[9px] font-bold uppercase tracking-[0.15em] text-on-surface-variant/60 text-left">
              WhatsApp Number *
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                <svg className="w-5 h-5 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
              </div>
              <input
                className="w-full bg-surface-container-lowest pl-12 pr-4 py-4 rounded-xl border border-outline-variant/20 text-on-surface placeholder:text-on-surface-variant/40 font-medium"
                placeholder="+94 7X XXX XXXX"
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setPhoneError(''); }}
              />
            </div>
            {phoneError && (
              <p className="text-error text-xs font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">error</span>
                {phoneError}
              </p>
            )}
          </div>

          {/* CTA */}
          <div className="w-full pt-2 animate-fade-up stagger-3">
            <button
              onClick={handleGoToDashboard}
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary to-primary-container text-white font-headline font-bold py-4 sm:py-5 rounded-full shadow-lg shadow-primary/20 btn-press flex items-center justify-center gap-3 disabled:opacity-50"
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

          <div className="flex gap-2 items-center justify-center opacity-40">
            <div className="h-px w-8 bg-outline"></div>
            <span className="text-[10px] font-bold uppercase tracking-widest">ready for departure</span>
            <div className="h-px w-8 bg-outline"></div>
          </div>
        </div>
      </main>

      <BottomNavBar activeTab="home" />
    </div>
  );
}
