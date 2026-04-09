import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthResult {
  error: Error | null;
  needsEmailConfirmation?: boolean;
  isPrimaryAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAnonymous: boolean;
  isAuthenticated: boolean;
  isPrimaryAdmin: boolean;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signInAnonymously: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const PRIMARY_ADMIN_EMAIL = 'emadabelard@gmail.com';
const normalizeEmail = (email: string) => email.trim().toLowerCase();

const isRecoveryFlow = () => {
  const hash = window.location.hash || '';
  const search = window.location.search || '';

  return (
    hash.includes('type=recovery') ||
    search.includes('type=recovery') ||
    (hash.includes('access_token=') && hash.includes('refresh_token='))
  );
};

const shouldSkipAnonymousBoot = () => {
  const pathname = window.location.pathname;

  return pathname === '/login' || pathname === '/reset-password' || isRecoveryFlow();
};

const clearAnonymousSessionIfNeeded = async () => {
  const { data: { session: currentSession } } = await supabase.auth.getSession();

  if (currentSession?.user?.is_anonymous) {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      console.warn('Anonymous session cleanup failed:', error.message);
    }
  }
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAnonymous = user?.is_anonymous === true;
  const isAuthenticated = !!user && !isAnonymous;
  const isPrimaryAdmin = !!user?.email && normalizeEmail(user.email) === PRIMARY_ADMIN_EMAIL;

  useEffect(() => {
    let isSigningOut = false;

    // CRITICAL: Set up auth listener BEFORE checking session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // Block any state update during explicit sign-out
      if (isSigningOut || sessionStorage.getItem('explicit_signout') === 'true') {
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setIsLoading(false);
        }
        return;
      }
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setIsLoading(false);
    });

    const initSession = async () => {
      setIsLoading(true);

      // Safety timeout — never stay on splash screen forever
      const safetyTimer = setTimeout(() => {
        setIsLoading(false);
      }, 5000);

      try {
        // If user explicitly signed out, don't auto-create anonymous session
        if (sessionStorage.getItem('explicit_signout') === 'true') {
          sessionStorage.removeItem('explicit_signout');
          setUser(null);
          setSession(null);
          setIsLoading(false);
          clearTimeout(safetyTimer);
          return;
        }

        const { data: { session: existing } } = await supabase.auth.getSession();
        if (existing) {
          setSession(existing);
          setUser(existing.user);
          setIsLoading(false);
          clearTimeout(safetyTimer);
          return;
        }

        if (shouldSkipAnonymousBoot()) {
          setUser(null);
          setSession(null);
          setIsLoading(false);
          clearTimeout(safetyTimer);
          return;
        }

        // No session found — create anonymous guest session for public access
        const { error } = await supabase.auth.signInAnonymously();
        if (error) {
          console.warn('Anonymous sign-in failed:', error.message);
          setIsLoading(false);
          clearTimeout(safetyTimer);
        }
        // onAuthStateChange will finalize state on success
      } catch (err) {
        console.warn('Auth init failed:', err);
        setIsLoading(false);
        clearTimeout(safetyTimer);
      }
    };

    // Expose signing out flag to signOut function
    (window as any).__setSigningOut = (val: boolean) => { isSigningOut = val; };

    initSession();

    return () => {
      subscription.unsubscribe();
      delete (window as any).__setSigningOut;
    };
  }, []);

  const signUp = async (email: string, password: string): Promise<AuthResult> => {
    const normalizedEmail = normalizeEmail(email);
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    return {
      error: error ?? null,
      needsEmailConfirmation: !error && !data.session,
      isPrimaryAdmin: normalizedEmail === PRIMARY_ADMIN_EMAIL,
    };
  };

  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    const normalizedEmail = normalizeEmail(email);

    await clearAnonymousSessionIfNeeded();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    return {
      error: error ?? null,
      isPrimaryAdmin: normalizedEmail === PRIMARY_ADMIN_EMAIL,
    };
  };

  const signInAnonymously = async () => {
    const { error } = await supabase.auth.signInAnonymously();
    return { error: error ?? null };
  };

  const signOut = async () => {
    // 1. Block auth listener from recreating sessions
    sessionStorage.setItem('explicit_signout', 'true');
    (window as any).__setSigningOut?.(true);

    // 2. Immediately clear React state so UI updates
    setUser(null);
    setSession(null);

    // 3. Sign out from Supabase (clears server session)
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.warn('signOut error (ignored):', e);
    }

    // 4. Wipe all local persistence
    localStorage.clear();
    sessionStorage.setItem('explicit_signout', 'true'); // Re-set after clear

    // 5. Hard redirect — guarantees clean page state
    window.location.replace('/login');
  };

  return (
    <AuthContext.Provider value={{ 
      user, session, isLoading, isAnonymous, isAuthenticated, isPrimaryAdmin,
      signUp, signIn, signInAnonymously, signOut 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
