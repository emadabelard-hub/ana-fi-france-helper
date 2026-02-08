import React from 'react';
import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  isRTL?: boolean;
}

const TypingIndicator = ({ isRTL = false }: TypingIndicatorProps) => {
  return (
    <div className={cn(
      "flex gap-2 p-4 bg-card rounded-2xl w-fit shadow-sm border border-border",
      isRTL ? "rounded-tr-none ml-10" : "rounded-tl-none mr-10"
    )}>
      <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
};

export default TypingIndicator;
