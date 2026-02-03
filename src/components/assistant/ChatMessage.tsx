import { cn } from '@/lib/utils';
import { User, Bot, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useMemo } from 'react';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isRTL?: boolean;
}

/**
 * Detects if content contains a French formal letter section.
 * Letters are marked with ===الرسالة_الرسمية=== or contain formal French patterns.
 */
const containsFrenchLetter = (content: string): boolean => {
  // Check for letter marker from AI output
  if (content.includes('===الرسالة_الرسمية===')) return true;
  // Check for common French formal letter patterns
  const frenchPatterns = [
    /Madame,?\s*Monsieur/i,
    /Je soussigné/i,
    /Veuillez agréer/i,
    /salutations distinguées/i,
    /l'expression de mes/i,
    /Objet\s*:/i,
    /À l'attention de/i,
  ];
  return frenchPatterns.some(pattern => pattern.test(content));
};

/**
 * Splits content into Arabic explanation and French letter sections.
 */
const parseContent = (content: string): { arabic: string; frenchLetter: string | null } => {
  const letterMarker = '===الرسالة_الرسمية===';
  const nextMarker = /===[\u0600-\u06FF_]+===/g;
  
  if (content.includes(letterMarker)) {
    const parts = content.split(letterMarker);
    const arabicPart = parts[0].trim();
    let frenchPart = parts[1] || '';
    
    // Remove any following markers (like ===ملاحظات_قانونية===)
    const nextMatch = frenchPart.match(nextMarker);
    if (nextMatch) {
      frenchPart = frenchPart.split(nextMatch[0])[0];
    }
    
    return {
      arabic: arabicPart,
      frenchLetter: frenchPart.trim() || null,
    };
  }
  
  return { arabic: content, frenchLetter: null };
};

const ChatMessage = ({ role, content, isRTL = true }: ChatMessageProps) => {
  const [copied, setCopied] = useState(false);
  const isUser = role === 'user';

  // Parse content to separate Arabic from French letter
  const { arabic, frenchLetter } = useMemo(() => parseContent(content), [content]);
  const hasFrenchContent = frenchLetter !== null || (!isUser && containsFrenchLetter(content));

  const handleCopy = async (textToCopy?: string) => {
    try {
      await navigator.clipboard.writeText(textToCopy || content);
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
      <div className="flex-1 space-y-3">
        {/* Arabic/RTL content */}
        {arabic && (
          <div
            className={cn(
              "text-sm leading-relaxed whitespace-pre-wrap",
              isRTL && "text-right font-cairo"
            )}
            dir={isRTL ? "rtl" : "ltr"}
          >
            {arabic}
          </div>
        )}

        {/* French Letter Section - professionally formatted */}
        {frenchLetter && (
          <div className="mt-4 border-t border-border pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className={cn(
                "text-xs font-medium text-muted-foreground",
                isRTL && "font-cairo"
              )}>
                {isRTL ? "📄 الخطاب الرسمي (بالفرنسية)" : "📄 Lettre officielle"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(frenchLetter)}
                className="h-6 text-xs gap-1"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                <span>{isRTL ? "نسخ الخطاب" : "Copier"}</span>
              </Button>
            </div>
            <div
              dir="ltr"
              lang="fr"
              className="french-letter bg-white text-black p-4 rounded-lg border shadow-sm"
            >
              <div className="whitespace-pre-wrap">{frenchLetter}</div>
            </div>
          </div>
        )}

        {/* Copy button for assistant messages (whole message) */}
        {!isUser && !frenchLetter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleCopy()}
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
