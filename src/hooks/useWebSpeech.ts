import { useState, useCallback, useRef } from 'react';

// ─── TTS (Text-to-Speech) via OpenAI API with browser fallback ───
export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speak = useCallback(async (text: string, lang = 'fr-FR') => {
    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis?.cancel();

    setIsLoading(true);
    setIsSpeaking(false);

    try {
      // Try OpenAI TTS first
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase config');

      const response = await fetch(`${supabaseUrl}/functions/v1/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ text, voice: 'nova' }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error('OpenAI TTS error:', response.status, errBody);
        throw new Error(`TTS request failed: ${response.status}`);
      }

      const audioBlob = await response.blob();
      if (audioBlob.size < 100) throw new Error('Empty audio response');

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onplay = () => {
        setIsLoading(false);
        setIsSpeaking(true);
      };
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        setIsLoading(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
      };

      audioRef.current = audio;
      await audio.play();
    } catch (e) {
      console.error('OpenAI TTS failed:', e);
      setIsLoading(false);
      setIsSpeaking(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis?.cancel();
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
