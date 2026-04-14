import { extractAdvancedPrefillData } from '@/lib/prefillAdvancedData';

type MilestoneLike = {
  id: string;
  label?: string;
  mode: 'percent' | 'fixed';
  percent?: number;
  amount?: number;
};

type QuoteSourceLike = {
  id?: string;
  documentNumber: string;
  clientName?: string;
  clientAddress?: string | null;
  clientPhone?: string | null;
  clientEmail?: string | null;
  clientSiren?: string | null;
  clientTvaIntra?: string | null;
  clientIsB2B?: boolean;
  workSiteAddress?: string | null;
  natureOperation?: string | null;
  totalTTC: number;
  documentData?: any;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

const formatPercent = (value: number) =>
  new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);

function getMilestoneInvoiceLabel(index: number, total: number): { fr: string; ar: string } {
  if (index === 0) {
    return { fr: "Facture d'acompte", ar: 'فاتورة مقدم' };
  }
  if (index === total - 1) {
    return { fr: 'Facture finale', ar: 'فاتورة نهائية' };
  }
  return { fr: 'Facture intermédiaire', ar: 'فاتورة مرحلية' };
}

export function buildMilestoneInvoicePrefill({
  quote,
  milestone,
  milestoneIndex,
  totalMilestones,
}: {
  quote: QuoteSourceLike;
  milestone: MilestoneLike;
  milestoneIndex: number;
  totalMilestones: number;
}) {
  const docData = quote.documentData || {};
  const advancedData = extractAdvancedPrefillData(docData);
  const milestoneLabel = getMilestoneInvoiceLabel(milestoneIndex, totalMilestones);
  const milestoneSharePercent = milestone.mode === 'percent'
    ? milestone.percent || 0
    : (quote.totalTTC > 0 ? round2(((milestone.amount || 0) / quote.totalTTC) * 100) : 0);
  const milestoneProportion = milestoneSharePercent / 100;
  const quoteSubtotalHT = docData.subtotalAfterDiscount ?? docData.subtotal ?? docData.subtotalHT ?? docData.totalHT ?? 0;
  const milestoneHT = round2(quoteSubtotalHT * milestoneProportion);
  const displayedShare = `${formatPercent(milestoneSharePercent)}%`;
  const selectedMilestoneName = milestone.label?.trim() || milestoneLabel.fr;
  const objetDevis = (quote.natureOperation || docData.natureOperation || docData.objet || '').trim();

  // Build professional designation: nature des travaux first, then acompte + devis ref
  const designationFr = objetDevis
    ? `${objetDevis} – Acompte de ${displayedShare} (selon devis n° ${quote.documentNumber})`
    : `Acompte de ${displayedShare} (selon devis n° ${quote.documentNumber})`;
  const designationAr = objetDevis
    ? `${objetDevis} – دفعة ${displayedShare} (حسب العرض رقم ${quote.documentNumber})`
    : `دفعة ${displayedShare} (حسب العرض رقم ${quote.documentNumber})`;

  return {
    ...advancedData,
    clientName: quote.clientName || docData.client?.name || '',
    clientAddress: quote.clientAddress || docData.client?.address || '',
    clientPhone: quote.clientPhone || docData.client?.phone || '',
    clientEmail: quote.clientEmail || docData.client?.email || '',
    clientSiren: quote.clientSiren || docData.client?.siren || '',
    clientTvaIntra: quote.clientTvaIntra || docData.client?.tvaIntra || '',
    clientIsB2B: quote.clientIsB2B ?? docData.client?.isB2B ?? false,
    workSiteAddress: quote.workSiteAddress || docData.workSite?.address || '',
    natureOperation: quote.natureOperation || docData.natureOperation || '',
    items: [{
      designation_fr: designationFr,
      designation_ar: designationAr,
      quantity: 1,
      unit: 'forfait',
      unitPrice: milestoneHT,
    }],
    notes: `Facture d’échéance : ${selectedMilestoneName}\nPaiement de ${displayedShare} sur devis n° ${quote.documentNumber}\nMontant total du devis : ${formatCurrency(quote.totalTTC)} TTC`,
    source: 'milestone_invoice',
    sourceDocumentId: quote.id,
    sourceDocumentNumber: quote.documentNumber,
    milestoneId: milestone.id,
    milestoneIndex,
    milestoneLabel: selectedMilestoneName,
    milestonesEnabled: false,
    paymentMilestones: [],
    acompteEnabled: false,
    discountEnabled: false,
  };
}