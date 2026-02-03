import { MessageCircle, Wrench, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const BottomNavigation = () => {
  const { isRTL } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { 
      path: '/assistant', 
      icon: MessageCircle, 
      labelAr: 'استشارات',
      labelFr: 'Consultations'
    },
    { 
      path: '/pro', 
      icon: Wrench, 
      labelAr: 'دراعك اليمين',
      labelFr: 'Outils Pro'
    },
    { 
      path: '/profile', 
      icon: User, 
      labelAr: 'حسابي',
      labelFr: 'Profil'
    },
  ];

  return (
    <nav className={cn(
      "fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border",
      "safe-area-pb"
    )}>
      <div className={cn(
        "flex items-center justify-around py-1.5",
        isRTL && "flex-row-reverse"
      )}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path === '/assistant' && location.pathname === '/') ||
            (item.path === '/pro' && location.pathname.startsWith('/pro'));
          const Icon = item.icon;
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center px-4 py-1 rounded-lg transition-all duration-200",
                "min-w-[70px] gap-0.5",
                isActive 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "text-accent")} />
              <span className={cn(
                "text-[10px] font-medium",
                isRTL && "font-cairo"
              )}>
                {isRTL ? item.labelAr : item.labelFr}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavigation;
