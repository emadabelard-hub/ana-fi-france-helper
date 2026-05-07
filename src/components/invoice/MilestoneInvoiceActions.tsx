import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, CheckCircle, Eye, Clock, FileCheck2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { PaymentMilestone } from '@/components/invoice/InvoiceDisplay';
import { buildMilestonePrefill } from '@/lib/milestonePrefill';

interface Props {
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
  onViewInvoice?: (invoiceId: string) => void;
}

type MilestoneRow = {
  id: string;
  milestone_index: number;
  facture_id: string | null;
  facture_number: string | null;
  statut: string;
};

type MilestoneStatus = 'en_attente' | 'facturee' | 'payee';

function getMilestoneLabel(index: number, total: number): { fr: string; ar: string } {
  if (index === 0) return { fr: "Facture d'acompte", ar: 'فاتورة مقدم' };
  if (index === total - 1) return { fr: 'Facture finale', ar: 'فاتورة نهائية' };
  return { fr: 'Facture intermédiaire', ar: 'فاتورة مرحلية' };
}

const MilestoneInvoiceActions = ({ devisDoc, onViewInvoice }: Props) => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [rows, setRows] = useState<MilestoneRow[]>([]);

  const milestones: PaymentMilestone[] = devisDoc.document_data?.paymentMilestones || [];

  const fetchRows = useCallback(async () => {
    if (!user) return;
    const { data, error } = await (supabase.from('milestone_invoices') as any)
      .select('id, milestone_index, facture_id, facture_number, statut')
      .eq('user_id', user.id)
      .eq('devis_id', devisDoc.id);
    if (error) {
      console.error('[MilestoneInvoiceActions] fetch error:', error);
      return;
    }
    setRows((data || []) as MilestoneRow[]);
  }, [user, devisDoc.id]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // Realtime refetch on inserts (covers post-creation UI sync)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`milestone_invoices_${devisDoc.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'milestone_invoices',
        filter: `devis_id=eq.${devisDoc.id}`,
      }, () => { fetchRows(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, devisDoc.id, fetchRows]);

  const infoMap = useMemo(() => {
    const m: Record<number, { invoiceId: string | null; invoiceNumber: string | null; status: MilestoneStatus }> = {};
    for (const r of rows) {
      if (r.statut === 'cancelled') continue;
      const status: MilestoneStatus = r.statut === 'payee' ? 'payee' : 'facturee';
      const existing = m[r.milestone_index];
      if (existing && existing.status === 'payee') continue;
      m[r.milestone_index] = { invoiceId: r.facture_id, invoiceNumber: r.facture_number, status };
    }
    return m;
  }, [rows]);

  const stats = useMemo(() => {
    const ids = Object.keys(infoMap);
    const paid = ids.filter((i) => infoMap[Number(i)].status === 'payee').length;
    return { invoiced: ids.length, paid, total: milestones.length };
  }, [infoMap, milestones.length]);

  if (milestones.length === 0) return null;

  const totalTTC = devisDoc.total_ttc;
  const docData = devisDoc.document_data || {};
  const selectedMilestone = selectedIndex !== null ? milestones[selectedIndex] : null;
  const selectedStatus: MilestoneStatus = selectedIndex !== null
    ? (infoMap[selectedIndex]?.status ?? 'en_attente')
    : 'en_attente';
  const canCreate = selectedMilestone !== null && selectedStatus === 'en_attente';

  const handleCreate = () => {
    if (!user || !selectedMilestone || selectedIndex === null) return;
    try {
      const prefill = buildMilestonePrefill({
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
        milestoneIndex: selectedIndex,
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
            ? isRTL ? `✅ ${stats.total}/${stats.total} مدفوعة` : `✅ ${stats.total}/${stats.total} soldées`
            : isRTL
              ? `${stats.invoiced}/${stats.total} مفوترة — ${stats.total - stats.invoiced} باقية`
              : `${stats.invoiced}/${stats.total} facturées — ${stats.total - stats.invoiced} restante${stats.total - stats.invoiced > 1 ? 's' : ''}`}
        </span>
      </div>

      <div className="space-y-2">
        {milestones.map((milestone, index) => {
          const milestoneAmount = milestone.mode === 'percent'
            ? (totalTTC * (milestone.percent || 0)) / 100
            : milestone.amount || 0;
          const label = getMilestoneLabel(index, milestones.length);
          const info = infoMap[index];
          const status: MilestoneStatus = info?.status ?? 'en_attente';
          const isSelected = selectedIndex === index;
          const selectable = status === 'en_attente';

          const statusBadge =
            status === 'payee' ? (
              <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-500 border border-emerald-500/30', isRTL && 'font-cairo')}>
                <CheckCircle className="h-3 w-3" />
                {isRTL ? 'مدفوعة' : 'Payée'}
              </span>
            ) : status === 'facturee' ? (
              <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-blue-500/15 text-blue-400 border border-blue-500/30', isRTL && 'font-cairo')}>
                <FileCheck2 className="h-3 w-3" />
                {isRTL ? 'تم إنشاء الفاتورة' : 'Facturée'}
              </span>
            ) : (
              <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-amber-500/15 text-amber-500 border border-amber-500/30', isRTL && 'font-cairo')}>
                <Clock className="h-3 w-3" />
                {isRTL ? 'لم تُفوتر بعد' : 'Pas encore facturée'}
              </span>
            );

          return (
            <button
              key={milestone.id || index}
              type="button"
              disabled={!selectable}
              onClick={() => selectable && setSelectedIndex(isSelected ? null : index)}
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
                  onClick={(e) => { e.stopPropagation(); onViewInvoice(info.invoiceId!); }}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              )}
            </button>
          );
        })}
      </div>

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
      {selectedIndex === null && !allDone && (
        <p className={cn('text-[10px] text-muted-foreground text-center', isRTL && 'font-cairo')}>
          {isRTL ? 'اختار قسط لم يُفوتر لإنشاء فاتورته' : 'Sélectionnez une échéance non facturée'}
        </p>
      )}
    </div>
  );
};

export default MilestoneInvoiceActions;
