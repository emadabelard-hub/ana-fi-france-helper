import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface MilestoneLabelInputProps {
  milestoneId: string;
  /** Canonical French value used by the document/PDF. */
  value: string;
  isRTL: boolean;
  onChange: (newFrenchLabel: string) => void;
}

const ARABIC_RE = /[\u0600-\u06FF]/;
const containsArabic = (s: string) => ARABIC_RE.test(s);

/**
 * Bilingual milestone description input.
 *
 * Two fields per milestone:
 *   - AR (top): freely editable by the user, in Arabic.
 *   - FR (bottom): auto-filled by translating the AR field (debounced).
 *     If the user edits FR manually, auto-translation is disabled for
 *     this milestone (no loop, no overwrite). Only FR is persisted.
 *
 * The PDF/document only ever uses the French value.
 */
export function MilestoneLabelInput({ milestoneId, value, isRTL, onChange }: MilestoneLabelInputProps) {
  const [arabic, setArabic] = useState<string>(containsArabic(value) ? '' : '');
  const [french, setFrench] = useState<string>(value);
  const [translating, setTranslating] = useState(false);
  // Once the user touches FR manually, lock auto-translation for this row.
  const [frLocked, setFrLocked] = useState(false);

  const timerRef = useRef<number | null>(null);
  const reqIdRef = useRef(0);

  // Keep FR in sync if the parent value changes from outside (prefill, reorder…).
  useEffect(() => {
    if (value !== french) setFrench(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  const scheduleTranslation = (arText: string) => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (frLocked) return;
    const trimmed = arText.trim();
    if (!trimmed || !containsArabic(trimmed)) return;

    timerRef.current = window.setTimeout(async () => {
      const myReq = ++reqIdRef.current;
      setTranslating(true);
      try {
        const { data, error } = await supabase.functions.invoke('translate-milestone-label', {
          body: { text: trimmed, direction: 'ar-to-fr' },
        });
        if (myReq !== reqIdRef.current) return;
        if (error) {
          console.warn('[milestone translate] edge error', error);
          return;
        }
        const translation = (data?.translation ?? '').toString().trim();
        // Empty = AI failed or returned Arabic (server filtered) → keep previous FR.
        if (!translation) return;
        // Defensive: never accept Arabic into the French field.
        if (containsArabic(translation)) return;
        if (frLocked) return;
        setFrench(translation);
        onChange(translation);
      } catch (e) {
        console.warn('[milestone translate] failed', e);
      } finally {
        if (myReq === reqIdRef.current) setTranslating(false);
      }
    }, 400);
  };

  const handleArabicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setArabic(next);
    scheduleTranslation(next);
  };

  const handleFrenchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setFrench(next);
    setFrLocked(true);
    // Cancel any pending auto-translation that would overwrite user edit.
    if (timerRef.current) window.clearTimeout(timerRef.current);
    onChange(next);
  };

  return (
    <div className="space-y-1.5">
      {/* Arabic field — free user input */}
      <div className="relative">
        <Input
          value={arabic}
          onChange={handleArabicChange}
          placeholder="وصف الدفعة بالعربي"
          className="text-sm text-right font-cairo pr-8"
          dir="rtl"
        />
        {translating && (
          <Loader2 className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* French field — auto-filled, but editable (locks auto-translate when touched) */}
      <Input
        value={french}
        onChange={handleFrenchChange}
        placeholder="Description de l'échéance (français)"
        className={cn('text-sm', isRTL && 'text-left')}
        dir="ltr"
        lang="fr"
      />
    </div>
  );
}
