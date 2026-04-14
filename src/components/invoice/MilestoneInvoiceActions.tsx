import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, CheckCircle, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { isOfficialDocumentNumber, reserveOfficialDocumentNumber } from '@/lib/documentNumbers';
import { cn } from '@/lib/utils';
import type { PaymentMilestone } from '@/components/invoice/InvoiceDisplay';
import { buildMilestoneInvoicePrefill } from '@/lib/milestoneInvoicePrefill';

interface MilestoneInvoiceActionsProps {
  /** The source devis document */
  devisDoc: {
    id: string;
    document_number: string;
    client_name: string;
    client_address: string | null;
    work_site_address: string | null;
    nature_operation: string;
    total_ttc: number;
    document_data: any;
  };
  /** All documents (to check existing milestone invoices) */
  allDocuments: Array<{
    id: string;
    document_type: string;
    document_data: any;
  }>;
  /** Callback to view a linked invoice */
  onViewInvoice?: (invoiceId: string) => void;
}

/**
 * Get the label for a milestone invoice based on its position.
 */
function getMilestoneLabel(index: number, total: number, isRTL: boolean): { fr: string; ar: string } {
  if (index === 0) {
    return { fr: "Facture d'acompte", ar: 'فاتورة مقدم' };
  }
  if (index === total - 1) {
    return { fr: 'Facture finale', ar: 'فاتورة نهائية' };
  }
  return { fr: 'Facture intermédiaire', ar: 'فاتورة مرحلية' };
}

const MilestoneInvoiceActions = ({ devisDoc, allDocuments, onViewInvoice }: MilestoneInvoiceActionsProps) => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const milestones: PaymentMilestone[] = devisDoc.document_data?.paymentMilestones || [];

  // Build a map: milestoneId → existing facture id
  const milestoneInvoiceMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const doc of allDocuments) {
      if (doc.document_type !== 'facture') continue;
      const data = doc.document_data;
      if (data?.milestoneId && data?.sourceDevisId === devisDoc.id) {
        map[data.milestoneId] = doc.id;
      }
    }
    return map;
  }, [allDocuments, devisDoc.id]);

  if (milestones.length === 0) return null;

  const totalTTC = devisDoc.total_ttc;
  const docData = devisDoc.document_data || {};

  const handleCreateMilestoneInvoice = async (milestone: PaymentMilestone, index: number) => {
    if (!user) return;

    if (!isOfficialDocumentNumber(devisDoc.document_number, 'devis')) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ في الربط' : 'Erreur de liaison',
        description: isRTL
          ? 'رقم الدوفي غير صالح. افتح الدوفي المحفوظ من المستندات.'
          : 'Le numéro du devis source est invalide. Ouvrez le devis enregistré depuis vos documents.',
      });
      return;
    }

    try {
      const reservedDocumentNumber = await reserveOfficialDocumentNumber(user.id, 'facture');
      const prefill = {
        ...buildMilestoneInvoicePrefill({
          quote: {
            id: devisDoc.id,
            documentNumber: devisDoc.document_number,
            clientName: devisDoc.client_name,
            clientAddress: devisDoc.client_address,
            workSiteAddress: devisDoc.work_site_address,
            natureOperation: devisDoc.nature_operation,
            totalTTC,
            documentData: docData,
          },
          milestone,
          milestoneIndex: index,
          totalMilestones: milestones.length,
        }),
        reservedDocumentNumber,
      };

      console.log('[MilestoneInvoiceActions] FULL PREFILL OK — milestone_invoice:', prefill);
      sessionStorage.removeItem('quoteToInvoiceData');
      sessionStorage.setItem('milestoneInvoiceData', JSON.stringify(prefill));
      navigate('/pro/invoice-creator?type=facture&prefill=milestone');
    } catch (error) {
      console.error('[MilestoneInvoiceActions] Numbering error:', error);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ في الترقيم' : 'Erreur de numérotation',
        description: isRTL
          ? 'تعذر إنشاء رقم الفاتورة.'
          : 'Impossible de générer le numéro de facture.',
      });
    }
  };

  return (
    <div className={cn("space-y-2", isRTL && "text-right")}>
      <h4 className={cn("text-xs font-bold text-muted-foreground uppercase tracking-wider", isRTL && "font-cairo")}>
        {isRTL ? '📋 فوترة حسب الأقساط' : '📋 Facturation par échéance'}
      </h4>
      {milestones.map((milestone, index) => {
        const milestoneAmount = milestone.mode === 'percent'
          ? (totalTTC * (milestone.percent || 0)) / 100
          : (milestone.amount || 0);
        const label = getMilestoneLabel(index, milestones.length, isRTL);
        const existingInvoiceId = milestoneInvoiceMap[milestone.id];

        return (
          <div
            key={milestone.id}
            className={cn(
              "flex items-center gap-3 p-2.5 rounded-lg border",
              existingInvoiceId
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-[hsl(45,60%,35%)/0.3] bg-[hsl(0,0%,10%)]",
              isRTL && "flex-row-reverse"
            )}
          >
            <div className={cn("flex-1 min-w-0", isRTL && "text-right")}>
              <p className={cn("text-xs font-semibold truncate", isRTL && "font-cairo")}>
                {isRTL ? label.ar : label.fr}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {milestone.label || `${isRTL ? 'قسط' : 'Échéance'} ${index + 1}`}
                {' — '}
                {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(milestoneAmount)}
                {milestone.mode === 'percent' && ` (${milestone.percent}%)`}
              </p>
            </div>

            {existingInvoiceId ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                <span className={cn("text-[10px] font-bold text-emerald-400", isRTL && "font-cairo")}>
                  {isRTL ? 'تم' : 'Créée'}
                </span>
                {onViewInvoice && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px] text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                    onClick={() => onViewInvoice(existingInvoiceId)}
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ) : (
              <Button
                size="sm"
                className="h-7 px-3 text-[10px] font-bold bg-[hsl(45,80%,55%)] text-[hsl(0,0%,8%)] hover:bg-[hsl(45,80%,45%)] gap-1 shrink-0"
                onClick={() => handleCreateMilestoneInvoice(milestone, index)}
              >
                <Receipt className="h-3 w-3" />
                {isRTL ? 'أنشئ فاتورة' : 'Créer facture'}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MilestoneInvoiceActions;
