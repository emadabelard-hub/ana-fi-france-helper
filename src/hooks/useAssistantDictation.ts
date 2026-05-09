import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

/**
 * Dictation hook dedicated to "مساعد الشانتي الذكي".
 * Simple, robust implementation using the Web Speech API.
 */

const MAX_DURATION_MS = 120_000;

export function useAssistantDictation(lang: 'fr-FR' | 'ar-EG' = 'ar-EG') {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [duration, setDuration] = useState(0);
  const { toast } = useToast();

  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef('');
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
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      try {
        recognition.onend = null;
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.stop();
      } catch {
        /* noop */
      }
    }
    isRecordingRef.current = false;
    setIsRecording(false);
    setDuration(0);
  }, []);

  useEffect(() => cleanup, [cleanup]);

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
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      try {
        recognition.onend = null;
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.stop();
      } catch {
        /* noop */
      }
    }
    setIsRecording(false);
    const finalText = (finalTranscriptRef.current || transcript).trim();
    setTranscript(finalText);
    return finalText;
  }, [transcript]);

  const start = useCallback(() => {
    if (!isSupported) return false;

    cleanup();

    finalTranscriptRef.current = '';
    setTranscript('');

    const SpeechRecognition: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    let finalText = '';

    recognition.onresult = (event: any) => {
      // Récupérer UNIQUEMENT les nouveaux résultats finals
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript + ' ';
        }
      }

      // Afficher interim sans l'accumuler dans finalText
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (!event.results[i].isFinal) {
          interimText += event.results[i][0].transcript;
        }
      }

      // Mettre à jour uniquement avec final + interim courant
      finalTranscriptRef.current = finalText.trim();
      setTranscript((finalText + interimText).trim());
    };

    recognition.onstart = () => {
      finalText = '';
      setTranscript('');
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      console.error('Speech error:', event.error);
      if (event.error === 'not-allowed') {
        toast({
          variant: 'destructive',
          title: '🎤 إذن الميكروفون مرفوض',
          description: 'افتح إعدادات المتصفح وفعّل الميكروفون لـ anafypro.com',
        });
        return;
      }
      toast({
        variant: 'destructive',
        title: 'خطأ في الميكروفون: ' + event.error,
      });
    };

    recognition.onend = () => {
      if (isRecordingRef.current && recognitionRef.current === recognition) {
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
    } catch (err) {
      console.error('Failed to start recognition:', err);
      isRecordingRef.current = false;
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
  }, [cleanup, isSupported, lang, stopRecording, toast]);

  const getCleanedText = useCallback((): string => {
    return (finalTranscriptRef.current || transcript).trim();
  }, [transcript]);

  const cancel = useCallback(() => {
    cleanup();
    finalTranscriptRef.current = '';
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
