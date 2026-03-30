import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

/**
 * Field-level voice input using real audio recording.
 * Records audio, sends it to backend multilingual STT + AI cleanup,
 * then returns only the final professional French text.
 */
export function useFieldVoice() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeTypeRef = useRef('audio/webm');

  const isSupported =
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';

  const cleanup = useCallback(() => {
    mediaRecorderRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    chunksRef.current = [];
    setIsRecording(false);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    if (!isSupported || isRecording || isProcessing) return false;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const mimeType = pickSupportedMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

    mimeTypeRef.current = recorder.mimeType || mimeType || 'audio/webm';
    mediaStreamRef.current = stream;
    mediaRecorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.start();
    setIsRecording(true);
    return true;
  }, [isSupported, isRecording, isProcessing]);

  const stop = useCallback(async (): Promise<string> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return '';

    setIsProcessing(true);

    const blob = await new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        resolve(new Blob(chunksRef.current, { type: mimeTypeRef.current }));
      };
      recorder.onerror = () => reject(new Error('Audio recording failed'));
      recorder.stop();
    });

    cleanup();

    if (!blob.size) {
      setIsProcessing(false);
      return '';
    }

    try {
      const audioBase64 = await blobToBase64(blob);
      const { data, error } = await supabase.functions.invoke('voice-field-input', {
        body: {
          audioBase64,
          mimeType: blob.type || mimeTypeRef.current,
        },
      });

      if (error) {
        throw new Error(error.message || 'Voice processing failed');
      }

      return typeof data?.text === 'string' ? data.text.trim() : '';
    } finally {
      setIsProcessing(false);
    }
  }, [cleanup]);

  return { isRecording, isProcessing, start, stop, isSupported };
}
