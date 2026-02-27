import { ReactNode } from 'react';
import Header from './Header';
import BottomNavigation from './BottomNavigation';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import useVisitTracker from '@/hooks/useVisitTracker';
import { ActivityTrackerProvider } from '@/contexts/ActivityTrackerContext';

interface MainLayoutProps {
  children: ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const { isRTL } = useLanguage();
  useVisitTracker();

  return (
    <ActivityTrackerProvider>
      <div className={cn(
        "min-h-screen bg-background",
        isRTL && "font-cairo"
      )}>
        <Header />
        <main className="pt-14 pb-14 px-2">
          {children}
        </main>
        <BottomNavigation />
      </div>
    </ActivityTrackerProvider>
  );
};

export default MainLayout;
