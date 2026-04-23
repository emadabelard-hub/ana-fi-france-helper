import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Dictation hook dedicated to the "مساعد الشانتي الذكي" (AI Assistant) page.
 *
 * Rules:
 * - final transcript persists for the whole recording session
 * - interim transcript is only temporary UI preview
 * - only NEW final results are committed
 * - no replay from index 0, we respect event.resultIndex
 * - lastProcessedIndex guarantees zero re-processing of already-finalized segments
 */

const MAX_DURATION_MS = 120_000; // 2 min safety cap

function normalizeChunk(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isDuplicate(newText: string, existingText: string): boolean {
  const next = normalizeChunk(newText);
  const existing = normalizeChunk(existingText);

  if (!next || !existing) return false;
  return existing.includes(next);
}

function cleanText(input: string): string {
  if (!input) return '';

  const fillers = [
    'euh', 'heu', 'hum', 'bah', 'ben', 'eh', 'du coup', 'genre', 'donc euh',
    'يعني', 'ايه', 'آه', 'اه', 'أه', 'امم', 'إمم', 'ممم',
  ];

  let text = input.replace(/\s+/g, ' ').trim();

  for (const filler of fillers) {
    const fillerRegex = new RegExp(`(^|\\s)${escapeRegex(filler)}(?=\\s|$)`, 'giu');
    text = text.replace(fillerRegex, ' ');
  }

  return text
    .replace(/(\b\w+\b)(\s+\1\b)+/gi, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function capitalizeIfLatin(input: string): string {
  if (!input) return input;
  const [first, ...rest] = input;
  return /[a-zà-ÿ]/i.test(first) ? `${first.toLocaleUpperCase()}${rest.join('')}` : input;
}

function formatText(input: string): string {
  const cleaned = cleanText(input);
  if (!cleaned) return '';

  let formatted = capitalizeIfLatin(cleaned);
  if (!/[.!?؟…]$/.test(formatted)) {
    formatted += '.';
  }

  return formatted;
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
  let text = cleanText(input);

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

  return formatText(addSoftPunctuation(result.join(' ').trim()));
}

export function useAssistantDictation(lang: 'fr-FR' | 'ar-EG' = 'ar-EG') {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [duration, setDuration] = useState(0);

  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef('');
  const interimTranscriptRef = useRef('');
  const lastFinalizedTextRef = useRef('');
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
    finalTranscriptRef.current = Object.keys(finalSegmentsRef.current)
      .map(Number)
      .sort((a, b) => a - b)
      .map((key) => finalSegmentsRef.current[key])
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    return finalTranscriptRef.current;
  }, []);

  const syncTranscript = useCallback(() => {
    const rawText = `${finalTranscriptRef.current} ${interimTranscriptRef.current}`.trim();
    const cleaned = cleanText(rawText);
    setTranscript(cleaned);
    return cleaned;
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
    finalTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    lastFinalizedTextRef.current = '';
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
        const text = cleanText(normalizeChunk(rawText));
        const absoluteIndex = cycleBaseIndexRef.current + i;

        if (absoluteIndex < lastProcessedIndexRef.current) {
          continue;
        }

        if (!text) {
          continue;
        }

        if (result.isFinal) {
          if (isDuplicate(text, finalTranscriptRef.current) || text === lastFinalizedTextRef.current) {
            lastProcessedIndexRef.current = absoluteIndex + 1;
            continue;
          }

          finalSegmentsRef.current[absoluteIndex] = text;
          lastFinalizedTextRef.current = text;
          lastProcessedIndexRef.current = absoluteIndex + 1;
        } else {
          interimTranscript += `${interimTranscript ? ' ' : ''}${text}`;
        }
      }

      finalTranscriptRef.current = rebuildFinalTranscript();
      interimTranscriptRef.current = cleanText(normalizeChunk(interimTranscript));
      syncTranscript();
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
    interimTranscriptRef.current = '';
    return cleanText(finalTranscriptRef.current || transcript);
  }, [transcript]);

  const getCleanedText = useCallback((): string => {
    return cleanFinalText(finalTranscriptRef.current || transcript);
  }, [transcript]);

  const cancel = useCallback(() => {
    cleanup();
    finalTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    lastFinalizedTextRef.current = '';
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
