import { useLanguage } from '@/contexts/LanguageContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const Header = () => {
  const { language, setLanguage, isRTL } = useLanguage();
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
      labelAr: 'استشارات',
      labelFr: 'Consultations',
      path: '/assistant',
      isActive: isConsultationsActive,
    },
    {
      id: 'pro',
      labelAr: 'دراعك اليمين',
      labelFr: 'Outils Pro',
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
        "flex items-center justify-between px-4 py-3",
        isRTL && "flex-row-reverse"
      )}>
        {/* Logo */}
        <div className={cn(
          "flex items-center gap-2",
          isRTL && "flex-row-reverse"
        )}>
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
            <span className="text-accent-foreground font-bold text-sm">AF</span>
          </div>
          <h1 className={cn(
            "text-lg font-bold",
            isRTL && "font-cairo"
          )}>
            {isRTL ? 'أنا في فرنسا' : 'Ana Fi France'}
          </h1>
        </div>

        {/* Language Toggle */}
        <Button
          variant="secondary"
          size="sm"
          onClick={toggleLanguage}
          className={cn(
            "rounded-full px-4 font-medium text-sm",
            "bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground"
          )}
        >
          {language === 'fr' ? 'العربية' : 'Français'}
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className={cn(
        "flex border-t border-primary-foreground/10",
        isRTL && "flex-row-reverse"
      )}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => navigate(tab.path)}
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-all",
              "border-b-2",
              tab.isActive
                ? "border-accent text-primary-foreground"
                : "border-transparent text-primary-foreground/60 hover:text-primary-foreground/80",
              isRTL && "font-cairo"
            )}
          >
            {isRTL ? tab.labelAr : tab.labelFr}
          </button>
        ))}
      </div>
    </header>
  );
};

export default Header;
