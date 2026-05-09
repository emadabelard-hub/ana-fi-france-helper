import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

/**
 * Dictation hook dedicated to "مساعد الشانتي الذكي".
 * Uses MediaRecorder + voice-field-input edge function (Whisper),
 * exactly like the translator. Web SpeechRecognition is abandoned
 * because it causes repetitions on Android Chrome.
 */

const MAX_DURATION_MS = 120_000;

function pickSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  for (const mimeType of candidates) {
    if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }
  return '';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.includes(',') ? result.split(',')[1] ?? '' : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Audio read failed'));
    reader.readAsDataURL(blob);
  });
}

export function useAssistantDictation(_lang: 'fr-FR' | 'ar-EG' = 'ar-EG') {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [duration, setDuration] = useState(0);
  const { toast } = useToast();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeTypeRef = useRef('audio/webm');

  const finalTranscriptRef = useRef('');
  const isRecordingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef(0);

  const isSupported =
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const cleanup = useCallback(() => {
    clearTimers();
    releaseStream();
    isRecordingRef.current = false;
    setIsRecording(false);
    setDuration(0);
  }, [clearTimers, releaseStream]);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    if (isRecordingRef.current) return false;

    cleanup();
    finalTranscriptRef.current = '';
    setTranscript('');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err: any) {
      console.error('Microphone permission error:', err);
      if (err?.name === 'NotAllowedError') {
        toast({
          variant: 'destructive',
          title: '🎤 إذن الميكروفون مرفوض',
          description: 'افتح إعدادات المتصفح وفعّل الميكروفون لـ anafypro.com',
        });
      }
      return false;
    }

    const mimeType = pickSupportedMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

    mimeTypeRef.current = recorder.mimeType || mimeType || 'audio/webm';
    mediaStreamRef.current = stream;
    mediaRecorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    try {
      recorder.start();
    } catch (err) {
      console.error('Failed to start recorder:', err);
      releaseStream();
      return false;
    }

    isRecordingRef.current = true;
    setIsRecording(true);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 500);
    maxTimerRef.current = setTimeout(() => {
      // Auto-stop after max duration
      void stopRecording();
    }, MAX_DURATION_MS);

    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupported, cleanup, releaseStream, toast]);

  const stopRecording = useCallback(async (): Promise<string> => {
    const recorder = mediaRecorderRef.current;
    isRecordingRef.current = false;
    setIsRecording(false);
    clearTimers();

    if (!recorder) {
      return (finalTranscriptRef.current || '').trim();
    }

    let blob: Blob;
    try {
      blob = await new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => {
          resolve(new Blob(chunksRef.current, { type: mimeTypeRef.current }));
        };
        recorder.onerror = () => reject(new Error('Audio recording failed'));
        try {
          recorder.stop();
        } catch (err) {
          reject(err);
        }
      });
    } catch (err) {
      console.error('Recorder stop error:', err);
      releaseStream();
      return (finalTranscriptRef.current || '').trim();
    }

    releaseStream();

    if (!blob.size) {
      return (finalTranscriptRef.current || '').trim();
    }

    try {
      const audioBase64 = await blobToBase64(blob);
      const { data, error } = await supabase.functions.invoke('voice-field-input', {
        body: {
          audioBase64,
          mimeType: blob.type || mimeTypeRef.current,
          dualMode: false,
          transcribeOnly: true,
          language: 'ar',
        },
      });
      if (error) {
        console.error('voice-field-input error:', error);
        return (finalTranscriptRef.current || '').trim();
      }
      const text =
        (typeof data?.text === 'string' && data.text.trim()) ||
        (typeof data?.raw === 'string' && data.raw.trim()) ||
        '';
      finalTranscriptRef.current = text;
      setTranscript(text);
      return text;
    } catch (err) {
      console.error('Voice processing failed:', err);
      return (finalTranscriptRef.current || '').trim();
    }
  }, [clearTimers, releaseStream]);

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
