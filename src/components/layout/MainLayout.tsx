import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header';
import BottomNavigation from './BottomNavigation';
import AppSidebar from './AppSidebar';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import useVisitTracker from '@/hooks/useVisitTracker';
import { ActivityTrackerProvider } from '@/contexts/ActivityTrackerContext';

interface MainLayoutProps {
  children: ReactNode;
}

const AUTH_ROUTES = new Set(['/login', '/reset-password']);

const MainLayout = ({ children }: MainLayoutProps) => {
  const { isRTL } = useLanguage();
  const location = useLocation();
  const isAuthRoute = AUTH_ROUTES.has(location.pathname);

  useVisitTracker();

  return (
    <ActivityTrackerProvider>
      <div className={cn('min-h-screen bg-background', isRTL && 'font-cairo')}>
        {!isAuthRoute && <Header />}
        {!isAuthRoute && <AppSidebar />}
        <main
          className={cn(
            isAuthRoute ? 'min-h-screen px-0' : 'pt-14 pb-14 px-2 md:pl-[15rem]'
          )}
        >
          {children}
        </main>
        {!isAuthRoute && <BottomNavigation />}
      </div>
    </ActivityTrackerProvider>
  );
};

export default MainLayout;
