import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Dictation hook dedicated to the "مساعد الشانتي الذكي" (AI Assistant) page.
 *
 * Implements clean separation between:
 *   - finalTranscript : permanent text (only `isFinal === true` results)
 *   - interimTranscript : live preview (replaced on every event, never accumulated)
 *
 * The displayed `transcript` = finalTranscript + interimTranscript, so the user
 * sees live typing without any duplication.
 */

const MAX_DURATION_MS = 120_000; // 2 min safety cap

/** Light cleanup applied at send time: collapse spaces, remove repeated words/fillers. */
function cleanFinalText(input: string): string {
  if (!input) return '';
  let text = input.replace(/\s+/g, ' ').trim();

  // Remove French + Arabic hesitation fillers
  const fillers = [
    'euh', 'heu', 'hum', 'bah', 'ben', 'eh',
    'يعني', 'ايه', 'آه', 'اه', 'امم', 'إمم',
  ];
  const fillerRegex = new RegExp(
    `\\b(?:${fillers.map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
    'giu',
  );
  text = text.replace(fillerRegex, '').replace(/\s+/g, ' ').trim();

  // Remove consecutive duplicate words (case-insensitive)
  const words = text.split(/\s+/);
  const deduped: string[] = [];
  for (const w of words) {
    if (deduped.length === 0 || deduped[deduped.length - 1].toLowerCase() !== w.toLowerCase()) {
      deduped.push(w);
    }
  }

  // Remove consecutive duplicate phrases (2-4 word windows)
  let result = deduped;
  for (let len = 4; len >= 2; len--) {
    let i = 0;
    while (i + len * 2 <= result.length) {
      const a = result.slice(i, i + len).join(' ').toLowerCase();
      const b = result.slice(i + len, i + len * 2).join(' ').toLowerCase();
      if (a === b) {
        result.splice(i + len, len);
        continue;
      }
      i++;
    }
  }

  return result.join(' ').trim();
}

export function useAssistantDictation(lang: 'fr-FR' | 'ar-EG' = 'ar-EG') {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [duration, setDuration] = useState(0);

  const recognitionRef = useRef<any>(null);
  const finalRef = useRef('');
  const isRecordingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef(0);

  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
      } catch {
        /* noop */
      }
      recognitionRef.current = null;
    }
    isRecordingRef.current = false;
    setIsRecording(false);
    setDuration(0);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(() => {
    if (!isSupported) return false;
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    // Reset everything for a fresh session
    cleanup();
    finalRef.current = '';
    setTranscript('');

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      // Build interim from CURRENT batch only (never persist it)
      let interim = '';
      // Append ONLY new final results to finalRef (one-shot)
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result?.[0]?.transcript ?? '';
        if (!text) continue;
        if (result.isFinal) {
          finalRef.current += (finalRef.current ? ' ' : '') + text.trim();
        } else {
          interim += text;
        }
      }
      const display = (finalRef.current + (interim ? ' ' + interim : '')).replace(/\s+/g, ' ').trim();
      setTranscript(display);
    };

    recognition.onerror = (e: any) => {
      // Non-fatal: silence/aborted
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      console.error('Assistant dictation error:', e.error);
    };

    recognition.onend = () => {
      // Auto-restart while user keeps recording (browser may stop after silence)
      if (isRecordingRef.current && recognitionRef.current === recognition) {
        try {
          recognition.start();
        } catch {
          /* may throw if already started — ignore */
        }
      }
    };

    recognitionRef.current = recognition;
    isRecordingRef.current = true;

    try {
      recognition.start();
    } catch {
      cleanup();
      return false;
    }

    setIsRecording(true);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 500);
    maxTimerRef.current = setTimeout(() => {
      stopRecording();
    }, MAX_DURATION_MS);

    return true;
  }, [isSupported, lang, cleanup]);

  /** Stop recording but KEEP the transcript visible. Returns the current text. */
  const stopRecording = useCallback((): string => {
    isRecordingRef.current = false;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        /* noop */
      }
      recognitionRef.current = null;
    }
    setIsRecording(false);
    return finalRef.current.trim();
  }, []);

  /** Get the cleaned final text (apply at SEND time only). */
  const getCleanedText = useCallback((): string => {
    return cleanFinalText(finalRef.current || transcript);
  }, [transcript]);

  /** Cancel session and clear everything. */
  const cancel = useCallback(() => {
    cleanup();
    finalRef.current = '';
    setTranscript('');
  }, [cleanup]);

  return {
    isRecording,
    transcript,
    duration,
    isSupported,
    start,
    stopRecording,
    getCleanedText,
    cancel,
  };
}
