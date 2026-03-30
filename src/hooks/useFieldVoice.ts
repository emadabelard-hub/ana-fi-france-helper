import { useState, useCallback, useRef } from 'react';
import { correctArtisanVocabulary } from '@/lib/artisanVocabulary';

/**
 * Hook for field-level voice input (ChatGPT-style toggle).
 * Click mic → start listening. Click again → stop & return corrected text.
 */
export function useFieldVoice(lang = 'fr-FR') {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const accumulatedRef = useRef('');

  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const start = useCallback(
    (onInterim?: (text: string) => void) => {
      if (!isSupported) return;

      const SR =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      const recognition = new SR();
      recognition.lang = lang;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      accumulatedRef.current = '';

      recognition.onresult = (event: any) => {
        let finalText = '';
        let interimText = '';
        for (let i = 0; i < event.results.length; i++) {
          const r = event.results[i];
          if (r.isFinal) {
            finalText += r[0].transcript + ' ';
          } else {
            interimText += r[0].transcript;
          }
        }
        const combined = (finalText + interimText).trim();
        const corrected = correctArtisanVocabulary(combined);
        accumulatedRef.current = corrected;
        onInterim?.(corrected);
      };

      recognition.onerror = (e: any) => {
        if (e.error === 'no-speech' || e.error === 'aborted') return;
        console.error('Field voice error:', e.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        // Auto-restart if still listening (browser may stop it)
        if (recognitionRef.current) {
          try {
            recognition.start();
          } catch {
            setIsListening(false);
          }
        }
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
        setIsListening(true);
      } catch {
        /* ignore */
      }
    },
    [isSupported, lang],
  );

  const stop = useCallback((): string => {
    const ref = recognitionRef.current;
    recognitionRef.current = null;
    try {
      ref?.stop();
    } catch {
      /* ignore */
    }
    setIsListening(false);
    return correctArtisanVocabulary(accumulatedRef.current);
  }, []);

  return { isListening, start, stop, isSupported };
}
