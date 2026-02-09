import { useState, useEffect } from 'react';
import { Home, Newspaper, MessageCircle, Wrench, User, Shield } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const BottomNavigation = () => {
  const { isRTL, t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  // Check admin status
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('is_admin', { _user_id: user.id });
        if (!error && data === true) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch {
        setIsAdmin(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  const baseNavItems = [
    {
      path: '/',
      icon: Home,
      labelKey: 'nav.dashboard',
    },
    {
      path: '/news',
      icon: Newspaper,
      labelKey: 'nav.news',
    },
    {
      path: '/assistant',
      icon: MessageCircle,
      labelKey: 'nav.assistant',
    },
    {
      path: '/pro',
      icon: Wrench,
      labelKey: 'nav.pro',
    },
    {
      path: '/profile',
      icon: User,
      labelKey: 'nav.profile',
    },
  ];

  // Add admin nav item only for admins
  const navItems = isAdmin
    ? [
        ...baseNavItems,
        {
          path: '/admin',
          icon: Shield,
          labelKey: 'nav.admin',
        },
      ]
    : baseNavItems;

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border",
        "safe-area-pb"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-around py-1.5",
          isRTL && "flex-row-reverse"
        )}
      >
        {navItems.map((item) => {
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
                "flex flex-col items-center justify-center px-3 py-1 rounded-lg transition-all duration-200",
                "min-w-[60px] gap-0.5",
                isActive
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
                item.path === '/admin' && "text-amber-600 dark:text-amber-400"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5",
                  isActive && "text-accent",
                  item.path === '/admin' && !isActive && "text-amber-500"
                )}
              />
              <span
                className={cn("text-[10px] font-medium", isRTL && "font-cairo")}
              >
                {t(item.labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavigation;
