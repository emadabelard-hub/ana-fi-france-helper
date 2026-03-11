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

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setIsLoading(false);
    });

    const initSession = async () => {
      setIsLoading(true);

      // If user explicitly signed out, don't auto-create anonymous session
      if (sessionStorage.getItem('explicit_signout') === 'true') {
        sessionStorage.removeItem('explicit_signout');
        setIsLoading(false);
        return;
      }

      const { data: { session: existing } } = await supabase.auth.getSession();
      if (existing) {
        setSession(existing);
        setUser(existing.user);
        setIsLoading(false);
        return;
      }

      // Development access: create a guest session silently (no login wall)
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        setIsLoading(false);
      }
      // onAuthStateChange will finalize state on success
    };

    initSession();

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signInAnonymously = async () => {
    const { error } = await supabase.auth.signInAnonymously();
    return { error };
  };

  const signOut = async () => {
    sessionStorage.setItem('explicit_signout', 'true');
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, isAnonymous, isAuthenticated, signUp, signIn, signInAnonymously, signOut }}>
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
