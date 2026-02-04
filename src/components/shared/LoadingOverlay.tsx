import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingOverlayProps {
  isVisible: boolean;
  text?: string;
  subText?: string;
  isRTL?: boolean;
}

/**
 * Full-screen loading overlay with pulsing spinner
 * Used during document analysis to prevent blank screens
 */
const LoadingOverlay = ({ isVisible, text, subText, isRTL = false }: LoadingOverlayProps) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className={cn(
        "flex flex-col items-center gap-4 p-8 rounded-2xl bg-card shadow-xl border",
        isRTL && "font-cairo"
      )}>
        {/* Pulsing spinner */}
        <div className="relative">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <div className="absolute inset-0 h-12 w-12 animate-ping opacity-20 rounded-full bg-primary" />
        </div>
        
        {/* Loading text */}
        {text && (
          <p className={cn(
            "text-lg font-semibold text-foreground",
            isRTL && "text-right"
          )}>
            {text}
          </p>
        )}
        
        {/* Sub text */}
        {subText && (
          <p className={cn(
            "text-sm text-muted-foreground",
            isRTL && "text-right"
          )}>
            {subText}
          </p>
        )}
      </div>
    </div>
  );
};

export default LoadingOverlay;
