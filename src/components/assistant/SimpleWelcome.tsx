import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight, User, FileText, Mail } from 'lucide-react';

interface ActionItem {
  label: string;
  type: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}

interface SimpleWelcomeProps {
  isRTL: boolean;
  actions: ActionItem[];
  onActionClick: (action: ActionItem) => void;
}

// Icon mapping for action types
const getIcon = (type: string) => {
  switch (type) {
    case 'cv':
      return <User size={20} />;
    case 'invoice-edit':
      return <FileText size={20} />;
    case 'mail-reply':
      return <Mail size={20} />;
    default:
      return null;
  }
};

const SimpleWelcome = ({ isRTL, actions, onActionClick }: SimpleWelcomeProps) => {
  return (
    <div className="w-full animate-in slide-in-from-bottom-10 fade-in duration-700">
      {/* Grande carte de bienvenue colorée */}
      <div className="bg-gradient-to-br from-primary to-[hsl(280,70%,50%)] p-8 rounded-[2.5rem] shadow-2xl text-center text-primary-foreground relative overflow-hidden border border-white/20">
        {/* Décorations de fond */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-2xl -ml-5 -mb-5" />
        
        <div className="relative z-10">
          <h2 className="text-3xl font-black mb-2 font-cairo drop-shadow-md">شبيك لبيك 🧞‍♂️</h2>
          <p className="text-lg font-bold opacity-90 mb-8 font-cairo text-primary-foreground/80">اسأل وانا اجاوب</p>

          <div className="space-y-3">
            {actions.map((action, index) => {
              const isHighlighted = action.highlight || index === 0;
              return (
                <button
                  key={index}
                  onClick={() => onActionClick(action)}
                  className={cn(
                    "w-full flex items-center justify-between p-4 rounded-2xl shadow-lg active:scale-95 transition-all",
                    isHighlighted
                      ? "bg-white text-primary border-2 border-white"
                      : "bg-white/10 text-primary-foreground border border-white/20 hover:bg-white/20"
                  )}
                >
                  <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
                    <div className={cn(
                      "p-2 rounded-xl",
                      isHighlighted ? "bg-primary/10 text-primary" : "bg-white/20 text-primary-foreground"
                    )}>
                      {action.icon || getIcon(action.type)}
                    </div>
                    <span className="font-bold text-sm font-cairo">{action.label}</span>
                  </div>
                  <ChevronRight size={18} className={isHighlighted ? "text-primary" : "text-primary-foreground/70"} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleWelcome;
