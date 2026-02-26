import { ReactNode } from 'react';
import Header from './Header';
import BottomNavigation from './BottomNavigation';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import useVisitTracker from '@/hooks/useVisitTracker';
import useActivityTracker from '@/hooks/useActivityTracker';

interface MainLayoutProps {
  children: ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const { isRTL } = useLanguage();
  useVisitTracker();
  useActivityTracker();

  return (
    <div className={cn(
      "min-h-screen bg-background",
      isRTL && "font-cairo"
    )}>
      <Header />
      {/* pt-14 for header without tabs, pb-14 for compact bottom nav */}
      <main className="pt-14 pb-14 px-2">
        {children}
      </main>
      <BottomNavigation />
    </div>
  );
};

export default MainLayout;
