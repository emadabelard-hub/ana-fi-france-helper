import { FileText, Receipt, ReceiptText, Calendar, Euro, MoreVertical, Download, Send, Pencil, ArrowRightLeft, Copy, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface DocumentItem {
  id: string;
  type: 'devis' | 'facture' | 'expense';
  number: string;
  clientName: string;
  date: string;
  amountHT: number;
  amountTTC: number;
  status: 'paid' | 'unpaid' | 'pending' | 'draft' | 'finalized';
  paymentStatus?: 'paid' | 'unpaid';
  project?: string;
  rawData?: any;
}

interface DocumentCardProps {
  doc: DocumentItem;
  isRTL: boolean;
  onDelete: (id: string) => void;
  onConvert?: (doc: DocumentItem) => void;
  onDuplicate?: (doc: DocumentItem) => void;
  onOpen?: (doc: DocumentItem) => void;
  onMarkPaid?: (doc: DocumentItem) => void;
}

const typeConfig = {
  devis: { icon: FileText, label: 'Devis', labelAr: 'عرض سعر', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  facture: { icon: Receipt, label: 'Facture', labelAr: 'فاتورة', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  expense: { icon: ReceiptText, label: 'Note de frais', labelAr: 'حسابات', color: 'text-blue-400', bg: 'bg-blue-500/10' },
};

const statusConfig = {
  paid: { label: 'Payé', labelAr: 'مدفوع', cls: 'bg-emerald-500/15 text-emerald-400' },
  unpaid: { label: 'Impayé', labelAr: 'غير مدفوع', cls: 'bg-red-500/15 text-red-400 animate-pulse' },
  pending: { label: 'En attente', labelAr: 'قيد الانتظار', cls: 'bg-amber-500/15 text-amber-400' },
  draft: { label: 'Brouillon', labelAr: 'مسودة', cls: 'bg-muted text-muted-foreground' },
  finalized: { label: 'Finalisé', labelAr: 'نهائي', cls: 'bg-emerald-500/15 text-emerald-400' },
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

const DocumentCard = ({ doc, isRTL, onDelete, onConvert, onDuplicate, onOpen, onMarkPaid }: DocumentCardProps) => {
  const tc = typeConfig[doc.type];
  const sc = statusConfig[doc.status];
  const Icon = tc.icon;
  const isConvertedQuote =
    doc.type === 'devis' &&
    (doc.rawData?.status === 'converted' || Boolean(doc.rawData?.converted_to_invoice) || Boolean(doc.rawData?.linked_invoice_id));

  const isOverdue = doc.type === 'facture' && doc.status === 'unpaid';
  const isClickable = doc.type !== 'expense' && Boolean(onOpen);
  const showMarkPaid = doc.type === 'facture' && doc.status === 'finalized' && doc.paymentStatus !== 'paid' && onMarkPaid;
  const isPaid = doc.paymentStatus === 'paid';

  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-card p-4 transition-all duration-300 hover:shadow-[0_0_24px_hsl(var(--accent)/0.08)]",
        isOverdue
          ? "border-red-500/50 hover:border-red-500/70 bg-red-500/[0.03]"
          : "border-border hover:border-accent/40",
        isClickable && "cursor-pointer"
      )}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? () => onOpen?.(doc) : undefined}
      onKeyDown={isClickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen?.(doc);
        }
      } : undefined}
    >
      {/* Accent line */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-[2px] rounded-t-xl bg-gradient-to-r opacity-40 group-hover:opacity-70 transition-opacity",
        isOverdue 
          ? "from-transparent via-red-500 to-transparent" 
          : "from-transparent via-accent to-transparent"
      )} />

      <div className={cn('flex items-start justify-between gap-3', isRTL && 'flex-row-reverse')}>
        <div className={cn('flex items-center gap-3 flex-1 min-w-0', isRTL && 'flex-row-reverse')}>
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', tc.bg)}>
            <Icon className={cn('h-5 w-5', tc.color)} />
          </div>
          <div className={cn('min-w-0 flex-1', isRTL && 'text-right')}>
            <p className="text-sm font-bold text-accent truncate">{doc.number}</p>
            <p className="text-xs text-muted-foreground truncate">
              {doc.clientName || (isRTL ? 'بدون عميل' : 'Sans client')}
            </p>
          </div>
        </div>

        <div className={cn('flex items-center gap-2 shrink-0', isRTL && 'flex-row-reverse')}>
          <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider', sc.cls)}>
            {isRTL ? sc.labelAr : sc.label}
          </span>

          {/* Payment badge for finalized invoices */}
          {doc.type === 'facture' && doc.status === 'finalized' && (
            <Badge
              variant={isPaid ? 'default' : 'outline'}
              className={cn(
                'text-[10px] font-bold',
                isPaid
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-muted/50 text-muted-foreground border-border'
              )}
            >
              {isPaid ? (isRTL ? 'تم الدفع' : 'Payé') : (isRTL ? 'غير مدفوع' : 'Non payé')}
            </Badge>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="w-48">
              {showMarkPaid && (
                <DropdownMenuItem className="gap-2 text-emerald-500 font-semibold" onClick={(e) => { e.stopPropagation(); onMarkPaid(doc); }}>
                  <CheckCircle className="h-4 w-4" />
                  {isRTL ? 'تم الدفع' : 'Marquer payé'}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="gap-2">
                <Download className="h-4 w-4" />
                {isRTL ? 'تحميل PDF' : 'Télécharger PDF'}
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2">
                <Send className="h-4 w-4" />
                {isRTL ? 'أرسل للمحاسب' : 'Envoyer au comptable'}
              </DropdownMenuItem>
              {doc.type === 'devis' && onConvert && !isConvertedQuote && (
                <DropdownMenuItem className="gap-2" onClick={() => onConvert(doc)}>
                  <ArrowRightLeft className="h-4 w-4" />
                  {isRTL ? 'حوّل لفاتورة' : 'Convertir en facture'}
                </DropdownMenuItem>
              )}
              {doc.type === 'devis' && isConvertedQuote && (
                <DropdownMenuItem className="gap-2 text-amber-500" disabled>
                  <ArrowRightLeft className="h-4 w-4" />
                  {isRTL ? '✅ تم إنشاء فاتورة بالفعل' : '✅ Facture déjà créée'}
                </DropdownMenuItem>
              )}
              {doc.type === 'devis' && onDuplicate && (
                <DropdownMenuItem className="gap-2" onClick={() => onDuplicate(doc)}>
                  <Copy className="h-4 w-4" />
                  {isRTL ? 'نسخ' : 'Dupliquer'}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="gap-2 text-destructive" onClick={() => onDelete(doc.id)}>
                <Pencil className="h-4 w-4" />
                {isRTL ? 'حذف' : 'Supprimer'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Meta row */}
      <div className={cn('mt-3 flex items-center gap-4 text-xs flex-wrap', isRTL && 'flex-row-reverse')}>
        <div className={cn('flex items-center gap-1', isRTL && 'flex-row-reverse')}>
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">{doc.date}</span>
        </div>
        <div className={cn('flex items-center gap-1', isRTL && 'flex-row-reverse')}>
          <Euro className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">HT {formatCurrency(doc.amountHT)}</span>
        </div>
        <span className="font-bold text-accent">TTC {formatCurrency(doc.amountTTC)}</span>
        {doc.project && (
          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
            {doc.project}
          </span>
        )}
      </div>

      {/* Payment action row for finalized invoices */}
      {doc.type === 'facture' && doc.status === 'finalized' && (
        <div className={cn('mt-3 flex items-center gap-2', isRTL && 'flex-row-reverse')}>
          {isPaid ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <CheckCircle className="h-3.5 w-3.5" />
              {isRTL ? 'تم الدفع' : 'Payé'}
            </span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-muted/60 text-muted-foreground border border-border">
                {isRTL ? 'غير مدفوع' : 'Non payé'}
              </span>
              {onMarkPaid && (
                <Button
                  size="sm"
                  className="h-7 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-1.5"
                  onClick={(e) => { e.stopPropagation(); onMarkPaid(doc); }}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  {isRTL ? 'تم الدفع' : 'Marquer payé'}
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DocumentCard;
