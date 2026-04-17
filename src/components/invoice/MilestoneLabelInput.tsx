import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface MilestoneLabelInputProps {
  milestoneId: string;
  value: string; // canonical French value stored in state
  isRTL: boolean;
  onChange: (newFrenchLabel: string) => void;
}

const ARABIC_RE = /[\u0600-\u06FF]/;
const containsArabic = (s: string) => ARABIC_RE.test(s);

/**
 * Milestone description input.
 *
 * The persisted value (`value`) is ALWAYS French — this is what the
 * document/PDF will display. The user can type in either language:
 *   - French (or any Latin) → stored as-is.
 *   - Arabic → kept locally for editing comfort, then debounced-translated
 *     to French via the `translate-milestone-label` edge function. Once the
 *     translation arrives, the canonical French value is saved.
 *
 * No bidirectional sync, no second field. One field, one source of truth (FR).
 */
export function MilestoneLabelInput({ milestoneId, value, isRTL, onChange }: MilestoneLabelInputProps) {
  // Local draft mirrors what the user is typing (may be Arabic).
  const [draft, setDraft] = useState<string>(value);
  const [translating, setTranslating] = useState(false);
  const timerRef = useRef<number | null>(null);
  const reqIdRef = useRef(0);
  const lastTranslatedRef = useRef<string>('');

  // Sync external value into local draft when it changes from outside
  // (e.g. prefill, draft restore, milestone reorder).
  useEffect(() => {
    if (!containsArabic(draft) && value !== draft) {
      setDraft(value);
    }
    // We intentionally don't include `draft` to avoid clobbering local typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  const scheduleTranslation = (text: string) => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (!text.trim() || !containsArabic(text)) return;
    if (text === lastTranslatedRef.current) return;

    timerRef.current = window.setTimeout(async () => {
      const myReq = ++reqIdRef.current;
      setTranslating(true);
      try {
        const { data, error } = await supabase.functions.invoke('translate-milestone-label', {
          body: { text: text.trim(), direction: 'ar-to-fr' },
        });
        // Stale response? user kept typing.
        if (myReq !== reqIdRef.current) return;
        if (error) {
          console.warn('[milestone translate] edge error', error);
          return;
        }
        const translation = (data?.translation ?? '').toString().trim();
        if (!translation) return;
        lastTranslatedRef.current = text;
        // Replace local draft with the canonical French and persist it.
        setDraft(translation);
        onChange(translation);
      } catch (e) {
        console.warn('[milestone translate] failed', e);
      } finally {
        if (myReq === reqIdRef.current) setTranslating(false);
      }
    }, 700);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setDraft(next);
    if (containsArabic(next)) {
      // Don't persist Arabic — wait for translation to set the French value.
      scheduleTranslation(next);
    } else {
      // Plain Latin/French → persist immediately.
      lastTranslatedRef.current = '';
      onChange(next);
    }
  };

  const isDraftArabic = containsArabic(draft);

  return (
    <div className="relative">
      <Input
        value={draft}
        onChange={handleChange}
        placeholder={isRTL ? 'وصف الدفعة (عربي أو فرنسي)' : "Description de l'échéance"}
        className={cn(
          'text-sm pr-8',
          isDraftArabic && 'text-right font-cairo',
        )}
        dir={isDraftArabic ? 'rtl' : undefined}
      />
      {translating && (
        <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
