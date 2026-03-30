import React, { useCallback, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFieldVoice } from '@/hooks/useFieldVoice';

interface VoiceInputButtonProps {
  /** Called with corrected text when recording stops */
  onResult: (text: string) => void;
  /** Called with interim text while recording */
  onInterim?: (text: string) => void;
  lang?: string;
  className?: string;
  disabled?: boolean;
}

const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onResult,
  onInterim,
  lang = 'fr-FR',
  className,
  disabled,
}) => {
  const { isListening, start, stop, isSupported } = useFieldVoice(lang);
  const onInterimRef = useRef(onInterim);
  onInterimRef.current = onInterim;

  const toggle = useCallback(() => {
    if (isListening) {
      const text = stop();
      if (text.trim()) onResult(text.trim());
    } else {
      start((interim) => onInterimRef.current?.(interim));
    }
  }, [isListening, start, stop, onResult]);

  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-label={isListening ? 'Stop recording' : 'Start voice input'}
      className={cn(
        'flex-shrink-0 p-1.5 rounded-full transition-all duration-200',
        'hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isListening
          ? 'text-destructive animate-pulse bg-destructive/10'
          : 'text-muted-foreground hover:text-foreground',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      {isListening ? <MicOff size={16} /> : <Mic size={16} />}
    </button>
  );
};

export default VoiceInputButton;
