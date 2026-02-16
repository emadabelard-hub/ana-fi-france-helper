import { useState, useEffect } from 'react';
import { Home, Newspaper, FileText, User, Shield } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const navItems = [
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
    path: '/news',
    icon: Newspaper,
    labelAr: 'أخبار',
    labelFr: 'Actualités',
    color: 'text-red-500',
    activeBg: 'bg-red-500/15',
    dotColor: 'bg-red-500',
  },
  {
    path: '/pro',
    icon: FileText,
    labelAr: 'أدوات',
    labelFr: 'Outils',
    color: 'text-orange-400',
    activeBg: 'bg-orange-400/15',
    dotColor: 'bg-orange-400',
  },
  {
    path: '/profile',
    icon: User,
    labelAr: 'حسابي',
    labelFr: 'Compte',
    color: 'text-blue-400',
    activeBg: 'bg-blue-400/15',
    dotColor: 'bg-blue-400',
  },
];

const BottomNavigation = () => {
  const { language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) { setIsAdmin(false); return; }
      try {
        const { data, error } = await supabase.rpc('is_admin', { _user_id: user.id });
        if (!error && data === true) setIsAdmin(true);
        else setIsAdmin(false);
      } catch { setIsAdmin(false); }
    };
    checkAdminStatus();
  }, [user]);

  const allItems = isAdmin
    ? [
        ...navItems,
         {
           path: '/admin',
           icon: Shield,
           labelAr: 'إدارة',
           labelFr: 'Admin',
           color: 'text-amber-500',
           activeBg: 'bg-amber-500/15',
           dotColor: 'bg-amber-500',
         },
      ]
    : navItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border safe-area-pb">
      <div className="flex items-center justify-around py-1.5">
        {allItems.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path === '/' && location.pathname === '/home') ||
            (item.path === '/pro' && location.pathname.startsWith('/pro'));
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
                  "text-[10px] font-cairo font-semibold transition-all",
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
