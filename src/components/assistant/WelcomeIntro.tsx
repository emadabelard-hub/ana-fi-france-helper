import React from 'react';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

interface WelcomeIntroProps {
  isRTL: boolean;
  quickActions: string[];
  onQuickAction: (action: string) => void;
}

const WelcomeIntro = ({ isRTL, quickActions, onQuickAction }: WelcomeIntroProps) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 animate-in fade-in duration-500">
      {/* AI Avatar */}
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Sparkles size={24} className="text-primary" />
      </div>

      {/* Welcome Message Bubble */}
      <div className={cn(
        "bg-card p-5 rounded-2xl shadow-sm border border-border max-w-sm w-full mb-4",
        isRTL ? "text-right font-cairo rounded-tr-none" : "text-left rounded-tl-none"
      )}>
        <p className="text-sm font-medium text-card-foreground leading-relaxed">
          {isRTL 
            ? "أهلاً! أنا مساعدك Ana Fi France. أقدر أساعدك في حقوقك، فواتيرك، أو أي إجراءات إدارية. إيه اللي محتاج مساعدة فيه النهارده؟"
            : "Bonjour ! Je suis ton assistant Ana Fi France. Je peux t'aider sur tes droits, tes devis ou tes démarches. Quel est ton souci aujourd'hui ?"}
        </p>
      </div>

      {/* Quick Action Suggestions */}
      <div className="flex flex-wrap gap-2 justify-center max-w-sm">
        {quickActions.map((action, i) => (
          <button
            key={i}
            onClick={() => onQuickAction(action)}
            className={cn(
              "bg-card text-primary px-4 py-2 rounded-xl text-xs font-bold border border-primary/20 shadow-sm",
              "active:scale-95 transition-transform hover:bg-primary/5",
              isRTL && "font-cairo"
            )}
          >
            {action}
          </button>
        ))}
      </div>
    </div>
  );
};

export default WelcomeIntro;
