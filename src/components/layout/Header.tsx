import { useState, useRef, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
import { Sun, Moon, Loader2, LogIn, LogOut, UserPlus } from 'lucide-react';

const Header = () => {
  const { language, setLanguage, isRTL, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, signOut, isLoading, isPrimaryAdmin } = useAuth();
  const navigate = useNavigate();
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const handleLogoTap = useCallback(() => {
    tapCountRef.current += 1;

    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
    }

    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 800);

    if (tapCountRef.current < 3) return;

    tapCountRef.current = 0;
    navigate(isPrimaryAdmin ? '/admin' : '/login');
  }, [isPrimaryAdmin, navigate]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  const toggleLanguage = () => {
    setLanguage(language === 'fr' ? 'ar' : 'fr');
  };

  const showAuthButtons = !isLoading;

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground',
        'safe-area-pt'
      )}
    >
      <div className={cn('flex items-center justify-between px-3 py-2', isRTL && 'flex-row-reverse')}>
        <div
          className={cn('flex items-center gap-1.5 cursor-pointer select-none', isRTL && 'flex-row-reverse')}
          onClick={handleLogoTap}
        >
          <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center">
            <span className="text-accent-foreground font-bold text-xs">AF</span>
          </div>
          <h1 className={cn('text-base font-bold', isRTL && 'font-cairo')}>
            {t('header.appName')}
          </h1>
        </div>

        <div className={cn('flex items-center gap-1.5', isRTL && 'flex-row-reverse')}>
          {showAuthButtons && (
            isAuthenticated ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                disabled={signingOut}
                className="rounded-full h-7 px-2 bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground text-xs font-bold gap-1"
              >
                {signingOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                <span className="hidden sm:inline">{isRTL ? 'خروج' : 'Déco'}</span>
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/login')}
                  className="rounded-full h-7 px-2 bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground text-xs font-bold gap-1"
                >
                  <LogIn size={14} />
                  <span>{isRTL ? 'دخول' : 'Login'}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/login')}
                  className="rounded-full h-7 px-2 bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground text-xs font-bold gap-1"
                >
                  <UserPlus size={14} />
                  <span className="hidden sm:inline">{isRTL ? 'حساب' : 'Join'}</span>
                </Button>
              </>
            )
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="rounded-full w-7 h-7 p-0 bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={toggleLanguage}
            className={cn(
              'rounded-full px-3 py-1 h-7 font-medium text-xs',
              'bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground'
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
