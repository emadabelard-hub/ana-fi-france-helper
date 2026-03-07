import { LayoutDashboard, Users, HardHat, Wallet } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { NavLink } from '@/components/NavLink';
import { cn } from '@/lib/utils';

const AppSidebar = () => {
  const { isRTL } = useLanguage();
  const location = useLocation();

  const items = [
    {
      to: '/',
      icon: LayoutDashboard,
      label: isRTL ? 'لوحة القيادة' : 'Tableau de bord',
      isActive: location.pathname === '/' || location.pathname === '/home',
    },
    {
      to: '/clients',
      icon: Users,
      label: isRTL ? 'العملاء' : 'Clients',
      isActive: location.pathname.startsWith('/clients'),
    },
    {
      to: '/chantiers',
      icon: HardHat,
      label: isRTL ? 'مشاريعي (الشانتيات)' : 'Chantiers',
      isActive: location.pathname.startsWith('/chantiers'),
    },
    {
      to: '/pro/documents',
      icon: Wallet,
      label: isRTL ? 'المحاسبة' : 'Comptabilité',
      isActive: location.pathname.startsWith('/pro/documents') || location.pathname.startsWith('/pro/archive') || location.pathname.startsWith('/expenses'),
    },
  ];

  return (
    <aside className="hidden md:flex fixed top-14 bottom-14 left-0 w-56 border-r border-border bg-card/70 backdrop-blur-sm z-30">
      <nav className="w-full p-3 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isRTL && 'flex-row-reverse text-right',
                item.isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className={cn('truncate', isRTL && 'font-cairo')}>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
};

export default AppSidebar;
