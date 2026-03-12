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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAnonymous = user?.is_anonymous === true;
  const isAuthenticated = !!user && !isAnonymous;
  const isPrimaryAdmin = !!user?.email && normalizeEmail(user.email) === PRIMARY_ADMIN_EMAIL;

  useEffect(() => {
    // CRITICAL: Set up auth listener BEFORE checking session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
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

    initSession();

    return () => subscription.unsubscribe();
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
    // Set flag BEFORE sign out to prevent anonymous session re-creation
    sessionStorage.setItem('explicit_signout', 'true');
    
    // Sign out from Supabase
    await supabase.auth.signOut();
    
    // Clear all local storage to ensure clean state
    localStorage.clear();
    sessionStorage.setItem('explicit_signout', 'true'); // Re-set after clear
    
    // Reset state
    setUser(null);
    setSession(null);
    
    // Hard redirect to login
    window.location.href = '/login';
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
