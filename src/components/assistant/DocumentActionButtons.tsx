import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FileText, Reply } from 'lucide-react';

interface DocumentActionButtonsProps {
  documentType: 'invoice' | 'letter' | null;
  isRTL: boolean;
  onGenerateReply: () => void;
  extractedData?: Record<string, any>;
}

/**
 * Action buttons shown after AI document analysis.
 * - Invoice/Quote detected → "Transformer en Facture"
 * - Letter/Mail detected → "Générer une réponse"
 */
const DocumentActionButtons = ({ documentType, isRTL, onGenerateReply, extractedData }: DocumentActionButtonsProps) => {
  const navigate = useNavigate();

  if (!documentType) return null;

  const handleTransformToInvoice = () => {
    // Navigate to invoice creator (data can be passed via state if needed)
    navigate('/pro/invoice-creator', { state: { fromDocument: true, extractedData } });
  };

  return (
    <div className={cn(
      "flex w-full justify-start",
    )}>
      <div className="ml-10 mt-1">
        {documentType === 'invoice' && (
          <Button
            onClick={handleTransformToInvoice}
            variant="default"
            className={cn(
              "gap-2 h-11 text-sm font-semibold rounded-xl shadow-md",
              isRTL && "flex-row-reverse font-cairo"
            )}
          >
            <FileText className="h-4 w-4" />
            {isRTL ? '📄 حوّل لفاتورة' : '📄 Transformer en Facture'}
          </Button>
        )}

        {documentType === 'letter' && (
          <Button
            onClick={onGenerateReply}
            variant="default"
            className={cn(
              "gap-2 h-11 text-sm font-semibold rounded-xl shadow-md",
              isRTL && "flex-row-reverse font-cairo"
            )}
          >
            <Reply className="h-4 w-4" />
            {isRTL ? '✉️ اكتبلي رد' : '✉️ Générer une réponse'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default DocumentActionButtons;
