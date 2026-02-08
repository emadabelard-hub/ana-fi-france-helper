import React from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, Sparkles } from 'lucide-react';

interface ActionItem {
  label: string;
  type: string; // route type: 'cv', 'invoice-edit', 'home', or custom message
}

interface SimpleChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isRTL?: boolean;
  actions?: ActionItem[];
  onActionClick?: (action: ActionItem) => void;
}

const SimpleChatMessage = ({
  role,
  content,
  isRTL = false,
  actions = [],
  onActionClick,
}: SimpleChatMessageProps) => {
  const isUser = role === 'user';
  const isArabic = (text: string) => /[\u0600-\u06FF]/.test(text);
  const textIsArabic = isArabic(content);

  return (
    <div className={cn("flex flex-col", isUser ? "items-end" : "items-start")}>
      {/* Avatar for AI messages */}
      {!isUser && (
        <div className="flex items-start gap-2 mb-1">
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
            <Sparkles size={14} className="text-primary" />
          </div>
        </div>
      )}

      {/* Message Bubble */}
      <div
        className={cn(
          "max-w-[85%] p-3.5 rounded-2xl text-[13px] leading-relaxed shadow-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-none"
            : "bg-card text-card-foreground border border-border rounded-bl-none",
          textIsArabic ? "font-cairo text-right" : "text-left",
          !isUser && "ml-10" // Offset to align with avatar
        )}
      >
        {content}
      </div>

      {/* Action Buttons (only for AI messages) */}
      {!isUser && actions.length > 0 && onActionClick && (
        <div className="flex flex-wrap gap-2 mt-2 ml-10">
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => onActionClick(action)}
              className={cn(
                "bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20",
                "px-4 py-2 rounded-full text-[11px] font-bold transition-colors",
                "flex items-center gap-1.5 active:scale-95",
                isArabic(action.label) && "flex-row-reverse font-cairo"
              )}
            >
              {action.label}
              <ArrowRight size={12} className={cn(isArabic(action.label) && "rotate-180")} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SimpleChatMessage;
