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
    <Alert className="mt-6 border-2 border-primary/30 bg-primary/5 shadow-lg">
      <Mail className="h-6 w-6 text-primary" />
      <AlertTitle className={cn(
        "text-lg text-foreground font-bold flex items-center justify-between flex-wrap gap-2",
        isRTL && "flex-row-reverse font-cairo"
      )}>
        <span>
          {isRTL ? '✉️ اكتب ده على الظرف:' : "✉️ Écrire sur l'enveloppe:"}
        </span>
        <Button
          variant="default"
          size="sm"
          onClick={handleCopy}
          className="gap-2"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {isRTL ? 'نسخ العنوان' : 'Copier l\'adresse'}
        </Button>
      </AlertTitle>
      <AlertDescription className="mt-4">
        {/* Envelope Preview - LTR for French address with large text */}
        <div 
          dir="ltr" 
          className="bg-background border-3 border-dashed border-primary/40 rounded-xl p-6 font-mono space-y-2 shadow-inner"
        >
          <p className="text-xl font-bold text-foreground leading-relaxed">{recipientName}</p>
          {recipientAddress && (
            <p className="text-lg text-muted-foreground whitespace-pre-line leading-relaxed">{recipientAddress}</p>
          )}
        </div>
        
        {/* Reference reminder */}
        {referenceNumber && (
          <div className={cn(
            "mt-4 p-3 bg-muted rounded-lg",
            isRTL && "text-right font-cairo"
          )}>
            <p className="text-sm font-medium text-foreground">
              📎 {isRTL ? 'متنساش تكتب رقم المرجع في الجواب:' : "N'oubliez pas la référence dans la lettre:"}
            </p>
            <p className="text-lg font-mono font-bold text-primary mt-1">{referenceNumber}</p>
          </div>
        )}
        
        {/* Tip for Lettre Recommandée */}
        <div className={cn(
          "mt-4 p-3 bg-accent/50 border border-border rounded-lg",
          isRTL && "text-right font-cairo"
        )}>
          <p className="text-sm font-medium text-accent-foreground">
            💡 {isRTL 
              ? 'نصيحة مهمة: ابعته بـ "Lettre Recommandée avec Accusé de Réception" عشان يبقى معاك إثبات رسمي' 
              : 'Conseil: Envoyez en "Lettre Recommandée avec Accusé de Réception" pour avoir une preuve'}
          </p>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default EnvelopeHelper;
