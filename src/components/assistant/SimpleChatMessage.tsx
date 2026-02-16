import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight, Sparkles, User, FileText, Mail } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

interface ActionItem {
  label: string;
  type: string; // route type: 'cv', 'invoice-edit', 'mail-reply', 'home', or custom message
  icon?: React.ReactNode;
}

interface SimpleChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isRTL?: boolean;
  actions?: ActionItem[];
  onActionClick?: (action: ActionItem) => void;
}

// Icon mapping for action types
const getIcon = (type: string) => {
  switch (type) {
    case 'cv':
      return <User size={18} />;
    case 'invoice-edit':
      return <FileText size={18} />;
    case 'mail-reply':
      return <Mail size={18} />;
    default:
      return null;
  }
};

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
          "max-w-[85%] p-3.5 rounded-2xl shadow-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-none text-[13px] leading-relaxed whitespace-pre-wrap"
            : "bg-card text-card-foreground border border-border rounded-bl-none",
          isUser && textIsArabic ? "font-cairo text-right" : isUser ? "text-left" : "",
          !isUser && "ml-10"
        )}
      >
        {isUser ? content : (
          <MarkdownRenderer content={content} isRTL={textIsArabic} />
        )}
      </div>

      {/* Action Buttons - Stacked Cards Style (only for AI messages) */}
      {!isUser && actions.length > 0 && onActionClick && (
        <div className="flex flex-col gap-2 mt-2 ml-10 w-[85%]">
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => onActionClick(action)}
              className={cn(
                "flex items-center justify-between w-full",
                "bg-[hsl(226,76%,94%)] text-[hsl(243,75%,49%)]",
                "p-3 rounded-xl border border-[hsl(228,90%,86%)] shadow-sm",
                "active:scale-[0.98] transition-transform",
                isArabic(action.label) && "font-cairo"
              )}
            >
              <div className="flex items-center gap-3">
                {action.icon || getIcon(action.type)}
                <span className="font-bold text-xs">{action.label}</span>
              </div>
              <ChevronRight size={16} className="opacity-50" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SimpleChatMessage;
