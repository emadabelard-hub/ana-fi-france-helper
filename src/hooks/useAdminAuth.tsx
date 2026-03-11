import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface AdminAuthContextType {
  isAdmin: boolean;
  isLoading: boolean;
  checkAdminStatus: () => Promise<boolean>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);
const PRIMARY_ADMIN_EMAIL = 'emadabelard@gmail.com';

export const AdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkAdminStatus = async (): Promise<boolean> => {
    if (!user || user.is_anonymous) {
      setIsAdmin(false);
      setIsLoading(false);
      return false;
    }

    if (user.email?.toLowerCase() === PRIMARY_ADMIN_EMAIL) {
      setIsAdmin(true);
      setIsLoading(false);
      return true;
    }

    try {
      // Check if user exists in admin_users table using the is_admin function
      const { data, error } = await supabase.rpc('is_admin', { _user_id: user.id });
      
      if (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
        setIsLoading(false);
        return false;
      }

      setIsAdmin(data === true);
      setIsLoading(false);
      return data === true;
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
      setIsLoading(false);
      return false;
    }
  };

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  return (
    <AdminAuthContext.Provider value={{ isAdmin, isLoading, checkAdminStatus }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};
