import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

type Direction = 'ar-to-fr' | 'fr-to-ar';

/**
 * Debounced bidirectional translator for milestone labels.
 *
 * Loop-prevention strategy:
 *   - Each translation request is tagged with the SOURCE language.
 *   - When the result comes back, we only write into the OPPOSITE field.
 *   - We track which field the user last typed in via `lastEditedRef`.
 *     If a stale response arrives after the user switched sides, we drop it.
 *
 * The caller provides `onTranslated(targetLang, text)` and is responsible
 * for updating only the target field — never echoing back into the source.
 */
export function useMilestoneTranslator(opts: {
  onTranslated: (target: 'ar' | 'fr', text: string, requestId: number) => void;
  debounceMs?: number;
}) {
  const { onTranslated, debounceMs = 600 } = opts;
  const timersRef = useRef<Map<string, number>>(new Map());
  const requestCounterRef = useRef(0);
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

      const requestId = ++requestCounterRef.current;

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
          onTranslated(target, translation, requestId);
        } catch (e) {
          console.warn('[milestone translate] failed', e);
        }
      }, debounceMs);

      timersRef.current.set(key, timer);
    },
    [cancel, debounceMs, onTranslated],
  );

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  return { requestTranslation };
}
