import { cn } from '@/lib/utils';
import { User, Bot, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isRTL?: boolean;
}

const ChatMessage = ({ role, content, isRTL = true }: ChatMessageProps) => {
  const [copied, setCopied] = useState(false);
  const isUser = role === 'user';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore copy errors
    }
  };

  return (
    <div
      className={cn(
        "flex gap-3 p-4 rounded-xl",
        isUser 
          ? "bg-primary/10 ml-8" 
          : "bg-muted/50 mr-8",
        isRTL && "flex-row-reverse"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-2">
        <div
          className={cn(
            "text-sm leading-relaxed whitespace-pre-wrap",
            isRTL && "text-right font-cairo"
          )}
          dir={isRTL ? "rtl" : "ltr"}
        >
          {content}
        </div>

        {/* Copy button for assistant messages */}
        {!isUser && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className={cn("h-7 text-xs gap-1", isRTL && "flex-row-reverse")}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                <span className={isRTL ? "font-cairo" : ""}>
                  {isRTL ? "تم النسخ" : "Copié"}
                </span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span className={isRTL ? "font-cairo" : ""}>
                  {isRTL ? "نسخ" : "Copier"}
                </span>
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
