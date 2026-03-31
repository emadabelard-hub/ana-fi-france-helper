import { useState, useCallback, useRef, useEffect } from 'react';

const MAX_DURATION_MS = 90_000; // 90 seconds max

/**
 * Deduplicate repeated words/phrases that Web Speech API produces in continuous mode.
 * e.g. "اعرف اعرف اعرف اعرف" → "اعرف"
 */
function deduplicateTranscript(text: string): string {
  if (!text.trim()) return '';
  
  const words = text.trim().split(/\s+/);
  if (words.length <= 1) return text.trim();

  // Remove consecutive duplicate words
  const deduped: string[] = [words[0]];
  for (let i = 1; i < words.length; i++) {
    if (words[i] !== words[i - 1]) {
      deduped.push(words[i]);
    }
  }

  // Also detect repeated contiguous phrases (2-4 word patterns) anywhere in the text.
  const collapsed = [...deduped];
  for (let patternLen = 4; patternLen >= 2; patternLen--) {
    let i = 0;
    while (i + patternLen * 2 <= collapsed.length) {
      const current = collapsed.slice(i, i + patternLen).join(' ');
      const next = collapsed.slice(i + patternLen, i + patternLen * 2).join(' ');
      if (current === next) {
        collapsed.splice(i + patternLen, patternLen);
        continue;
      }
      i += 1;
    }
  }

  return collapsed.join(' ').trim();
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface VoiceRecorderState {
  isRecording: boolean;
  isLocked: boolean;
  transcript: string;
  duration: number; // seconds
}

export function useVoiceRecorder(lang: 'fr-FR' | 'ar-EG' = 'ar-EG') {
  const [isRecording, setIsRecording] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [duration, setDuration] = useState(0);
  
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef('');
  const transcriptSegmentsRef = useRef<Record<number, { text: string; isFinal: boolean }>>({});

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null; }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setIsLocked(false);
    setDuration(0);
    transcriptSegmentsRef.current = {};
  }, []);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return false;

    cleanup();
    finalTranscriptRef.current = '';
    transcriptSegmentsRef.current = {};
    setTranscript('');

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result?.[0]?.transcript?.trim() ?? '';

        if (!text) {
          delete transcriptSegmentsRef.current[i];
          continue;
        }

        transcriptSegmentsRef.current[i] = {
          text,
          isFinal: Boolean(result.isFinal),
        };
      }

      const orderedSegments = Object.entries(transcriptSegmentsRef.current)
        .map(([index, value]) => ({ index: Number(index), ...value }))
        .sort((a, b) => a.index - b.index);

      finalTranscriptRef.current = deduplicateTranscript(
        orderedSegments
          .filter((segment) => segment.isFinal)
          .map((segment) => segment.text)
          .join(' '),
      );

      setTranscript(
        deduplicateTranscript(orderedSegments.map((segment) => segment.text).join(' ')),
      );
    };

    recognition.onerror = (e: any) => {
      // 'no-speech' is not fatal in continuous mode - restart
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      console.error('Speech recognition error:', e.error);
      cleanup();
    };

    recognition.onend = () => {
      // In continuous mode, restart if still recording (browser may stop it)
      if (recognitionRef.current && isRecordingRef.current) {
        try { 
          recognition.start(); 
        } catch {
          cleanup();
        }
      }
    };

    recognitionRef.current = recognition;
    isRecordingRef.current = true;
    
    try {
      recognition.start();
    } catch {
      return false;
    }

    setIsRecording(true);
    startTimeRef.current = Date.now();
    
    // Duration timer
    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 500);

    // Max duration safety
    maxTimerRef.current = setTimeout(() => {
      stop();
    }, MAX_DURATION_MS);

    return true;
  }, [lang, cleanup]);

  // Use ref to track recording state for the onend callback
  const isRecordingRef = useRef(false);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

  const lock = useCallback(() => {
    if (isRecording) setIsLocked(true);
  }, [isRecording]);

  const stop = useCallback((): string => {
    isRecordingRef.current = false;
    const finalText = deduplicateTranscript(
      finalTranscriptRef.current || transcript
    );
    cleanup();
    setTranscript('');
    return finalText;
  }, [cleanup, transcript]);

  const cancel = useCallback(() => {
    isRecordingRef.current = false;
    finalTranscriptRef.current = '';
    setTranscript('');
    cleanup();
  }, [cleanup]);

  const isSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  return {
    isRecording,
    isLocked,
    transcript,
    duration,
    start,
    stop,
    lock,
    cancel,
    isSupported,
  };
}
