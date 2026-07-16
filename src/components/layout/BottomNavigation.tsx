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
    labelFr: 'Contactez-nous',
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
  const { user, isLoading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckLoading, setAdminCheckLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // While auth is still hydrating, do NOT conclude the user is not admin.
    if (authLoading) {
      setAdminCheckLoading(true);
      return;
    }

    // Real signed-out / anonymous state: reset cleanly.
    if (!user || user.is_anonymous) {
      setIsAdmin(false);
      setAdminCheckLoading(false);
      return;
    }

    // Single source of authority: server-side RPC.
    setAdminCheckLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase.rpc('is_admin', { _user_id: user.id });
        if (!isMounted) return;
        if (error) {
          // Transient failure: keep previous truthy value, do NOT lock to false.
          console.warn('is_admin check failed (transient), keeping previous state', error);
        } else {
          setIsAdmin(data === true);
        }
      } catch (e) {
        // Do not memorize false on network errors.
        console.warn('is_admin check threw, keeping previous state', e);
      } finally {
        if (isMounted) setAdminCheckLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [authLoading, user?.id, user?.is_anonymous]);

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
            item.path === '/accounting/supplier-invoices'
              ? location.pathname.startsWith('/accounting')
              : location.pathname === item.path ||
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
