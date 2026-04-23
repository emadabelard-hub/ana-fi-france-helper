import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Dictation hook dedicated to the "مساعد الشانتي الذكي" (AI Assistant) page.
 *
 * Rules:
 * - final transcript persists for the whole recording session
 * - interim transcript is only temporary UI preview
 * - only NEW final results are committed
 * - no replay from index 0, we respect event.resultIndex
 */

const MAX_DURATION_MS = 120_000; // 2 min safety cap

function normalizeChunk(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

function addSoftPunctuation(input: string): string {
  const text = input.trim();
  if (!text) return '';
  if (/[.!?؟…]$/.test(text)) return text;
  return `${text}.`;
}

/** Light cleanup applied at send time: collapse spaces, remove repeated words/fillers. */
function cleanFinalText(input: string): string {
  if (!input) return '';
  let text = input.replace(/\s+/g, ' ').trim();

  const fillers = [
    'euh', 'heu', 'hum', 'bah', 'ben', 'eh',
    'يعني', 'ايه', 'آه', 'اه', 'امم', 'إمم',
  ];
  const fillerRegex = new RegExp(
    `\\b(?:${fillers.map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
    'giu',
  );
  text = text.replace(fillerRegex, '').replace(/\s+/g, ' ').trim();

  const words = text.split(/\s+/).filter(Boolean);
  const deduped: string[] = [];
  for (const word of words) {
    if (deduped.length === 0 || deduped[deduped.length - 1].toLowerCase() !== word.toLowerCase()) {
      deduped.push(word);
    }
  }

  const result = [...deduped];
  for (let len = 4; len >= 2; len--) {
    let i = 0;
    while (i + len * 2 <= result.length) {
      const a = result.slice(i, i + len).join(' ').toLowerCase();
      const b = result.slice(i + len, i + len * 2).join(' ').toLowerCase();
      if (a === b) {
        result.splice(i + len, len);
        continue;
      }
      i += 1;
    }
  }

  return addSoftPunctuation(result.join(' ').trim());
}

export function useAssistantDictation(lang: 'fr-FR' | 'ar-EG' = 'ar-EG') {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [duration, setDuration] = useState(0);

  const recognitionRef = useRef<any>(null);
  const finalRef = useRef('');
  const finalSegmentsRef = useRef<Record<number, string>>({});
  const lastProcessedIndexRef = useRef(0);
  const cycleBaseIndexRef = useRef(0);
  const isRecordingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef(0);

  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const rebuildFinalTranscript = useCallback(() => {
    finalRef.current = Object.keys(finalSegmentsRef.current)
      .map(Number)
      .sort((a, b) => a - b)
      .map((key) => finalSegmentsRef.current[key])
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    return finalRef.current;
  }, []);

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

    cleanup();
    finalRef.current = '';
    finalSegmentsRef.current = {};
    lastProcessedIndexRef.current = 0;
    cycleBaseIndexRef.current = 0;
    setTranscript('');

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const rawText = result?.[0]?.transcript ?? '';
        const text = normalizeChunk(rawText);
        const absoluteIndex = cycleBaseIndexRef.current + i;

        if (absoluteIndex < lastProcessedIndexRef.current) {
          continue;
        }

        if (!text) {
          continue;
        }

        if (result.isFinal) {
          finalSegmentsRef.current[absoluteIndex] = text;
          lastProcessedIndexRef.current = absoluteIndex + 1;
        } else {
          interimTranscript += `${interimTranscript ? ' ' : ''}${text}`;
        }
      }

      const finalTranscript = rebuildFinalTranscript();
      const displayTranscript = [finalTranscript, normalizeChunk(interimTranscript)]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      setTranscript(displayTranscript);
    };

    recognition.onerror = (e: any) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      console.error('Assistant dictation error:', e.error);
    };

    recognition.onend = () => {
      if (isRecordingRef.current && recognitionRef.current === recognition) {
        cycleBaseIndexRef.current = lastProcessedIndexRef.current;
        try {
          recognition.start();
        } catch {
          /* noop */
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
  }, [cleanup, isSupported, lang, rebuildFinalTranscript]);

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
    return (finalRef.current || transcript).trim();
  }, [transcript]);

  const getCleanedText = useCallback((): string => {
    return cleanFinalText(finalRef.current || transcript);
  }, [transcript]);

  const cancel = useCallback(() => {
    cleanup();
    finalRef.current = '';
    finalSegmentsRef.current = {};
    lastProcessedIndexRef.current = 0;
    cycleBaseIndexRef.current = 0;
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
