import { Home, FileText, Briefcase, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const BottomNavigation = () => {
  const { isRTL } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/', icon: Home, label: 'الرئيسية' },
    { path: '/assistant', icon: FileText, label: 'استشارات' },
    { path: '/pro', icon: Briefcase, label: 'دراعك اليمين' },
    { path: '/profile', icon: User, label: 'حسابي' },
  ];

  return (
    <nav className={cn(
      "fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border",
      "safe-area-pb"
    )}>
      <div className={cn(
        "flex items-center justify-around py-2",
        isRTL && "flex-row-reverse"
      )}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center px-4 py-2 rounded-xl transition-all duration-200",
                "min-w-[70px] gap-1",
                isActive 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "text-accent")} />
              <span className={cn(
                "text-xs font-medium",
                isRTL && "font-cairo"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavigation;
