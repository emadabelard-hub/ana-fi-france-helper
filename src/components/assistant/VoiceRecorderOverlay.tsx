import React, { useRef, useCallback } from 'react';
import { Mic, Send, X, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceRecorderOverlayProps {
  isRecording: boolean;
  isLocked: boolean;
  transcript: string;
  duration: number;
  onSend: () => void;
  onCancel: () => void;
  onLock: () => void;
  isRTL?: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const VoiceRecorderOverlay: React.FC<VoiceRecorderOverlayProps> = ({
  isRecording,
  isLocked,
  transcript,
  duration,
  onSend,
  onCancel,
  onLock,
  isRTL = false,
}) => {
  if (!isRecording) return null;

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-background/95 backdrop-blur-sm rounded-[2rem] border border-blue-500/30 overflow-hidden">
      {/* Top: transcript preview */}
      <div className="flex-1 px-4 py-3 overflow-y-auto min-h-0">
        {transcript ? (
          <p className={cn(
            "text-sm text-foreground font-cairo leading-relaxed",
            isRTL && "text-right"
          )} dir="auto">
            {transcript}
          </p>
        ) : (
          <p className={cn(
            "text-sm text-muted-foreground font-cairo",
            isRTL && "text-right"
          )} dir="auto">
            {isRTL ? 'تكلم الآن...' : 'Parlez maintenant...'}
          </p>
        )}
      </div>

      {/* Bottom bar: cancel | mic animation + timer | lock/send */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-border/50">
        {/* Cancel button */}
        <button
          type="button"
          onClick={onCancel}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
        >
          <X size={20} />
        </button>

        {/* Center: mic + timer */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center animate-pulse shadow-lg shadow-blue-500/40">
              <Mic size={20} className="text-white" />
            </div>
            {/* Pulsing ring */}
            <div className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-30" />
          </div>
          <span className="text-sm font-mono font-bold text-foreground min-w-[3rem] tabular-nums">
            {formatDuration(duration)}
          </span>
        </div>

        {/* Right: Lock or Send */}
        <div className="flex items-center gap-1.5">
          {!isLocked && (
            <button
              type="button"
              onClick={onLock}
              className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title={isRTL ? 'تثبيت التسجيل' : 'Verrouiller'}
            >
              <Lock size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={onSend}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-500 text-white shadow-md hover:bg-blue-600 active:scale-90 transition-all"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceRecorderOverlay;
