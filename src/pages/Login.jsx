import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TopNavBar from '../components/TopNavBar';
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
  const [vehicleType, setVehicleType] = useState('Car');
  const [licensePlate, setLicensePlate] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // If already logged in, redirect to the correct page
  useEffect(() => {
    const checkProfileAndRedirect = async () => {
      if (!authLoading && session) {
        // Check if user has a profile in the users table
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('user_id', session.user.id)
          .single();

        if (data && !error) {
          // Profile exists -> Dashboard
          navigate('/dashboard', { replace: true });
        } else {
          // No profile -> Onboarding Success
          navigate('/welcome', { replace: true });
        }
      }
    };

    checkProfileAndRedirect();
  }, [session, authLoading, navigate]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="bg-surface min-h-screen flex items-center justify-center">
        <span className="material-symbols-outlined text-primary text-5xl animate-spin">
          progress_activity
        </span>
      </div>
    );
  }

  // --- Google OAuth ---
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/welcome`,
      },
    });
    if (error) setError(error.message);
    setLoading(false);
  };

  // --- Email Sign Up (Start Journey) ---
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
          user_type: role,
          vehicle_type: role === 'driver' ? vehicleType : null,
          license_plate: role === 'driver' ? licensePlate : null,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // If sign-up returns a session, user is immediately logged in
    if (data?.session) {
      navigate('/welcome');
    } else {
      // Email confirmation required
      setSuccessMessage('Verification email sent! Check your inbox and click the link to confirm your account.');
      setError('');
    }
    setLoading(false);
  };

  // --- Email Sign In (Log in) ---
  const handleSignIn = async () => {
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setLoading(true);
    setError('');

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    navigate('/dashboard');
  };

  return (
    <div className="bg-surface font-body text-on-surface antialiased min-h-screen">
      <TopNavBar showHelp />

      <main className="max-w-xl mx-auto px-6 pt-8 pb-24">
        {/* Welcome Hero Section */}
        <section className="mb-12">
          <h1 className="text-4xl font-extrabold font-headline tracking-tight text-on-surface mb-3 hanging-title">
            {isLogin ? 'Welcome back.' : 'Join the collective.'}
          </h1>
          <p className="text-on-surface-variant font-body text-lg max-w-md">
            {isLogin
              ? 'Log in to continue your journey with the collective.'
              : 'The most premium way to share your journey and reduce your carbon footprint.'}
          </p>
        </section>

        {/* Success Banner */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 text-green-700 border border-green-200 rounded-xl text-sm font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">check_circle</span>
            {successMessage}
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-error/10 text-error rounded-xl text-sm font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">error</span>
            {error}
          </div>
        )}

        {/* Social Auth */}
        <div className="mb-10">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-surface-container-lowest py-4 px-6 rounded-full flex items-center justify-center gap-4 border border-outline-variant/10 shadow-[0_8px_16px_rgba(11,28,48,0.04)] hover:shadow-[0_12px_24px_rgba(11,28,48,0.08)] active:scale-[0.99] transition-all duration-300 group disabled:opacity-50"
          >
            <img
              alt="Google"
              className="w-5 h-5"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDAjU9bFlgmwwHkvz7EC_k4U7Zro4j-OSdQc8u7BL9lQqmehfB6qEs5L6bZXpX0IurcTVIPwC2ASWqpXr5ubsxf1LLFNw2EYWqyG0Oxd2HtqGtUzTRhFE9sBmxh1X2PtO3fnY-3ryIaMr40BNSsrbK-yDPurhVYt0tzVW4wEXy03zGtyYLDSl4Tv8Ar50b7CRp670Ak0g97_AAfE2_BNtnmlvG3PAjf6hDgi28RRrf-4goRywFuXVvUEmtgdKtEyPS6mCzTD-TElgQ"
            />
            <span className="font-semibold text-on-surface group-hover:text-primary transition-colors">
              Continue with Google
            </span>
          </button>
          <div className="flex items-center gap-4 my-8">
            <div className="h-[1px] flex-1 bg-outline-variant opacity-20"></div>
            <span className="text-on-surface-variant text-[10px] font-bold tracking-widest uppercase">
              Or use email
            </span>
            <div className="h-[1px] flex-1 bg-outline-variant opacity-20"></div>
          </div>
        </div>

        {/* Main Form Stack */}
        <form className="space-y-8" onSubmit={isLogin ? (e) => { e.preventDefault(); handleSignIn(); } : handleSignUp}>
          {/* Account Credentials */}
          <div className="space-y-4">
            <div className="relative">
              <input
                className="w-full bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/20 text-on-surface placeholder:text-on-surface-variant/40"
                placeholder="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="relative">
              <input
                className="w-full bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/20 text-on-surface placeholder:text-on-surface-variant/40 pr-12"
                placeholder="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                className="absolute right-5 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant/50 hover:text-primary transition-colors"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? 'visibility_off' : 'visibility'}
              </button>
            </div>
            {!isLogin && (
              <div className="relative">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                  <img
                    alt="WhatsApp"
                    className="w-5 h-5 opacity-80"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDjh09jLQWafrRhw4hHvqY5VEz5-XW1eaDtjJre2hbs2FyMhg53cwvDfMjzjbC4EXfwwmXVZIbWEUyHY5vh7rZ2FgRhJ0ukj4TP25jYL2NdCZXh1DXA5rsvIN9uIOF6hXfXSreuLGDLiLa6CMAIqCFHVnC_0xEHj8T7T_FXgMsdmnvmj3fAoXQfp1Ip0uMzgSucL6FPcy66Lva0Xy9UkL630T5A95pfViRmu1lgv-5rnGR9BdsytI0PscKGoo4IgzYvYZoQCo9ldOs"
                  />
                  <span className="text-xs font-bold text-on-surface-variant/40">WA</span>
                </div>
                <input
                  className="w-full bg-surface-container-lowest p-5 pl-20 rounded-xl border border-outline-variant/20 text-on-surface placeholder:text-on-surface-variant/40"
                  placeholder="WhatsApp Number"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Role Selection Card — only in signup mode */}
          {!isLogin && (
            <div className="bg-surface-container-low p-8 rounded-[2rem] space-y-6 shadow-[0_12px_32px_rgba(37,99,235,0.03)] border border-outline-variant/10">
              <div className="space-y-1">
                <h3 className="font-headline font-bold text-xl text-on-surface">
                  How will you use dropme?
                </h3>
                <p className="text-sm text-on-surface-variant">Switch roles anytime after joining.</p>
              </div>
              <div className="flex p-1.5 bg-surface-container-highest/60 rounded-full">
                <button
                  className={`flex-1 py-3 px-6 rounded-full font-bold text-sm transition-all duration-300 ${
                    role === 'passenger'
                      ? 'role-toggle-active'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                  type="button"
                  onClick={() => setRole('passenger')}
                >
                  Passenger
                </button>
                <button
                  className={`flex-1 py-3 px-6 rounded-full font-bold text-sm transition-all duration-300 ${
                    role === 'driver'
                      ? 'role-toggle-active'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                  type="button"
                  onClick={() => setRole('driver')}
                >
                  Driver
                </button>
              </div>

              {/* Driver Section */}
              {role === 'driver' && (
                <div className="space-y-6 pt-4 border-t border-outline-variant/10">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 px-1">
                        Vehicle Type
                      </label>
                      <div className="relative">
                        <select
                          className="w-full appearance-none bg-surface-container-lowest p-4 pr-10 rounded-xl border border-outline-variant/10 text-sm font-semibold text-on-surface"
                          value={vehicleType}
                          onChange={(e) => setVehicleType(e.target.value)}
                        >
                          <option>Car</option>
                          <option>Three-Wheeler</option>
                          <option>Bike</option>
                          <option>Van</option>
                        </select>
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant pointer-events-none">
                          expand_more
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 px-1">
                        License Plate
                      </label>
                      <input
                        className="w-full bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10 text-sm font-bold uppercase placeholder:normal-case placeholder:font-medium placeholder:text-on-surface-variant/30"
                        placeholder="ABC-1234"
                        type="text"
                        value={licensePlate}
                        onChange={(e) => setLicensePlate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submit Action */}
          <div className="pt-4">
            <button
              className="w-full bg-gradient-to-br from-primary via-primary to-primary-container text-white py-5 px-8 rounded-full font-bold text-lg shadow-[0_12px_24px_rgba(0,74,198,0.3)] hover:shadow-[0_16px_32px_rgba(0,74,198,0.4)] hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                  {isLogin ? 'Logging in...' : 'Creating Account...'}
                </>
              ) : (
                isLogin ? 'Log In' : 'Start Journey'
              )}
            </button>
            <div className="text-center mt-8">
              <span className="text-sm text-on-surface-variant">
                {isLogin ? 'New to the collective?' : 'Already part of the collective?'}
              </span>
              <button
                type="button"
                onClick={() => { setIsLogin(!isLogin); setError(''); setSuccessMessage(''); }}
                className="inline-block ml-1 text-primary font-bold hover:underline py-2 px-1 focus:ring-2 focus:ring-primary/20 rounded-md transition-all"
              >
                {isLogin ? 'Create account' : 'Log in'}
              </button>
            </div>
          </div>
        </form>

        {/* Visual Flourish */}
        <div className="mt-16 opacity-30 select-none pointer-events-none">
          <div className="relative h-48 w-full">
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary rounded-full blur-[80px]"></div>
            <div className="absolute bottom-0 left-10 w-32 h-32 bg-tertiary rounded-full blur-[60px]"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-full h-px bg-gradient-to-r from-transparent via-outline-variant to-transparent"></div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Terms */}
      <footer className="max-w-xl mx-auto px-6 pb-12 text-center space-y-4">
        <p className="text-[10px] text-on-surface-variant/50 leading-relaxed max-w-xs mx-auto">
          By continuing, you agree to dropme.&apos;s{' '}
          <a className="underline hover:text-primary transition-colors" href="#">
            Terms of Service
          </a>{' '}
          and{' '}
          <a className="underline hover:text-primary transition-colors" href="#">
            Privacy Policy
          </a>
          . We use WhatsApp for ride confirmations.
        </p>
      </footer>
    </div>
  );
}
