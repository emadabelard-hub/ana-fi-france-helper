import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PenLine, Loader2 } from 'lucide-react';

interface LetterSuggestionButtonProps {
  onAccept: () => void;
  isLoading?: boolean;
  isRTL?: boolean;
}

/**
 * Inline button that appears when AI suggests writing a letter.
 * User clicks this to confirm and trigger auto-generation.
 */
const LetterSuggestionButton = ({
  onAccept,
  isLoading = false,
  isRTL = true,
}: LetterSuggestionButtonProps) => {
  return (
    <div className={cn(
      "mt-3 pt-3 border-t border-border",
      isRTL && "font-cairo"
    )}>
      <Button
        onClick={onAccept}
        disabled={isLoading}
        className={cn(
          "gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md",
          isRTL && "flex-row-reverse"
        )}
        size="lg"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            {isRTL ? 'جاري الكتابة...' : 'Rédaction en cours...'}
          </>
        ) : (
          <>
            <PenLine className="h-5 w-5" />
            {isRTL ? '✅ أيوه، اكتبلي الخطاب' : '✅ Oui, rédiger la lettre'}
          </>
        )}
      </Button>
      <p className={cn(
        "text-xs text-muted-foreground mt-2",
        isRTL && "text-right"
      )}>
        {isRTL 
          ? '💡 هستخدم بياناتك المحفوظة في الملف الشخصي' 
          : '💡 J\'utiliserai vos informations de profil'}
      </p>
    </div>
  );
};

export default LetterSuggestionButton;
