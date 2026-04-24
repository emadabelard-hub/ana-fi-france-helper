import { useMemo } from 'react';
import { AlertCircle, Send, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { DocumentItem } from './DocumentCard';

interface UnpaidInvoicesBlockProps {
  documents: DocumentItem[];
  isRTL: boolean;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const parseDateFR = (dateStr: string): Date => {
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(+parts[2], +parts[1] - 1, +parts[0]);
  }
  return new Date(dateStr);
};

const buildReminderMessage = (doc: DocumentItem, isRTL: boolean, daysOverdue: number) => {
  const amount = fmt(doc.amountTTC);
  if (isRTL) {
    return `السلام عليكم،\n\nده تذكير لطيف بخصوص الفاتورة رقم ${doc.number} بتاريخ ${doc.date} بمبلغ ${amount}.\n\nالفاتورة دي مستحقة من ${daysOverdue} يوم.\n\nياريت تأكدلي الدفع لما يتم.\n\nشكراً جزيلاً.`;
  }
  return `Bonjour,\n\nCeci est un rappel concernant la facture n°${doc.number} du ${doc.date} d'un montant de ${amount}.\n\nCette facture est en attente de règlement depuis ${daysOverdue} jour${daysOverdue > 1 ? 's' : ''}.\n\nMerci de bien vouloir procéder au règlement dès que possible.\n\nCordialement.`;
};

const UnpaidInvoicesBlock = ({ documents, isRTL }: UnpaidInvoicesBlockProps) => {
  const unpaidInvoices = useMemo(() => {
    const now = new Date();
    return documents
      .filter(
        (d) =>
          d.type === 'facture' &&
          d.status === 'finalized' &&
          d.paymentStatus !== 'paid'
      )
      .map((d) => {
        const issueDate = parseDateFR(d.date);
        const daysOverdue = Math.max(0, Math.floor((now.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24)));
        return { doc: d, daysOverdue };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [documents]);

  const totalPending = useMemo(
    () => unpaidInvoices.reduce((sum, { doc }) => sum + doc.amountTTC, 0),
    [unpaidInvoices]
  );

  const handleSendReminder = (doc: DocumentItem, daysOverdue: number) => {
    const phone = (doc.rawData?.document_data?.client?.phone || '').replace(/[^\d+]/g, '');
    const message = buildReminderMessage(doc, isRTL, daysOverdue);
    const encodedMessage = encodeURIComponent(message);
    const url = phone
      ? `https://wa.me/${phone.replace(/^\+/, '')}?text=${encodedMessage}`
      : `https://wa.me/?text=${encodedMessage}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (unpaidInvoices.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className={cn('flex items-center justify-between gap-2 mb-3', isRTL && 'flex-row-reverse')}>
        <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
            <AlertCircle className="h-4 w-4 text-amber-400" />
          </div>
          <h3 className={cn('text-sm font-bold text-foreground', isRTL && 'font-cairo text-right')}>
            {isRTL ? 'المستحقات غير المدفوعة' : 'Créances impayées'}
          </h3>
        </div>
        <div className={cn('text-right', isRTL && 'text-left')}>
          <p className="text-base font-black text-amber-400 leading-none">{fmt(totalPending)}</p>
          <p className={cn('text-[10px] text-muted-foreground mt-0.5', isRTL && 'font-cairo')}>
            {isRTL ? `${unpaidInvoices.length} فاتورة` : `${unpaidInvoices.length} facture${unpaidInvoices.length > 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {unpaidInvoices.map(({ doc, daysOverdue }) => {
          const isCritical = daysOverdue > 60;
          const isWarning = daysOverdue > 30 && daysOverdue <= 60;
          const ageColor = isCritical
            ? 'text-red-400 bg-red-500/10 border-red-500/30'
            : isWarning
              ? 'text-orange-400 bg-orange-500/10 border-orange-500/30'
              : 'text-muted-foreground bg-muted/30 border-border/50';

          return (
            <div
              key={doc.id}
              className={cn(
                'rounded-lg border p-2.5 flex items-center gap-2',
                isCritical ? 'border-red-500/30 bg-red-500/5' : isWarning ? 'border-orange-500/30 bg-orange-500/5' : 'border-border/50 bg-muted/20',
                isRTL && 'flex-row-reverse'
              )}
            >
              <div className={cn('flex-1 min-w-0', isRTL && 'text-right')}>
                <div className={cn('flex items-center gap-1.5 mb-0.5', isRTL && 'flex-row-reverse')}>
                  <span className="text-xs font-bold text-foreground truncate">{doc.number}</span>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-semibold', ageColor)}>
                    <Clock className="inline h-2.5 w-2.5 mr-0.5 -mt-0.5" />
                    {isRTL ? `${daysOverdue} يوم` : `${daysOverdue}j`}
                  </span>
                </div>
                <p className={cn('text-[11px] text-muted-foreground truncate', isRTL && 'font-cairo')}>
                  {doc.clientName || (isRTL ? 'بدون اسم' : 'Sans nom')}
                </p>
              </div>
              <div className={cn('text-right shrink-0', isRTL && 'text-left')}>
                <p className="text-sm font-black text-foreground leading-none">{fmt(doc.amountTTC)}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSendReminder(doc, daysOverdue)}
                className="h-8 px-2.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 font-semibold gap-1 shrink-0"
              >
                <Send className="h-3 w-3" />
                <span className={cn('text-[10px] hidden sm:inline', isRTL && 'font-cairo')}>
                  {isRTL ? 'تذكير' : 'Relancer'}
                </span>
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UnpaidInvoicesBlock;
