import { useState, useRef, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Sun, Moon, Loader2 } from 'lucide-react';

const Header = () => {
  const { language, setLanguage, isRTL, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [adminLoading, setAdminLoading] = useState(false);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogoTap = useCallback(async () => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 800);

    if (tapCountRef.current < 5 || adminLoading) return;

    tapCountRef.current = 0;
    const ADMIN_EMAIL = 'emadabelard@gmail.com';
    const ADMIN_PASS = 'Admin2024!secure';

    setAdminLoading(true);
    try {
      // If already logged in as admin, go directly
      if (user) {
        const { data: isAdminUser } = await supabase.rpc('is_admin', { _user_id: user.id });
        if (isAdminUser) {
          navigate('/admin');
          return;
        }
        await supabase.auth.signOut();
      }

      // Try sign in directly
      let { error } = await supabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASS });

      if (error?.message?.includes('Invalid login')) {
        // Account may not exist yet, create it
        const { error: signUpErr } = await supabase.auth.signUp({ email: ADMIN_EMAIL, password: ADMIN_PASS });
        if (!signUpErr) {
          const { error: retryErr } = await supabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASS });
          error = retryErr;
        } else {
          error = signUpErr;
        }
      }

      if (error) {
        toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      } else {
        toast({ title: '✅ Connecté', description: 'Redirection vers le panneau admin...' });
        navigate('/admin');
      }
    } finally {
      setAdminLoading(false);
    }
  }, [adminLoading, navigate, toast, user]);


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
        {/* Compact Logo — 5 taps = admin access */}
        <div
          className={cn("flex items-center gap-1.5 cursor-pointer select-none", isRTL && "flex-row-reverse")}
          onClick={handleLogoTap}
        >
          <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center">
            {adminLoading ? <Loader2 className="h-3 w-3 animate-spin text-accent-foreground" /> : <span className="text-accent-foreground font-bold text-xs">AF</span>}
          </div>
          <h1 className={cn("text-base font-bold", isRTL && "font-cairo")}>
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
