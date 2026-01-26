import { ReactNode } from 'react';
import Header from './Header';
import BottomNavigation from './BottomNavigation';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface MainLayoutProps {
  children: ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const { isRTL } = useLanguage();

  return (
    <div className={cn(
      "min-h-screen bg-background",
      isRTL && "font-cairo"
    )}>
      <Header />
      <main className="pt-16 pb-20 px-4">
        {children}
      </main>
      <BottomNavigation />
    </div>
  );
};

export default MainLayout;
