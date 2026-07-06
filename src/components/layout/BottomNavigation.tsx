import { useState, useEffect } from 'react';
import { Home, BarChart3, User, Shield, HeadphonesIcon, ClipboardList } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useTeamRole } from '@/hooks/useTeamRole';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const navItems = [
  {
    path: '/accounting/supplier-invoices',
    icon: BarChart3,
    labelAr: 'المحاسبة',
    labelFr: 'Comptabilité',
    color: 'text-indigo-400',
    activeBg: 'bg-indigo-400/15',
    dotColor: 'bg-indigo-400',
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
    path: '/support',
    icon: HeadphonesIcon,
    labelAr: 'تواصل معنا',
    labelFr: 'Contact',
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

  const { isTeamMemberOnly } = useTeamRole();

  const teamItems = [
    {
      path: '/chantier-report',
      icon: ClipboardList,
      labelAr: 'تقرير الشانتي',
      labelFr: 'Rapport',
      color: 'text-amber-400',
      activeBg: 'bg-amber-400/15',
      dotColor: 'bg-amber-400',
    },
    {
      path: '/support',
      icon: HeadphonesIcon,
      labelAr: 'تواصل معنا',
      labelFr: 'Contact',
      color: 'text-emerald-400',
      activeBg: 'bg-emerald-400/15',
      dotColor: 'bg-emerald-400',
    },
  ];

  const items = isTeamMemberOnly
    ? teamItems
    : (isAdmin ? [...navItems, adminItem] : navItems);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border safe-area-pb">
      <div className="flex items-center justify-between gap-0.5 py-1.5 px-1 overflow-x-auto no-scrollbar">
        {items.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path === '/' && location.pathname === '/home');
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center px-1.5 py-1 rounded-xl transition-all duration-200 shrink-0",
                "min-w-[48px] gap-0.5 relative",
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
