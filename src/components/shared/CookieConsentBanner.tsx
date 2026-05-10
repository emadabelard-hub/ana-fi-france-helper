import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cookie } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'cookie_consent_v1';

const CookieConsentBanner = () => {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        const t = setTimeout(() => setVisible(true), 600);
        return () => clearTimeout(t);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ accepted: true, at: new Date().toISOString() }));
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[100] p-3 sm:p-4 pointer-events-none"
    >
      <div
        className={cn(
          'pointer-events-auto mx-auto max-w-2xl rounded-2xl border border-border bg-background/95 backdrop-blur-md shadow-2xl p-4 sm:p-5',
          'flex flex-col gap-3'
        )}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className={cn('flex items-start gap-3', isRTL && 'flex-row-reverse')}>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Cookie className="h-5 w-5 text-primary" />
          </div>
          <p
            className={cn(
              'text-sm text-foreground/85 leading-relaxed flex-1',
              isRTL ? 'text-right font-cairo' : 'text-left'
            )}
          >
            {isRTL
              ? 'بنستخدم كوكيز ضرورية بس عشان التطبيق يشتغل صح. مفيش تتبع ولا إعلانات.'
              : "Nous utilisons des cookies essentiels pour le fonctionnement de l'application."}
          </p>
        </div>
        <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
          <Button onClick={accept} className="flex-1 h-10 rounded-xl font-semibold">
            {isRTL ? 'موافق' : 'Accepter'}
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/legal')}
            className="flex-1 h-10 rounded-xl"
          >
            {isRTL ? 'اعرف أكتر' : 'En savoir plus'}
          </Button>
        </div>
        <button
          onClick={() => navigate('/legal')}
          className={cn(
            'text-xs text-muted-foreground hover:text-primary underline self-center',
            isRTL && 'font-cairo'
          )}
        >
          {isRTL ? 'سياسة الخصوصية' : 'Politique de confidentialité'}
        </button>
      </div>
    </div>
  );
};

export default CookieConsentBanner;
