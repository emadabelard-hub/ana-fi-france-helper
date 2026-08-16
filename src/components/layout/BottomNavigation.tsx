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
    labelKey: 'bottomNav.accounting',
    color: 'text-indigo-400',
    activeBg: 'bg-indigo-400/15',
    dotColor: 'bg-indigo-400',
  },
  {
    path: '/',
    icon: Home,
    labelKey: 'bottomNav.home',
    color: 'text-amber-400',
    activeBg: 'bg-amber-400/15',
    dotColor: 'bg-amber-400',
  },
  {
    path: '/support',
    icon: HeadphonesIcon,
    labelKey: 'bottomNav.contact',
    color: 'text-emerald-400',
    activeBg: 'bg-emerald-400/15',
    dotColor: 'bg-emerald-400',
  },
  {
    path: '/profile',
    icon: User,
    labelKey: 'bottomNav.account',
    color: 'text-blue-400',
    activeBg: 'bg-blue-400/15',
    dotColor: 'bg-blue-400',
  },
];

const adminItem = {
  path: '/admin',
  icon: Shield,
  labelKey: 'bottomNav.admin',
  color: 'text-emerald-400',
  activeBg: 'bg-emerald-400/15',
  dotColor: 'bg-emerald-400',
};

const ADMIN_RETRY_DELAYS = [1000, 2000, 4000];

const isAbortLikeAdminError = (err: unknown) => {
  const value = err instanceof Error ? err.message : String((err as any)?.message || (err as any)?.error_description || err || '');
  const msg = value.toLowerCase();
  return msg.includes('abort') || msg.includes('signal is aborted') || msg.includes('signal');
};

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const BottomNavigation = () => {
  const { language, t } = useLanguage();
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
      for (let i = 0; i <= ADMIN_RETRY_DELAYS.length; i++) {
        try {
          const { data, error } = await supabase.rpc('is_admin', { _user_id: user.id });
          if (!isMounted) return;
          if (error) {
            if (isAbortLikeAdminError(error) && i < ADMIN_RETRY_DELAYS.length) {
              console.warn(`[is_admin] AbortError, retry ${i + 1}/${ADMIN_RETRY_DELAYS.length}`);
              await wait(ADMIN_RETRY_DELAYS[i]);
              continue;
            }
            console.warn('is_admin check failed, keeping secure previous state', error);
          } else {
            setIsAdmin(data === true);
          }
          break;
        } catch (e) {
          if (!isMounted) return;
          if (isAbortLikeAdminError(e) && i < ADMIN_RETRY_DELAYS.length) {
            console.warn(`[is_admin] AbortError thrown, retry ${i + 1}/${ADMIN_RETRY_DELAYS.length}`);
            await wait(ADMIN_RETRY_DELAYS[i]);
            continue;
          }
          console.warn('is_admin check threw, keeping secure previous state', e);
          break;
        }
      }
      if (isMounted) setAdminCheckLoading(false);
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
      labelKey: 'bottomNav.report',
      color: 'text-amber-400',
      activeBg: 'bg-amber-400/15',
      dotColor: 'bg-amber-400',
    },
    {
      path: '/support',
      icon: HeadphonesIcon,
      labelKey: 'bottomNav.contactShort',
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
      <div className="flex items-center justify-around gap-0.5 py-1.5 px-1">
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
                "flex flex-col items-center justify-center px-0.5 py-1 rounded-xl transition-all duration-200",
                "flex-1 basis-0 min-w-0 gap-0.5 relative",
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
                  "text-[10px] font-semibold transition-all w-full text-center truncate",
                  language === 'ar' && "font-cairo",
                  isActive ? item.color : "text-muted-foreground"
                )}
              >
                {t(item.labelKey)}
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
