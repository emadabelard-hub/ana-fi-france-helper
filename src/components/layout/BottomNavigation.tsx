import { useState, useEffect } from 'react';
import { Home, Newspaper, User, Shield, HeadphonesIcon, Receipt, Bot } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const navItems = [
  {
    path: '/news',
    icon: Newspaper,
    labelAr: 'الأخبار',
    labelFr: 'Actualités',
    color: 'text-red-500',
    activeBg: 'bg-red-500/15',
    dotColor: 'bg-red-500',
  },
  {
    path: '/',
    icon: Home,
    labelAr: 'الرئيسية',
    labelFr: 'Accueil',
    color: 'text-amber-400',
    activeBg: 'bg-amber-400/15',
    dotColor: 'bg-amber-400',
  },
  {
    path: '/expenses',
    icon: Receipt,
    labelAr: 'حساباتي',
    labelFr: 'Comptes',
    color: 'text-orange-400',
    activeBg: 'bg-orange-400/15',
    dotColor: 'bg-orange-400',
  },
  {
    path: '/ai-assistant',
    icon: Bot,
    labelAr: 'مساعد',
    labelFr: 'Assistant',
    color: 'text-violet-400',
    activeBg: 'bg-violet-400/15',
    dotColor: 'bg-violet-400',
  },
  {
    path: '/support',
    icon: HeadphonesIcon,
    labelAr: 'مساعدة',
    labelFr: 'Support',
    color: 'text-emerald-400',
    activeBg: 'bg-emerald-400/15',
    dotColor: 'bg-emerald-400',
  },
  {
    path: '/profile',
    icon: User,
    labelAr: 'حسابي',
    labelFr: 'Mon Compte',
    color: 'text-blue-400',
    activeBg: 'bg-blue-400/15',
    dotColor: 'bg-blue-400',
  },
];

const adminItem = {
  path: '/admin',
  icon: Shield,
  labelAr: 'لوحة التحكم',
  labelFr: 'Admin',
  color: 'text-emerald-400',
  activeBg: 'bg-emerald-400/15',
  dotColor: 'bg-emerald-400',
};

const BottomNavigation = () => {
  const { language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isPrimaryAdmin } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkAdmin = async () => {
      if (authLoading) return;

      if (!user || user.is_anonymous) {
        if (isMounted) setIsAdmin(false);
        return;
      }

      if (isPrimaryAdmin) {
        if (isMounted) setIsAdmin(true);
        return;
      }

      try {
        const { data } = await supabase.rpc('is_admin', { _user_id: user.id });
        if (isMounted) setIsAdmin(data === true);
      } catch {
        if (isMounted) setIsAdmin(false);
      }
    };

    checkAdmin();

    return () => {
      isMounted = false;
    };
  }, [authLoading, isPrimaryAdmin, user]);

  const items = isAdmin ? [...navItems, adminItem] : navItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border safe-area-pb">
      <div className="flex items-center justify-around py-1.5">
        {items.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path === '/' && location.pathname === '/home') ||
            (item.path === '/expenses' && location.pathname === '/accounts');
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center px-2 py-1 rounded-xl transition-all duration-200",
                "min-w-[56px] gap-0.5 relative",
                isActive ? item.activeBg : "hover:bg-muted/50"
              )}
            >
              <Icon
                className={cn(
                  "h-[22px] w-[22px] transition-all duration-200",
                  item.color,
                  isActive && "scale-110"
                )}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span
                className={cn(
                  "text-[10px] font-semibold transition-all",
                  language === 'ar' && "font-cairo",
                  isActive ? item.color : "text-muted-foreground"
                )}
              >
                {language === 'ar' ? item.labelAr : item.labelFr}
              </span>
              {isActive && (
                <span
                  className={cn(
                    "absolute -bottom-0.5 w-1 h-1 rounded-full",
                    item.dotColor
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavigation;
