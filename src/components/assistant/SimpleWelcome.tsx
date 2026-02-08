import React from 'react';
import { cn } from '@/lib/utils';
import { Sparkles, ChevronRight, User, FileText, Mail } from 'lucide-react';

interface ActionItem {
  label: string;
  type: string;
  icon?: React.ReactNode;
}

interface SimpleWelcomeProps {
  isRTL: boolean;
  actions: ActionItem[];
  onActionClick: (action: ActionItem) => void;
}

const SimpleWelcome = ({ isRTL, actions, onActionClick }: SimpleWelcomeProps) => {
  // Short, friendly welcome message
  const welcomeText = "شبيك لبيك 🧞‍♂️\nاسأل وانا اجاوب";

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

  return (
    <div className="flex flex-col items-start animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* AI Avatar */}
      <div className="flex items-start gap-2 mb-1">
        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
          <Sparkles size={14} className="text-primary" />
        </div>
      </div>

      {/* Welcome Message Bubble */}
      <div
        className={cn(
          "max-w-[85%] p-3.5 rounded-2xl text-[13px] leading-relaxed shadow-sm ml-10",
          "bg-card text-card-foreground border border-border rounded-bl-none",
          "font-cairo text-right whitespace-pre-wrap"
        )}
      >
        {welcomeText}
      </div>

      {/* Action Buttons - Stacked Cards Style */}
      <div className="flex flex-col gap-2 mt-3 ml-10 w-[85%]">
        {actions.map((action, idx) => (
          <button
            key={idx}
            onClick={() => onActionClick(action)}
            className={cn(
              "flex items-center justify-between w-full",
              "bg-[hsl(226,76%,94%)] text-[hsl(243,75%,49%)]",
              "p-3 rounded-xl border border-[hsl(228,90%,86%)] shadow-sm",
              "active:scale-[0.98] transition-transform",
              "font-cairo"
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
    </div>
  );
};

export default SimpleWelcome;
