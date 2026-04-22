import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { DRAFT_SAVED_EVENT } from '@/lib/invoiceDraftStorage';

interface AutoSaveIndicatorProps {
  documentType: 'devis' | 'facture';
  className?: string;
}

/**
 * Tiny green pill that pulses each time the form auto-saves.
 * Listens to the global `DRAFT_SAVED_EVENT` broadcast from invoiceDraftStorage.
 */
const AutoSaveIndicator = ({ documentType, className }: AutoSaveIndicatorProps) => {
  const { isRTL } = useLanguage();
  const [pulse, setPulse] = useState(false);
  const [hasSavedOnce, setHasSavedOnce] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onSaved = (e: Event) => {
      const detail = (e as CustomEvent).detail as { documentType?: string } | undefined;
      if (detail?.documentType && detail.documentType !== documentType) return;
      setHasSavedOnce(true);
      setPulse(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setPulse(false), 900);
    };
    window.addEventListener(DRAFT_SAVED_EVENT, onSaved as EventListener);
    return () => {
      window.removeEventListener(DRAFT_SAVED_EVENT, onSaved as EventListener);
      if (timer) clearTimeout(timer);
    };
  }, [documentType]);

  if (!hasSavedOnce) return null;

  const label = isRTL ? '💾 محفوظ تلقائياً' : '💾 Sauvegardé';

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium',
        'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20',
        'transition-all duration-300',
        pulse && 'scale-105 bg-emerald-500/20 shadow-[0_0_0_4px_hsl(142_71%_45%/0.12)]',
        isRTL && 'flex-row-reverse font-cairo',
        className,
      )}
    >
      <Save className={cn('h-3 w-3', pulse && 'animate-pulse')} />
      <span>{label}</span>
    </div>
  );
};

export default AutoSaveIndicator;
