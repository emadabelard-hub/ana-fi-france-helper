import { useEffect, useRef, useState } from 'react';
import { Loader2, Languages } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
 * - AR field: free user input, never persisted to the document.
 * - FR field: filled ONLY when the user clicks the "Traduire" button.
 *   Remains fully editable afterwards. No auto-sync, no debounce loop.
 *
 * The PDF/document only ever uses the French value.
 */
export function MilestoneLabelInput({ milestoneId, value, isRTL, onChange }: MilestoneLabelInputProps) {
  const [arabic, setArabic] = useState<string>('');
  const [french, setFrench] = useState<string>(value);
  const [translating, setTranslating] = useState(false);
  const reqIdRef = useRef(0);

  // Keep FR in sync if the parent value changes from outside (prefill, reorder…).
  useEffect(() => {
    if (value !== french) setFrench(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleTranslate = async () => {
    const trimmed = arabic.trim();
    console.log('[milestone translate] click, text=', trimmed);
    if (!trimmed) {
      toast.error('اكتب الوصف بالعربي الأول');
      return;
    }

    const myReq = ++reqIdRef.current;
    setTranslating(true);
    try {
      // Direct fetch — more reliable than supabase.functions.invoke for anonymous calls.
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translate-milestone-label`;
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey,
          Authorization: `Bearer ${accessToken || apiKey}`,
        },
        body: JSON.stringify({ text: trimmed, direction: 'ar-to-fr' }),
      });

      if (myReq !== reqIdRef.current) return;

      if (!res.ok) {
        const errBody = await res.text();
        console.warn('[milestone translate] http error', res.status, errBody);
        toast.error('فشلت الترجمة، حاول تاني');
        return;
      }

      const data = await res.json();
      const translation = (data?.translation ?? '').toString().trim();
      console.log('[milestone translate] ok, translation=', translation);

      if (!translation || containsArabic(translation)) {
        toast.error('الترجمة فشلت، اكتب بالفرنساوي مباشرة');
        return;
      }
      setFrench(translation);
      onChange(translation);
    } catch (e) {
      console.warn('[milestone translate] failed', e);
      toast.error('فشلت الترجمة، حاول تاني');
    } finally {
      if (myReq === reqIdRef.current) setTranslating(false);
    }
  };

  const handleArabicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setArabic(e.target.value);
  };

  const handleFrenchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setFrench(next);
    onChange(next);
  };

  return (
    <div className="space-y-1.5">
      {/* Arabic field + Translate button */}
      <div className="flex gap-1.5">
        <Input
          value={arabic}
          onChange={handleArabicChange}
          placeholder="وصف الدفعة بالعربي"
          className="text-sm text-right font-cairo flex-1"
          dir="rtl"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleTranslate}
          disabled={translating || !arabic.trim()}
          className="shrink-0 h-10 px-2.5 gap-1"
          title="ترجم للفرنساوي"
        >
          {translating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Languages className="h-4 w-4" />
              <span className="text-xs font-cairo">ترجم</span>
            </>
          )}
        </Button>
      </div>

      {/* French field — editable, filled by translation button */}
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
