import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import { AUTH_OPERATION_TIMEOUT_MS, getRecoveryContext, isAnonymousSession, normalizeEmail, PRIMARY_ADMIN_EMAIL, withAuthTimeout } from '@/lib/auth';

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

const shouldSkipAnonymousBoot = () => true;

const clearAnonymousSessionIfNeeded = async () => {
  // Intentionally a no-op.
  // On some mobile Chrome sessions, chaining getSession/signOut before auth
  // actions can deadlock the auth client and leave submit buttons stuck.
  // Let Supabase replace the anonymous session directly during sign-in/sign-up.
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
    let hasInitialized = false;

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

      if (hasInitialized || event !== 'INITIAL_SESSION') {
        setIsLoading(false);
      }
    });

    const initSession = async () => {
      setIsLoading(true);

      const skipAnonymousBoot = shouldSkipAnonymousBoot();

      // Safety timeout — never stay on splash screen forever
      const safetyTimer = setTimeout(() => {
        hasInitialized = true;
        setIsLoading(false);
      }, skipAnonymousBoot ? AUTH_OPERATION_TIMEOUT_MS : 5000);

      const finishLoading = () => {
        hasInitialized = true;
        setIsLoading(false);
        clearTimeout(safetyTimer);
      };

      try {
        // If user explicitly signed out, don't restore
        if (sessionStorage.getItem('explicit_signout') === 'true') {
          sessionStorage.removeItem('explicit_signout');
          setUser(null);
          setSession(null);
          finishLoading();
          return;
        }

        const { data: { session: existing } } = await supabase.auth.getSession();

        if (existing) {
          setSession(existing);
          setUser(existing.user);
          finishLoading();
          return;
        }

        // No session — just finish loading, do NOT create anonymous session
        setUser(null);
        setSession(null);
        finishLoading();
      } catch (err) {
        console.warn('Auth init failed:', err);
        finishLoading();
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

    await clearAnonymousSessionIfNeeded();

    const { data, error } = await withAuthTimeout(
      supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: window.location.origin,
        },
      }),
      'La création du compte prend trop de temps. Réessayez.'
    );

    if (!error && data.session) {
      setSession(data.session);
      setUser(data.user);
      setIsLoading(false);
    }

    return {
      error: error ?? null,
      needsEmailConfirmation: !error && !data.session,
      isPrimaryAdmin: normalizedEmail === PRIMARY_ADMIN_EMAIL,
    };
  };

  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    const normalizedEmail = normalizeEmail(email);

    await clearAnonymousSessionIfNeeded();

    const { data, error } = await withAuthTimeout(
      supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      }),
      'La connexion prend trop de temps. Réessayez.'
    );

    if (!error && data.session) {
      setSession(data.session);
      setUser(data.user);
      setIsLoading(false);
    }

    return {
      error: error ?? null,
      isPrimaryAdmin: normalizedEmail === PRIMARY_ADMIN_EMAIL,
    };
  };

  const signInAnonymously = async () => {
    const { data, error } = await supabase.auth.signInAnonymously();

    if (!error && data.session) {
      setSession(data.session);
      setUser(data.user);
      setIsLoading(false);
    }

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

    // 4. Hard redirect — guarantees clean page state
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
