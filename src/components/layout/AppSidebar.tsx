import { useState } from 'react';
import { LayoutDashboard, Users, HardHat, Wallet, ChevronDown, FileText, Receipt, FileDown } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTeamRole } from '@/hooks/useTeamRole';
import { NavLink } from '@/components/NavLink';
import { cn } from '@/lib/utils';

const AppSidebar = () => {
  const { isRTL } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const { isTeamMemberOnly } = useTeamRole();

  const accountingPaths = ['/pro/documents', '/pro/archive', '/expenses', '/accounting'];
  const inAccounting = accountingPaths.some((p) => location.pathname.startsWith(p));
  const [accountingOpen, setAccountingOpen] = useState(inAccounting);

  if (isTeamMemberOnly) return null;

  const simpleItems = [
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
  ];

  const accountingChildren = [
    {
      to: '/accounting/supplier-invoices',
      icon: FileText,
      label: isRTL ? 'فواتير المورّدين' : 'Factures Fournisseurs',
      isActive: location.pathname.startsWith('/accounting/supplier-invoices'),
    },
    {
      to: '/expenses',
      icon: Receipt,
      label: isRTL ? 'المصاريف والإيصالات' : 'Dépenses & Reçus',
      isActive: location.pathname.startsWith('/expenses'),
    },
    {
      to: '/pro/archive',
      icon: FileDown,
      label: isRTL ? 'تصدير FEC' : 'FEC Export',
      isActive: location.pathname.startsWith('/pro/archive') || location.pathname.startsWith('/pro/documents'),
    },
  ];

  return (
    <aside className="hidden md:flex fixed top-14 bottom-14 left-0 w-56 border-r border-border bg-card/70 backdrop-blur-sm z-30">
      <nav className="w-full p-3 space-y-1 overflow-y-auto">
        {simpleItems.map((item) => {
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

        <button
          type="button"
          onClick={() => setAccountingOpen((v) => !v)}
          className={cn(
            'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isRTL && 'flex-row-reverse text-right',
            inAccounting ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <Wallet className="h-4 w-4 shrink-0" />
          <span className={cn('truncate flex-1', isRTL && 'font-cairo')}>
            {isRTL ? 'المحاسبة' : 'Comptabilité'}
          </span>
          <ChevronDown className={cn('h-4 w-4 transition-transform', accountingOpen && 'rotate-180')} />
        </button>

        {accountingOpen && (
          <div className={cn('space-y-1', isRTL ? 'pr-4' : 'pl-4')}>
            {accountingChildren.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => navigate(item.to)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    isRTL && 'flex-row-reverse text-right',
                    item.isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className={cn('truncate', isRTL && 'font-cairo')}>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </nav>
    </aside>
  );
};

export default AppSidebar;
