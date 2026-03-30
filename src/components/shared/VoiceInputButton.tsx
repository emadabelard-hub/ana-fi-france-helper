import React, { useCallback } from 'react';
import { Loader2, Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFieldVoice } from '@/hooks/useFieldVoice';

interface VoiceInputButtonProps {
  onResult: (text: string) => void;
  className?: string;
  disabled?: boolean;
}

const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onResult,
  className,
  disabled,
}) => {
  const { isRecording, isProcessing, start, stop, isSupported } = useFieldVoice();

  const toggle = useCallback(async () => {
    if (isProcessing) return;

    if (isRecording) {
      const text = await stop();
      if (text.trim()) onResult(text.trim());
      return;
    }

    await start();
  }, [isProcessing, isRecording, onResult, start, stop]);

  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || isProcessing}
      aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
      className={cn(
        'flex-shrink-0 p-1.5 rounded-full transition-all duration-200',
        'hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isRecording
          ? 'text-destructive animate-pulse bg-destructive/10'
          : 'text-muted-foreground hover:text-foreground',
        (disabled || isProcessing) && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      {isProcessing ? (
        <Loader2 size={16} className="animate-spin" />
      ) : isRecording ? (
        <MicOff size={16} />
      ) : (
        <Mic size={16} />
      )}
    </button>
  );
};

export default VoiceInputButton;
