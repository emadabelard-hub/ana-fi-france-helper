import React, { useEffect, useRef } from 'react';
import { Mic, Send, Square, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FullscreenVoiceModalProps {
  open: boolean;
  isRecording: boolean;
  transcript: string;
  duration: number;
  onStop: () => void;
  onSend: () => void;
  onCancel: () => void;
  isRTL?: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const FullscreenVoiceModal: React.FC<FullscreenVoiceModalProps> = ({
  open,
  isRecording,
  transcript,
  duration,
  onStop,
  onSend,
  onCancel,
  isRTL = false,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll while transcript grows
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const placeholder = isRTL ? 'تكلم الآن...' : 'Parlez...';
  const stopLabel = isRTL ? 'إيقاف' : 'Stop';
  const sendLabel = isRTL ? 'إرسال' : 'Envoyer';
  const headerTitle = isRTL ? 'الإملاء الصوتي' : 'Dictée vocale';
  const liveHint = isRecording
    ? (isRTL ? '🔴 جاري التسجيل...' : '🔴 Enregistrement...')
    : (isRTL ? '⏸ متوقف' : '⏸ En pause');

  return (
    <div
      className="fixed inset-0 z-[100] bg-background flex flex-col"
      role="dialog"
      aria-modal="true"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center",
            isRecording ? "bg-blue-500 animate-pulse shadow-lg shadow-blue-500/40" : "bg-muted"
          )}>
            <Mic size={18} className={isRecording ? "text-white" : "text-muted-foreground"} />
          </div>
          <div className="flex flex-col">
            <h2 className={cn("text-base font-bold text-foreground leading-tight", isRTL && "font-cairo")}>
              {headerTitle}
            </h2>
            <span className={cn("text-xs text-muted-foreground", isRTL && "font-cairo")}>
              {liveHint} · <span className="font-mono tabular-nums">{formatDuration(duration)}</span>
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label={isRTL ? 'إلغاء' : 'Annuler'}
          className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
        >
          <X size={22} />
        </button>
      </header>

      {/* Transcript area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 py-6"
      >
        {transcript ? (
          <p
            className={cn(
              "text-xl md:text-2xl leading-relaxed text-foreground whitespace-pre-wrap break-words",
              isRTL && "font-cairo text-right"
            )}
            dir="auto"
          >
            {transcript}
          </p>
        ) : (
          <p
            className={cn(
              "text-xl md:text-2xl leading-relaxed text-muted-foreground/70 italic",
              isRTL && "font-cairo text-right"
            )}
            dir="auto"
          >
            {placeholder}
          </p>
        )}
      </div>

      {/* Bottom action bar */}
      <div
        className="border-t border-border bg-card px-4 py-4 shrink-0"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center gap-3 max-w-md mx-auto">
          <button
            type="button"
            onClick={onStop}
            disabled={!isRecording}
            className={cn(
              "flex-1 h-14 rounded-2xl flex items-center justify-center gap-2 font-bold text-base transition-all active:scale-95",
              isRecording
                ? "bg-destructive/10 text-destructive border-2 border-destructive/30 hover:bg-destructive/20"
                : "bg-muted text-muted-foreground border-2 border-transparent cursor-not-allowed",
              isRTL && "font-cairo"
            )}
          >
            <Square size={20} />
            {stopLabel}
          </button>
          <button
            type="button"
            onClick={onSend}
            disabled={!transcript.trim()}
            className={cn(
              "flex-1 h-14 rounded-2xl flex items-center justify-center gap-2 font-bold text-base transition-all active:scale-95 shadow-md",
              transcript.trim()
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "bg-muted text-muted-foreground shadow-none cursor-not-allowed",
              isRTL && "font-cairo"
            )}
          >
            <Send size={20} />
            {sendLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FullscreenVoiceModal;
