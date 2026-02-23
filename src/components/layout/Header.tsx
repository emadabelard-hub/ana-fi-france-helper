import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
import { Sun, Moon } from 'lucide-react';

const Header = () => {
  const { language, setLanguage, isRTL, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();


  const toggleLanguage = () => {
    setLanguage(language === 'fr' ? 'ar' : 'fr');
  };

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

        <div className={cn("flex items-center gap-1.5", isRTL && "flex-row-reverse")}>
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="rounded-full w-7 h-7 p-0 bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </Button>

          {/* Language Toggle */}
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
      </div>

    </header>
  );
};

export default Header;
