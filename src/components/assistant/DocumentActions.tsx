import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Copy, Check, Download, Coins } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCredits, CREDIT_COSTS, type CreditAction } from '@/hooks/useCredits';
import { useAuth } from '@/hooks/useAuth';
import InsufficientCreditsModal from '@/components/shared/InsufficientCreditsModal';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface DocumentActionsProps {
  content: string;
  documentRef?: React.RefObject<HTMLDivElement>;
  documentName?: string;
  isRTL?: boolean;
  showPdfButton?: boolean;
  creditAction?: CreditAction; // 'letter_pdf' or 'invoice_pdf'
}

const DocumentActions = ({
  content,
  documentRef,
  documentName = 'document',
  isRTL = true,
  showPdfButton = true,
  creditAction = 'letter_pdf',
}: DocumentActionsProps) => {
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showInsufficientCredits, setShowInsufficientCredits] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { balance, canAfford, deductCredits, getCost } = useCredits();

  const creditCost = getCost(creditAction);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: isRTL ? "تم النسخ" : "Copié",
        description: isRTL ? "تم نسخ النص للحافظة" : "Le texte a été copié",
      });
    } catch {
      toast({
        variant: "destructive",
        title: isRTL ? "خطأ" : "Erreur",
        description: isRTL ? "فشل في النسخ" : "Échec de la copie",
      });
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <>
      <div className={cn(
        "flex gap-2 mt-3",
        isRTL && "flex-row-reverse"
      )}>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className={cn("gap-2", isRTL && "flex-row-reverse")}
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-emerald-500" />
              <span>{isRTL ? 'تم النسخ' : 'Copié'}</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              <span>{isRTL ? '📋 نسخ النص' : '📋 Copier'}</span>
            </>
          )}
        </Button>

        {showPdfButton && (
          <Button
            variant="default"
            size="sm"
            onClick={handleExportPDF}
            disabled={isExporting}
            className={cn("gap-2 relative", isRTL && "flex-row-reverse")}
          >
            {isExporting ? (
              <>
                <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                <span>{isRTL ? 'جاري التحميل...' : 'Export...'}</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>{isRTL ? '📄 تحميل PDF' : '📄 Télécharger PDF'}</span>
                {creditCost > 0 && (
                  <Badge 
                    variant="secondary" 
                    className="ml-1 text-xs px-1.5 py-0 bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
                  >
                    <Coins className="h-3 w-3 mr-0.5" />
                    {creditCost}
                  </Badge>
                )}
              </>
            )}
          </Button>
        )}
      </div>

      <InsufficientCreditsModal
        open={showInsufficientCredits}
        onOpenChange={setShowInsufficientCredits}
        currentBalance={balance}
        requiredCredits={creditCost}
      />
    </>
  );
};

export default DocumentActions;
