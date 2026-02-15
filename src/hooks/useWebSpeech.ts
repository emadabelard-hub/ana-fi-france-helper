import { useState, useCallback, useRef } from 'react';
import { playTTS, stopGlobalAudio } from '@/lib/audioController';

// ─── TTS (Text-to-Speech) via Global Audio Controller (OpenAI only) ───
export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const activeIdRef = useRef(0); // track which request is active

  const speak = useCallback(async (text: string) => {
    // Cancel any previous request
    stopGlobalAudio();
    const id = ++activeIdRef.current;

    setIsLoading(true);
    setIsSpeaking(false);

    try {
      if (id !== activeIdRef.current) return; // stale
      setIsLoading(false);
      setIsSpeaking(true);
      await playTTS(text, 'nova');
    } catch (e) {
      console.error('TTS error:', e);
    } finally {
      if (id === activeIdRef.current) {
        setIsSpeaking(false);
        setIsLoading(false);
      }
    }
  }, []);

  const stop = useCallback(() => {
    activeIdRef.current++; // invalidate any in-flight request
    stopGlobalAudio();
    setIsSpeaking(false);
    setIsLoading(false);
  }, []);

  return { speak, stop, isSpeaking, isLoading, isSupported: true };
}

// ─── STT (Speech-to-Text) ───
export type AccuracyLevel = 'high' | 'medium' | 'low' | null;

function normalise(s: string) {
  return s.toLowerCase().replace(/[''.,!?;:«»""\-]/g, '').replace(/\s+/g, ' ').trim();
}

function scoreAccuracy(spoken: string, target: string): AccuracyLevel {
  const a = normalise(spoken);
  const b = normalise(target);
  if (a === b) return 'high';

  const wordsTarget = b.split(' ');
  const wordsSpoken = a.split(' ');
  const matched = wordsTarget.filter(w => wordsSpoken.includes(w)).length;
  const ratio = matched / wordsTarget.length;
  if (ratio >= 0.7) return 'medium';
  return 'low';
}

export function useSTT() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [accuracy, setAccuracy] = useState<AccuracyLevel>(null);
  const recognitionRef = useRef<any>(null);

  const isSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const listen = useCallback((targetSentence: string, lang = 'fr-FR') => {
    if (!isSupported) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsListening(true);
      setAccuracy(null);
      setTranscript('');
    };
    recognition.onresult = (event: any) => {
      const spoken = event.results[0][0].transcript as string;
      setTranscript(spoken);
      setAccuracy(scoreAccuracy(spoken, targetSentence));
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setAccuracy(null);
  }, []);

  return { listen, stopListening, isListening, transcript, accuracy, reset, isSupported };
}
