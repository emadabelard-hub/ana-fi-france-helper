import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { CV_DRAFT_SAVED_EVENT } from '@/lib/cvDraftStorage';

interface CVAutoSaveIndicatorProps {
  className?: string;
}

/**
 * Tiny green pill that pulses each time the CV form auto-saves.
 * Listens to the global `CV_DRAFT_SAVED_EVENT` broadcast.
 */
const CVAutoSaveIndicator = ({ className }: CVAutoSaveIndicatorProps) => {
  const { isRTL } = useLanguage();
  const [pulse, setPulse] = useState(false);
  const [hasSavedOnce, setHasSavedOnce] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onSaved = () => {
      setHasSavedOnce(true);
      setPulse(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setPulse(false), 900);
    };
    window.addEventListener(CV_DRAFT_SAVED_EVENT, onSaved as EventListener);
    return () => {
      window.removeEventListener(CV_DRAFT_SAVED_EVENT, onSaved as EventListener);
      if (timer) clearTimeout(timer);
    };
  }, []);

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

export default CVAutoSaveIndicator;
