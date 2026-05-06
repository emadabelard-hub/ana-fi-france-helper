import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, CheckCircle, Eye, Clock, FileCheck2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { isOfficialDocumentNumber } from '@/lib/documentNumbers';
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
  /** All documents (to check existing milestone invoices and their payment status) */
  allDocuments: Array<{
    id: string;
    document_type: string;
    document_data: any;
    status?: string;
    payment_status?: string;
  }>;
  /** Callback to view a linked invoice */
  onViewInvoice?: (invoiceId: string) => void;
}

type MilestoneStatus = 'en_attente' | 'facturee' | 'payee';

interface MilestoneInfo {
  invoiceId: string | null;
  status: MilestoneStatus;
}

/**
 * Get the label for a milestone invoice based on its position.
 */
function getMilestoneLabel(index: number, total: number): { fr: string; ar: string } {
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
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const milestones: PaymentMilestone[] = devisDoc.document_data?.paymentMilestones || [];

  // Per-milestone invoiced check — single source of truth is milestoneInfoMap
  // (built from actual invoice documents matching this devis + milestoneId).
  // No fallback on milestone.statut to avoid global contamination.
  const isMilestoneInvoiced = (milestoneId: string): boolean => {
    const s = milestoneInfoMap[milestoneId]?.status;
    return s === 'facturee' || s === 'payee';
  };

  // Build a map: milestoneId → { invoiceId, status }
  // status: 'en_attente' (no active invoice), 'facturee' (invoice exists, unpaid), 'payee' (invoice paid)
  // Cancelled invoices are ignored → milestone returns to 'en_attente'.
  const milestoneInfoMap = useMemo(() => {
    const map: Record<string, MilestoneInfo> = {};
    for (const doc of allDocuments) {
      if (doc.document_type !== 'facture') continue;
      const data = doc.document_data;
      if (!data?.milestoneId || data?.sourceDevisId !== devisDoc.id) continue;
      // Ignore cancelled invoices: milestone is back to "en_attente"
      if (doc.status === 'cancelled') continue;
      const isPaid = doc.payment_status === 'paid';
      // Prefer a paid invoice over an unpaid one if both exist (shouldn't happen, but safe)
      const existing = map[data.milestoneId];
      if (existing && existing.status === 'payee') continue;
      map[data.milestoneId] = {
        invoiceId: doc.id,
        status: isPaid ? 'payee' : 'facturee',
      };
    }
    return map;
  }, [allDocuments, devisDoc.id]);

  const stats = useMemo(() => {
    const invoicedIds = Object.keys(milestoneInfoMap);
    let paid = 0;
    for (const id of invoicedIds) {
      if (milestoneInfoMap[id]?.status === 'payee') paid += 1;
    }
    return { invoiced: invoicedIds.length, paid, total: milestones.length };
  }, [milestones, milestoneInfoMap]);

  if (milestones.length === 0) return null;

  const totalTTC = devisDoc.total_ttc;
  const docData = devisDoc.document_data || {};

  const selectedMilestone = milestones.find((m) => m.id === selectedId) || null;
  const selectedInfo = selectedId ? milestoneInfoMap[selectedId] : null;
  const selectedStatus: MilestoneStatus | null = selectedMilestone
    ? (selectedInfo?.status ?? 'en_attente')
    : null;
  const canCreate = selectedStatus === 'en_attente';

  const handleCreate = async () => {
    if (!user || !selectedMilestone) return;
    const index = milestones.findIndex((m) => m.id === selectedMilestone.id);

    // Guard removed: per-milestone check (via milestoneId in DB) is the single source of truth.

    try {
      const prefill = buildMilestoneInvoicePrefill({
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
        milestone: selectedMilestone,
        milestoneIndex: index,
        totalMilestones: milestones.length,
      });

      sessionStorage.removeItem('quoteToInvoiceData');
      sessionStorage.setItem('milestoneInvoiceData', JSON.stringify(prefill));
      navigate('/pro/invoice-creator?type=facture&prefill=milestone');
    } catch (error) {
      console.error('[MilestoneInvoiceActions] Prefill error:', error);
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

  const allDone = stats.invoiced === stats.total && stats.paid === stats.total;

  return (
    <div className={cn('space-y-3', isRTL && 'text-right')}>
      {/* Header + counter */}
      <div className={cn('flex items-center justify-between gap-2', isRTL && 'flex-row-reverse')}>
        <h4 className={cn('text-xs font-bold text-muted-foreground uppercase tracking-wider', isRTL && 'font-cairo')}>
          {isRTL ? '📋 الفوترة حسب الأقساط' : '📋 Facturation par échéance'}
        </h4>
        <span
          className={cn(
            'text-[10px] font-bold px-2 py-1 rounded-md border',
            allDone
              ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
              : 'bg-amber-500/15 text-amber-500 border-amber-500/30',
            isRTL && 'font-cairo',
          )}
        >
          {allDone
            ? isRTL
              ? `✅ ${stats.total}/${stats.total} مدفوعة`
              : `✅ ${stats.total}/${stats.total} soldées`
            : isRTL
              ? `${stats.invoiced}/${stats.total} مفوترة — ${stats.total - stats.invoiced} باقية`
              : `${stats.invoiced}/${stats.total} facturées — ${stats.total - stats.invoiced} restante${stats.total - stats.invoiced > 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Milestone list (selectable) */}
      <div className="space-y-2">
        {milestones.map((milestone, index) => {
          const milestoneAmount =
            milestone.mode === 'percent'
              ? (totalTTC * (milestone.percent || 0)) / 100
              : milestone.amount || 0;
          const label = getMilestoneLabel(index, milestones.length);
          const info = milestoneInfoMap[milestone.id];
          const status: MilestoneStatus = info?.status || getStoredMilestoneStatus(milestone);
          const isSelected = selectedId === milestone.id;
          const selectable = status === 'en_attente';

          const statusBadge =
            status === 'payee' ? (
              <span className={cn(
                'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-500 border border-emerald-500/30',
                isRTL && 'font-cairo',
              )}>
                <CheckCircle className="h-3 w-3" />
                {isRTL ? 'مدفوعة' : 'Payée'}
              </span>
            ) : status === 'facturee' ? (
              <span className={cn(
                'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-blue-500/15 text-blue-400 border border-blue-500/30',
                isRTL && 'font-cairo',
              )}>
                <FileCheck2 className="h-3 w-3" />
                {isRTL ? 'تم إنشاء الفاتورة' : 'Facturée'}
              </span>
            ) : (
              <span className={cn(
                'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-amber-500/15 text-amber-500 border border-amber-500/30',
                isRTL && 'font-cairo',
              )}>
                <Clock className="h-3 w-3" />
                {isRTL ? 'لم تُفوتر بعد' : 'Pas encore facturée'}
              </span>
            );

          return (
            <button
              key={milestone.id}
              type="button"
              disabled={!selectable}
              onClick={() => selectable && setSelectedId(isSelected ? null : milestone.id)}
              className={cn(
                'w-full text-left flex items-center gap-3 p-3 rounded-lg border-2 transition-all',
                isRTL && 'flex-row-reverse text-right',
                isSelected && selectable
                  ? 'border-[hsl(45,80%,55%)] bg-[hsl(45,80%,55%)/0.08] shadow-md'
                  : status === 'payee'
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : status === 'facturee'
                      ? 'border-blue-500/30 bg-blue-500/5'
                      : 'border-border bg-card hover:border-[hsl(45,60%,45%)]',
                !selectable && 'cursor-default',
              )}
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className={cn('flex items-center gap-2 flex-wrap', isRTL && 'flex-row-reverse')}>
                  <span className={cn('text-xs font-bold', isRTL && 'font-cairo')}>
                    {isRTL ? `قسط ${index + 1}/${milestones.length}` : `Échéance ${index + 1}/${milestones.length}`}
                  </span>
                  {statusBadge}
                </div>
                <p className={cn('text-xs text-muted-foreground truncate', isRTL && 'font-cairo')}>
                  {milestone.label || (isRTL ? label.ar : label.fr)}
                </p>
                <p className="text-xs font-semibold">
                  {milestone.mode === 'percent' && (
                    <span className="text-muted-foreground">{milestone.percent}% · </span>
                  )}
                  {formatCurrency(milestoneAmount)}
                </p>
              </div>

              {info?.invoiceId && onViewInvoice && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[10px] text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewInvoice(info.invoiceId!);
                  }}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              )}
            </button>
          );
        })}
      </div>

      {/* Action button */}
      <Button
        disabled={!canCreate}
        onClick={handleCreate}
        className={cn(
          'w-full h-10 font-bold gap-2',
          canCreate
            ? 'bg-[hsl(45,80%,55%)] text-[hsl(0,0%,8%)] hover:bg-[hsl(45,80%,45%)]'
            : 'bg-muted text-muted-foreground',
          isRTL && 'font-cairo',
        )}
      >
        <Receipt className="h-4 w-4" />
        {isRTL ? 'إنشاء الفاتورة' : 'Créer la facture'}
      </Button>
      {!selectedId && !allDone && (
        <p className={cn('text-[10px] text-muted-foreground text-center', isRTL && 'font-cairo')}>
          {isRTL ? 'اختار قسط لم يُفوتر لإنشاء فاتورته' : 'Sélectionnez une échéance non facturée'}
        </p>
      )}
    </div>
  );
};

export default MilestoneInvoiceActions;
