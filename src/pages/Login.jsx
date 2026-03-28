import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [isLogin, setIsLogin] = useState(false);
  const [role, setRole] = useState('passenger');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleType, setVehicleType] = useState('car');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const checkProfileAndRedirect = async () => {
      if (!authLoading && session) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', session.user.id)
          .single();

        if (data && !error) {
          navigate('/dashboard', { replace: true });
        } else {
          navigate('/welcome', { replace: true });
        }
      }
    };
    checkProfileAndRedirect();
  }, [session, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="bg-surface min-h-screen flex items-center justify-center">
        <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
      </div>
    );
  }

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/welcome` },
    });
    if (error) setError(error.message);
    setLoading(false);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setLoading(true);
    setError('');

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          phone_number: phone,
          vehicle_type: role === 'driver' ? vehicleType : null,
          vehicle_plate: role === 'driver' ? vehiclePlate : null,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data?.session) {
      navigate('/welcome');
    } else {
      setSuccessMessage('Verification email sent! Check your inbox and click the link to confirm.');
      setError('');
    }
    setLoading(false);
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setLoading(true);
    setError('');

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }
    navigate('/dashboard');
  };

  return (
    <div className="bg-surface font-body text-on-surface antialiased min-h-screen flex flex-col">
      {/* Minimal header */}
      <header className="w-full pt-safe pb-2 flex justify-between items-center px-5 sm:px-6 content-grid">
        <h1 className="font-headline font-extrabold tracking-tight text-xl text-on-surface">
          dropme<span className="text-primary">.</span>
        </h1>
      </header>

      <main className="content-grid px-5 sm:px-6 pt-4 pb-16 flex-1">
        {/* Hero */}
        <section className="mb-8 animate-fade-up">
          <h2 className="text-[1.65rem] sm:text-3xl font-extrabold font-headline tracking-tight text-on-surface mb-2 text-balance leading-[1.15]">
            {isLogin ? 'Welcome back.' : 'Join the collective.'}
          </h2>
          <p className="text-on-surface-variant text-sm sm:text-base max-w-md leading-relaxed">
            {isLogin
              ? 'Log in to continue your journey.'
              : 'The most premium way to share your ride and reduce your carbon footprint.'}
          </p>
        </section>

        {/* Success / Error */}
        {successMessage && (
          <div className="mb-5 p-3.5 bg-tertiary/6 text-tertiary border border-tertiary/12 rounded-xl text-sm font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-base">check_circle</span>
            {successMessage}
          </div>
        )}
        {error && (
          <div className="mb-5 p-3.5 bg-error/6 text-error border border-error/10 rounded-xl text-sm font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            {error}
          </div>
        )}

        {/* Google OAuth */}
        <div className="mb-6 animate-fade-up stagger-2">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-surface-container-lowest py-3.5 px-5 rounded-xl flex items-center justify-center gap-3 border border-outline-variant/10 shadow-sm hover:shadow-md active:scale-[0.99] transition-all group disabled:opacity-50"
          >
            <img
              alt="Google"
              className="w-4.5 h-4.5"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDAjU9bFlgmwwHkvz7EC_k4U7Zro4j-OSdQc8u7BL9lQqmehfB6qEs5L6bZXpX0IurcTVIPwC2ASWqpXr5ubsxf1LLFNw2EYWqyG0Oxd2HtqGtUzTRhFE9sBmxh1X2PtO3fnY-3ryIaMr40BNSsrbK-yDPurhVYt0tzVW4wEXy03zGtyYLDSl4Tv8Ar50b7CRp670Ak0g97_AAfE2_BNtnmlvG3PAjf6hDgi28RRrf-4goRywFuXVvUEmtgdKtEyPS6mCzTD-TElgQ"
            />
            <span className="font-semibold text-sm text-on-surface group-hover:text-primary transition-colors">
              Continue with Google
            </span>
          </button>
          <div className="flex items-center gap-4 my-6">
            <div className="h-px flex-1 bg-outline-variant/15"></div>
            <span className="text-on-surface-variant/50 text-[9px] font-bold tracking-widest uppercase">Or use email</span>
            <div className="h-px flex-1 bg-outline-variant/15"></div>
          </div>
        </div>

        {/* Form */}
        <form className="space-y-4 animate-fade-up stagger-3" onSubmit={isLogin ? (e) => { e.preventDefault(); handleSignIn(); } : handleSignUp}>
          <div className="space-y-3">
            <input
              className="w-full bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/12 text-sm text-on-surface placeholder:text-on-surface-variant/35"
              placeholder="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="relative">
              <input
                className="w-full bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/12 text-sm text-on-surface placeholder:text-on-surface-variant/35 pr-12"
                placeholder="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant/40 hover:text-primary transition-colors text-[18px]"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? 'visibility_off' : 'visibility'}
              </button>
            </div>
            {!isLogin && (
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                  <img
                    alt="WhatsApp"
                    className="w-4 h-4 opacity-70"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDjh09jLQWafrRhw4hHvqY5VEz5-XW1eaDtjJre2hbs2FyMhg53cwvDfMjzjbC4EXfwwmXVZIbWEUyHY5vh7rZ2FgRhJ0ukj4TP25jYL2NdCZXh1DXA5rsvIN9uIOF6hXfXSreuLGDLiLa6CMAIqCFHVnC_0xEHj8T7T_FXgMsdmnvmj3fAoXQfp1Ip0uMzgSucL6FPcy66Lva0Xy9UkL630T5A95pfViRmu1lgv-5rnGR9BdsytI0PscKGoo4IgzYvYZoQCo9ldOs"
                  />
                  <span className="text-[10px] font-bold text-on-surface-variant/35">WA</span>
                </div>
                <input
                  className="w-full bg-surface-container-lowest p-4 pl-16 rounded-xl border border-outline-variant/12 text-sm text-on-surface placeholder:text-on-surface-variant/35"
                  placeholder="WhatsApp Number"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Role Selection — signup */}
          {!isLogin && (
            <div className="bg-surface-container-low p-5 sm:p-6 rounded-2xl space-y-4 border border-outline-variant/6">
              <div>
                <h3 className="font-headline font-bold text-base text-on-surface">How will you use dropme?</h3>
                <p className="text-xs text-on-surface-variant/60 mt-0.5">Switch roles anytime after joining.</p>
              </div>
              <div className="flex p-1 bg-surface-container-highest/50 rounded-xl">
                <button
                  className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-sm transition-all duration-200 ${
                    role === 'passenger' ? 'role-toggle-active' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                  type="button"
                  onClick={() => setRole('passenger')}
                >
                  Passenger
                </button>
                <button
                  className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-sm transition-all duration-200 ${
                    role === 'driver' ? 'role-toggle-active' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                  type="button"
                  onClick={() => setRole('driver')}
                >
                  Driver
                </button>
              </div>

              {role === 'driver' && (
                <div className="space-y-3 pt-3 border-t border-outline-variant/8">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-bold uppercase tracking-wider text-on-surface-variant/50 px-0.5">Vehicle Type</label>
                      <div className="relative">
                        <select
                          className="w-full appearance-none bg-surface-container-lowest p-3 pr-8 rounded-xl border border-outline-variant/10 text-sm font-semibold text-on-surface"
                          value={vehicleType}
                          onChange={(e) => setVehicleType(e.target.value)}
                        >
                          <option value="car">Car</option>
                          <option value="tuk">Tuk-Tuk</option>
                          <option value="bike">Bike</option>
                        </select>
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant/40 pointer-events-none text-[18px]">
                          expand_more
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-bold uppercase tracking-wider text-on-surface-variant/50 px-0.5">Vehicle Plate</label>
                      <input
                        className="w-full bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/10 text-sm font-bold uppercase placeholder:normal-case placeholder:font-medium placeholder:text-on-surface-variant/30"
                        placeholder="ABC-1234"
                        type="text"
                        value={vehiclePlate}
                        onChange={(e) => setVehiclePlate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submit */}
          <div className="pt-2">
            <button
              className="w-full bg-gradient-to-r from-primary to-primary-container text-white py-4 rounded-full font-bold text-[15px] shadow-md shadow-primary/15 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                  {isLogin ? 'Logging in...' : 'Creating Account...'}
                </>
              ) : (
                isLogin ? 'Log In' : 'Start Journey'
              )}
            </button>
            <div className="text-center mt-6">
              <span className="text-sm text-on-surface-variant/60">
                {isLogin ? 'New to the collective?' : 'Already have an account?'}
              </span>
              <button
                type="button"
                onClick={() => { setIsLogin(!isLogin); setError(''); setSuccessMessage(''); }}
                className="inline-block ml-1 text-primary font-bold text-sm hover:underline py-1 px-0.5 transition-all"
              >
                {isLogin ? 'Create account' : 'Log in'}
              </button>
            </div>
          </div>
        </form>

        {/* Flourish */}
        <div className="mt-12 opacity-20 select-none pointer-events-none">
          <div className="relative h-32 w-full">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary rounded-full blur-[80px]"></div>
            <div className="absolute bottom-0 left-10 w-28 h-28 bg-tertiary rounded-full blur-[60px]"></div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="content-grid px-5 sm:px-6 pb-8 text-center">
        <p className="text-[9px] text-on-surface-variant/40 leading-relaxed max-w-xs mx-auto">
          By continuing, you agree to dropme.&apos;s{' '}
          <a className="underline hover:text-primary transition-colors" href="#">Terms of Service</a>{' '}
          and{' '}
          <a className="underline hover:text-primary transition-colors" href="#">Privacy Policy</a>.
        </p>
      </footer>
    </div>
  );
}
