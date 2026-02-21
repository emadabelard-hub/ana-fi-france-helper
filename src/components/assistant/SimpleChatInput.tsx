import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Send, Smile } from 'lucide-react';

interface SimpleChatInputProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
  isRTL?: boolean;
  placeholder?: string;
}

const SimpleChatInput = ({
  onSend,
  isLoading = false,
  isRTL = false,
  placeholder,
}: SimpleChatInputProps) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput('');
  };

  const defaultPlaceholder = isRTL ? "اكتب رسالتك..." : "Écris ton message...";

  return (
    <div className="p-3 bg-background border-t border-border safe-area-bottom">
      <div
        className={cn(
          "flex items-center gap-2 bg-muted p-1.5 rounded-[2rem] border border-border",
          "focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10 transition-all"
        )}
      >
        {/* Emoji button (decorative) */}
        <div className="p-2 bg-card rounded-full shadow-sm text-muted-foreground">
          <Smile size={20} />
        </div>

        {/* Textarea field */}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // Enter always creates a new line, never sends
            if (e.key === 'Enter') {
              e.stopPropagation();
            }
          }}
          placeholder={placeholder || defaultPlaceholder}
          disabled={isLoading}
          className={cn(
            "flex-1 bg-transparent text-sm font-medium px-2 outline-none resize-none min-h-[36px] max-h-[120px] py-2",
            "text-foreground placeholder:text-muted-foreground",
            isRTL && "font-cairo text-right"
          )}
          dir="auto"
          rows={1}
          onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px'; }}
        />

        {/* Send button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!input.trim() || isLoading}
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center shadow-md",
            "active:scale-90 transition-all",
            input.trim() && !isLoading
              ? "bg-primary text-primary-foreground"
              : "bg-muted-foreground/20 text-muted-foreground"
          )}
        >
          <Send size={18} className={input.trim() ? "ml-0.5" : ""} />
        </button>
      </div>

      <style>{`
        .safe-area-bottom { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
    </div>
  );
};

export default SimpleChatInput;
