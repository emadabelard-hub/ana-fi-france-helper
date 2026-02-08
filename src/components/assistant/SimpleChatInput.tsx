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
      <form
        onSubmit={handleSubmit}
        className={cn(
          "flex items-center gap-2 bg-muted p-1.5 rounded-[2rem] border border-border",
          "focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10 transition-all"
        )}
      >
        {/* Emoji button (decorative) */}
        <div className="p-2 bg-card rounded-full shadow-sm text-muted-foreground">
          <Smile size={20} />
        </div>

        {/* Input field */}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder || defaultPlaceholder}
          disabled={isLoading}
          className={cn(
            "flex-1 bg-transparent text-sm font-medium px-2 outline-none",
            "text-foreground placeholder:text-muted-foreground",
            isRTL && "font-cairo text-right"
          )}
          dir="auto"
        />

        {/* Send button */}
        <button
          type="submit"
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
      </form>

      <style>{`
        .safe-area-bottom { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
    </div>
  );
};

export default SimpleChatInput;
