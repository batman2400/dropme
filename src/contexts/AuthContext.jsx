import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch the user's profile from the public `profiles` table
  // In our new schema, profiles.id = auth.users.id (same UUID)
  const fetchProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Profile fetch error:', error.message);
        setProfile(null);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.warn('Profile fetch exception:', err);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    // Step 1: Listen for auth state changes FIRST (this is the recommended pattern)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);

        // Use setTimeout to avoid Supabase lock contention
        // The lock from getSession/onAuthStateChange needs to be released first
        if (newSession?.user) {
          setTimeout(() => {
            fetchProfile(newSession.user.id).finally(() => setLoading(false));
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // Step 2: Get initial session (triggers onAuthStateChange above)
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      // If onAuthStateChange hasn't fired yet, handle here as fallback
      if (initialSession) {
        setSession(initialSession);
        fetchProfile(initialSession.user.id).finally(() => setLoading(false));
      } else {
        setSession(null);
        setProfile(null);
        setLoading(false);
      }
    }).catch(() => {
      // If getSession fails for any reason, don't block the app
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // Allow child components to force-refresh the profile (e.g. after edit)
  const refreshProfile = useCallback(async () => {
    if (session?.user) {
      await fetchProfile(session.user.id);
    }
  }, [session, fetchProfile]);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
