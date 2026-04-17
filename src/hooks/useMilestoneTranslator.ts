import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

type Direction = 'ar-to-fr' | 'fr-to-ar';

/**
 * Debounced bidirectional translator for milestone labels.
 *
 * Loop-prevention strategy:
 *   - Each `key` (= milestone id) tracks which side the user last typed in.
 *   - When the result comes back, we only write into the OPPOSITE field.
 *   - If a stale response arrives after the user switched sides on the same
 *     milestone, we drop it.
 */
export function useMilestoneTranslator(opts: {
  onTranslated: (key: string, target: 'ar' | 'fr', text: string) => void;
  debounceMs?: number;
}) {
  const { onTranslated, debounceMs = 600 } = opts;
  const timersRef = useRef<Map<string, number>>(new Map());
  const lastEditedRef = useRef<Map<string, 'ar' | 'fr'>>(new Map());

  const cancel = useCallback((key: string) => {
    const t = timersRef.current.get(key);
    if (t) {
      window.clearTimeout(t);
      timersRef.current.delete(key);
    }
  }, []);

  const requestTranslation = useCallback(
    (key: string, text: string, direction: Direction) => {
      cancel(key);
      const source: 'ar' | 'fr' = direction === 'ar-to-fr' ? 'ar' : 'fr';
      const target: 'ar' | 'fr' = direction === 'ar-to-fr' ? 'fr' : 'ar';
      lastEditedRef.current.set(key, source);

      const trimmed = text.trim();
      if (!trimmed) return;

      const timer = window.setTimeout(async () => {
        try {
          const { data, error } = await supabase.functions.invoke(
            'translate-milestone-label',
            { body: { text: trimmed, direction } },
          );
          if (error) {
            console.warn('[milestone translate] edge error', error);
            return;
          }
          // Drop stale response: user switched to editing the other side.
          if (lastEditedRef.current.get(key) !== source) return;

          const translation = (data?.translation ?? '').toString().trim();
          if (!translation) return;
          onTranslated(key, target, translation);
        } catch (e) {
          console.warn('[milestone translate] failed', e);
        }
      }, debounceMs);

      timersRef.current.set(key, timer);
    },
    [cancel, debounceMs, onTranslated],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      timers.clear();
    };
  }, []);

  return { requestTranslation };
}
