import React from 'react';
import { cn } from '@/lib/utils';
import { Sparkles, ArrowRight } from 'lucide-react';

interface ActionItem {
  label: string;
  type: string;
}

interface SimpleWelcomeProps {
  isRTL: boolean;
  actions: ActionItem[];
  onActionClick: (action: ActionItem) => void;
}

const SimpleWelcome = ({ isRTL, actions, onActionClick }: SimpleWelcomeProps) => {
  const welcomeText = isRTL
    ? "أهلاً! 👋 أنا هنا عشان أساعدك. محتاج مساعدة في دوفي، CV، أو مشكلة في الشانتي؟"
    : "Salut ! 👋 Je suis là pour t'aider. Tu as besoin d'un coup de main pour un devis, un CV ou un souci de chantier ?";

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
          isRTL ? "font-cairo text-right" : "text-left"
        )}
      >
        {welcomeText}
      </div>

      {/* Quick Action Buttons */}
      <div className="flex flex-wrap gap-2 mt-3 ml-10">
        {actions.map((action, idx) => (
          <button
            key={idx}
            onClick={() => onActionClick(action)}
            className={cn(
              "bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20",
              "px-4 py-2 rounded-full text-[11px] font-bold transition-colors",
              "flex items-center gap-1.5 active:scale-95",
              isRTL && "flex-row-reverse font-cairo"
            )}
          >
            {action.label}
            <ArrowRight size={12} className={cn(isRTL && "rotate-180")} />
          </button>
        ))}
      </div>
    </div>
  );
};

export default SimpleWelcome;
