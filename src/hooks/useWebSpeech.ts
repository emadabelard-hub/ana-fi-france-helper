import { useState, useCallback, useRef } from 'react';

// ─── TTS (Text-to-Speech) ───
export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback((text: string, lang = 'fr-FR') => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = lang;
    utt.rate = 0.85;
    utt.pitch = 1;

    // Try to pick a French voice
    const voices = window.speechSynthesis.getVoices();
    const frVoice = voices.find(v => v.lang.startsWith('fr'));
    if (frVoice) utt.voice = frVoice;

    utt.onstart = () => setIsSpeaking(true);
    utt.onend = () => setIsSpeaking(false);
    utt.onerror = () => setIsSpeaking(false);
    utteranceRef.current = utt;

    window.speechSynthesis.speak(utt);
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking, isSupported: typeof window !== 'undefined' && 'speechSynthesis' in window };
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
