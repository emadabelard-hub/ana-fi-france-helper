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
    return { fr: "Facture d'acompte", ar: '\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0642\u062F\u0645' };
  }
  if (index === total - 1) {
    return { fr: 'Facture finale', ar: '\u0641\u0627\u062A\u0648\u0631\u0629 \u0646\u0647\u0627\u0626\u064A\u0629' };
  }
  return { fr: 'Facture interm\u00E9diaire', ar: '\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0631\u062D\u0644\u064A\u0629' };
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

  // Désignation = description de l'échéance + pourcentage + numéro du devis
  // (jamais les lignes de désignation du devis source)
  const designationFr = `${selectedMilestoneName} – ${displayedShare} selon devis n°${quote.documentNumber}`;
  const designationAr = '';
  const formNatureOperation = docData.natureOperation === 'service'
    || docData.natureOperation === 'goods'
    || docData.natureOperation === 'mixed'
    ? docData.natureOperation
    : undefined;

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
    natureOperation: formNatureOperation,
    items: [{
      designation_fr: designationFr,
      designation_ar: designationAr,
      quantity: 1,
      unit: 'forfait',
      unitPrice: milestoneHT,
    }],
    acompteLabel: `Acompte de ${displayedShare}`,
    notes: `Facture d'\u00E9ch\u00E9ance : ${selectedMilestoneName}\nPaiement de ${displayedShare} sur devis n\u00B0 ${quote.documentNumber}\nMontant total du devis : ${formatCurrency(quote.totalTTC)} TTC`,
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
