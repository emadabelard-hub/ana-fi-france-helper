import { useLanguage } from '@/contexts/LanguageContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const Header = () => {
  const { language, setLanguage, isRTL, t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const toggleLanguage = () => {
    setLanguage(language === 'fr' ? 'ar' : 'fr');
  };

  // Determine active tab
  const isConsultationsActive = location.pathname === '/' || location.pathname === '/assistant';
  const isProActive = location.pathname.startsWith('/pro');

  const tabs = [
    {
      id: 'consultations',
      label: t('header.consultations'),
      path: '/assistant',
      isActive: isConsultationsActive,
    },
    {
      id: 'pro',
      label: t('header.proTools'),
      path: '/pro',
      isActive: isProActive,
    },
  ];

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground",
      "safe-area-pt"
    )}>
      <div className={cn(
        "flex items-center justify-between px-3 py-2",
        isRTL && "flex-row-reverse"
      )}>
        {/* Compact Logo */}
        <div className={cn(
          "flex items-center gap-1.5",
          isRTL && "flex-row-reverse"
        )}>
          <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center">
            <span className="text-accent-foreground font-bold text-xs">AF</span>
          </div>
          <h1 className={cn(
            "text-base font-bold",
            isRTL && "font-cairo"
          )}>
            {t('header.appName')}
          </h1>
        </div>

        {/* Language Toggle - Compact */}
        <Button
          variant="secondary"
          size="sm"
          onClick={toggleLanguage}
          className={cn(
            "rounded-full px-3 py-1 h-7 font-medium text-xs",
            "bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground"
          )}
        >
          {language === 'fr' ? 'AR' : 'FR'}
        </Button>
      </div>

      {/* Tab Navigation - Compact */}
      <div className={cn(
        "flex border-t border-primary-foreground/10",
        isRTL && "flex-row-reverse"
      )}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => navigate(tab.path)}
            className={cn(
              "flex-1 py-2 text-xs font-medium transition-all",
              "border-b-2",
              tab.isActive
                ? "border-accent text-primary-foreground"
                : "border-transparent text-primary-foreground/60 hover:text-primary-foreground/80",
              isRTL && "font-cairo"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </header>
  );
};

export default Header;
