import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface FrenchDocumentContainerProps {
  children: ReactNode;
  className?: string;
  variant?: 'letter' | 'invoice' | 'email';
}

/**
 * Container component for French administrative documents.
 * Enforces LTR direction, professional typography, and proper alignment
 * regardless of the parent RTL context (Arabic interface).
 */
const FrenchDocumentContainer = ({ 
  children, 
  className,
  variant = 'letter'
}: FrenchDocumentContainerProps) => {
  return (
    <div
      dir="ltr"
      lang="fr"
      className={cn(
        // Base French document styles
        "french-document",
        // Force LTR and left alignment
        "text-left",
        // Professional typography
        "font-serif leading-relaxed tracking-normal",
        // Variant-specific styles
        variant === 'letter' && "french-letter",
        variant === 'invoice' && "french-invoice",
        variant === 'email' && "french-email",
        className
      )}
      style={{
        direction: 'ltr',
        textAlign: 'left',
        fontFamily: '"Times New Roman", Georgia, serif',
      }}
    >
      {children}
    </div>
  );
};

export default FrenchDocumentContainer;
