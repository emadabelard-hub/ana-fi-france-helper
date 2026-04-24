import { useMemo, useState } from 'react';
import { AlertCircle, Send, Clock, X, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useProfile } from '@/hooks/useProfile';
import type { DocumentItem } from './DocumentCard';

interface UnpaidInvoicesBlockProps {
  documents: DocumentItem[];
  isRTL: boolean;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const fmtAmount = (n: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const parseDateFR = (dateStr: string): Date => {
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(+parts[2], +parts[1] - 1, +parts[0]);
  }
  return new Date(dateStr);
};

type ClientInfo = {
  isCompany: boolean;
  particulierName: string;
  companyName: string;
  displayName: string;
};

const getClientInfo = (doc: DocumentItem): ClientInfo => {
  const raw = doc.rawData || {};
  const dd = raw.document_data || {};
  const client = dd.client || {};

  const clientType = client.client_type || client.clientType || raw.client_type;
  const isB2B = client.is_b2b === true || client.isB2B === true || clientType === 'professionnel';
  const companyName = (client.company_name || client.companyName || '').toString().trim();
  const contactName = (client.contact_name || client.contactName || client.name || '').toString().trim();
  const fallbackName = (doc.clientName || '').toString().trim();

  const isCompany = isB2B || (!!companyName && companyName !== fallbackName && !contactName);

  return {
    isCompany,
    particulierName: contactName || fallbackName,
    companyName: companyName || fallbackName,
    displayName: isCompany ? (companyName || fallbackName) : (contactName || fallbackName),
  };
};

type ReminderLevel = 1 | 2 | 3;

const getReminderLevel = (daysOverdue: number): ReminderLevel => {
  if (daysOverdue > 60) return 3;
  if (daysOverdue >= 30) return 2;
  return 1;
};

const buildReminderMessage = (
  doc: DocumentItem,
  daysOverdue: number,
  artisanCompany: string,
): string => {
  const info = getClientInfo(doc);
  const amount = fmtAmount(doc.amountTTC);
  const level = getReminderLevel(daysOverdue);
  const company = (artisanCompany || '').trim() || '[Votre entreprise]';

  const greetingStandard = info.isCompany ? 'Bonjour,' : `Bonjour ${info.particulierName},`;
  const greetingFormal = info.isCompany ? 'Madame, Monsieur,' : `Madame, Monsieur ${info.particulierName},`;

  if (level === 1) {
    return `${greetingStandard}

Sauf erreur de notre part, la facture n° ${doc.number} d'un montant de ${amount}€ émise le ${doc.date} reste à ce jour impayée.

Pourriez-vous nous confirmer la date de règlement prévue ?

Cordialement,

${company}`;
  }

  if (level === 2) {
    return `${greetingStandard}

Malgré notre précédent rappel, la facture n° ${doc.number} d'un montant de ${amount}€ demeure impayée depuis le ${doc.date}.

Nous vous demandons de procéder au règlement dans les 8 jours.

Sans retour de votre part, nous nous verrons contraints d'engager une procédure de recouvrement.

Cordialement,

${company}`;
  }

  return `${greetingFormal}

MISE EN DEMEURE DE PAYER

Malgré nos relances restées sans suite, la facture n° ${doc.number} d'un montant de ${amount}€ reste impayée.

En application de l'article L.441-10 du Code de commerce, des pénalités de retard sont applicables.

Vous disposez de 8 jours pour régulariser avant engagement de poursuites judiciaires.

${company}`;
};

const getClientPhone = (doc: DocumentItem) => {
  const candidates = [
    doc.rawData?.resolved_client_phone,
    doc.rawData?.document_data?.client?.phone,
    doc.rawData?.document_data?.clientPhone,
    doc.rawData?.document_data?.client?.contact_phone,
    doc.rawData?.client_phone,
  ];

  return candidates.find((value): value is string => typeof value === 'string' && value.trim().length > 0) || '';
};

const normalizeWhatsAppPhone = (value: string) => {
  const cleaned = value.replace(/[^\d+]/g, '').trim();
  if (!cleaned) return '';

  const unsigned = cleaned.startsWith('+')
    ? cleaned.slice(1)
    : cleaned.startsWith('00')
      ? cleaned.slice(2)
      : cleaned;

  if (/^0\d{9}$/.test(unsigned)) return `33${unsigned.slice(1)}`;
  if (/^[1-9]\d{8}$/.test(unsigned)) return `33${unsigned}`;
  if (/^33\d{9}$/.test(unsigned)) return unsigned;
  if (/^\d{8,15}$/.test(unsigned)) return unsigned;

  return '';
};

const UnpaidInvoicesBlock = ({ documents, isRTL }: UnpaidInvoicesBlockProps) => {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewMessage, setPreviewMessage] = useState('');

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

  const openPreview = (doc: DocumentItem, daysOverdue: number) => {
    const message = buildReminderMessage(doc, isRTL, daysOverdue);
    setPreviewMessage(message);
    setPreviewId(doc.id);
  };

  const closePreview = () => {
    setPreviewId(null);
    setPreviewMessage('');
  };

  const handleConfirmSend = (doc: DocumentItem) => {
    const phone = normalizeWhatsAppPhone(getClientPhone(doc));
    const encodedMessage = encodeURIComponent(previewMessage);
    const url = phone
      ? `https://wa.me/${phone}?text=${encodedMessage}`
      : `https://wa.me/?text=${encodedMessage}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setPreviewId(null);
    setPreviewMessage('');
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
          const isPreviewing = previewId === doc.id;

          return (
            <div
              key={doc.id}
              className={cn(
                'rounded-lg border p-2.5',
                isCritical ? 'border-red-500/30 bg-red-500/5' : isWarning ? 'border-orange-500/30 bg-orange-500/5' : 'border-border/50 bg-muted/20',
                isRTL && 'text-right'
              )}
            >
              <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
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
                  onClick={() => isPreviewing ? closePreview() : openPreview(doc, daysOverdue)}
                  className={cn(
                    'h-8 px-2.5 font-semibold gap-1 shrink-0',
                    isPreviewing
                      ? 'border-muted text-muted-foreground hover:bg-muted/50'
                      : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300'
                  )}
                >
                  {isPreviewing ? <X className="h-3 w-3" /> : <Send className="h-3 w-3" />}
                  <span className={cn('text-[10px] hidden sm:inline', isRTL && 'font-cairo')}>
                    {isPreviewing ? (isRTL ? 'إلغاء' : 'Annuler') : (isRTL ? 'تذكير' : 'Relancer')}
                  </span>
                </Button>
              </div>

              {isPreviewing && (
                <div className={cn('mt-3 space-y-2', isRTL && 'font-cairo')}>
                  <div className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', isRTL && 'flex-row-reverse')}>
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>{isRTL ? 'مراجعة الرسالة قبل الإرسال' : 'Prévisualiser le message avant envoi'}</span>
                  </div>
                  <Textarea
                    value={previewMessage}
                    onChange={(e) => setPreviewMessage(e.target.value)}
                    className={cn('min-h-[120px] text-sm bg-background', isRTL && 'text-right font-cairo')}
                    dir={isRTL ? 'rtl' : 'ltr'}
                  />
                  <div className={cn('flex gap-2', isRTL && 'flex-row-reverse')}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={closePreview}
                      className="flex-1 h-9 text-xs"
                    >
                      {isRTL ? 'إلغاء' : 'Annuler'}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleConfirmSend(doc)}
                      className="flex-1 h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                    >
                      <Send className="h-3 w-3" />
                      {isRTL ? 'إرسال بالواتساب' : 'Envoyer par WhatsApp'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UnpaidInvoicesBlock;
