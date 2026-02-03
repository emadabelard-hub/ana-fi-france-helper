import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Mail, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface EnvelopeHelperProps {
  recipientName: string;
  recipientAddress?: string;
  referenceNumber?: string;
  isRTL?: boolean;
}

/**
 * Envelope Helper component - displays the recipient address
 * in a format ready to be written on a physical envelope.
 */
const EnvelopeHelper = ({
  recipientName,
  recipientAddress,
  referenceNumber,
  isRTL = true,
}: EnvelopeHelperProps) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Format the complete address for the envelope
  const envelopeText = [
    recipientName,
    recipientAddress,
  ].filter(Boolean).join('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(envelopeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: isRTL ? "تم النسخ" : "Copié",
        description: isRTL ? "العنوان جاهز للكتابة على الظرف" : "Adresse prête à écrire sur l'enveloppe",
      });
    } catch {
      // Ignore copy errors
    }
  };

  if (!recipientName) return null;

  return (
    <Alert className="mt-4 border-2 border-border bg-muted/50">
      <Mail className="h-5 w-5 text-primary" />
      <AlertTitle className={cn(
        "text-foreground font-semibold flex items-center justify-between flex-wrap gap-2",
        isRTL && "flex-row-reverse font-cairo"
      )}>
        <span>
          {isRTL ? '✉️ اكتب ده على الظرف:' : "✉️ Écrire sur l'enveloppe:"}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="h-7 text-xs gap-1"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {isRTL ? 'نسخ' : 'Copier'}
        </Button>
      </AlertTitle>
      <AlertDescription className="mt-3">
        {/* Envelope Preview - LTR for French address */}
        <div 
          dir="ltr" 
          className="bg-background border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 font-mono text-sm space-y-1"
        >
          <p className="font-bold text-foreground">{recipientName}</p>
          {recipientAddress && (
            <p className="text-muted-foreground whitespace-pre-line">{recipientAddress}</p>
          )}
        </div>
        
        {/* Reference reminder */}
        {referenceNumber && (
          <p className={cn(
            "text-xs text-muted-foreground mt-3",
            isRTL && "text-right font-cairo"
          )}>
            📎 {isRTL ? 'متنساش تكتب رقم المرجع في الجواب:' : "N'oubliez pas la référence dans la lettre:"}{' '}
            <span className="font-mono font-bold text-foreground">{referenceNumber}</span>
          </p>
        )}
        
        {/* Tip for Lettre Recommandée */}
        <p className={cn(
          "text-xs text-muted-foreground mt-2",
          isRTL && "text-right font-cairo"
        )}>
          💡 {isRTL 
            ? 'نصيحة: ابعته بـ "Lettre Recommandée avec Accusé de Réception" عشان يبقى معاك إثبات' 
            : 'Conseil: Envoyez en "Lettre Recommandée avec Accusé de Réception" pour avoir une preuve'}
        </p>
      </AlertDescription>
    </Alert>
  );
};

export default EnvelopeHelper;
