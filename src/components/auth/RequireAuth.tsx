import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AuthSplashScreen from './AuthSplashScreen';

// Routes accessible without an authenticated session (inside MainLayout).
// Token-based public routes (/sign/:token, /comptable, /invite/:token,
// /invoice/:token, /creer-ma-societe, /anafy-translate) are declared
// outside MainLayout and never reach this guard.
const PUBLIC_PATHS = new Set<string>([
  '/',
  '/home',
  '/index',
  '/login',
  '/reset-password',
  '/legal',
]);

const isPublicPath = (pathname: string) => {
  if (PUBLIC_PATHS.has(pathname)) return true;
  // Public document verification link (token embedded in :id).
  if (pathname.startsWith('/verify/')) return true;
  return false;
};

interface RequireAuthProps {
  children: ReactNode;
}

const RequireAuth = ({ children }: RequireAuthProps) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isPublicPath(location.pathname)) {
    return <>{children}</>;
  }

  if (isLoading) {
    return <AuthSplashScreen />;
  }

  if (!isAuthenticated) {
    const redirectTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ from: redirectTo }} />;
  }

  return <>{children}</>;
};

export default RequireAuth;
