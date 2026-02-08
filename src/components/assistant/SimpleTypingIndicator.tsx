import React from 'react';
import { cn } from '@/lib/utils';

interface SimpleTypingIndicatorProps {
  isRTL?: boolean;
}

const SimpleTypingIndicator = ({ isRTL = false }: SimpleTypingIndicatorProps) => {
  return (
    <div className="flex items-start gap-2">
      {/* Align with avatar position */}
      <div className="w-8 h-8 shrink-0" />
      
      <div className={cn(
        "flex items-center gap-1 p-3 bg-card rounded-2xl rounded-bl-none border border-border w-fit"
      )}>
        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '75ms' }} />
        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      </div>
    </div>
  );
};

export default SimpleTypingIndicator;
