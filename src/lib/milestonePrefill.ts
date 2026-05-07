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

const round2 = (v: number) => Math.round(v * 100) / 100;

const formatCurrency = (a: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(a);

const formatPercent = (v: number) =>
  new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: Number.isInteger(v) ? 0 : 2,
  }).format(v);

function getMilestoneInvoiceLabel(index: number, total: number): { fr: string; ar: string } {
  if (index === 0) return { fr: "Facture d'acompte", ar: 'فاتورة مقدم' };
  if (index === total - 1) return { fr: 'Facture finale', ar: 'فاتورة نهائية' };
  return { fr: 'Facture intermédiaire', ar: 'فاتورة مرحلية' };
}

export function buildMilestonePrefill({
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
  const sharePercent = milestone.mode === 'percent'
    ? milestone.percent || 0
    : (quote.totalTTC > 0 ? round2(((milestone.amount || 0) / quote.totalTTC) * 100) : 0);
  const proportion = sharePercent / 100;
  const subtotalHT = docData.subtotalAfterDiscount ?? docData.subtotal ?? docData.subtotalHT ?? docData.totalHT ?? 0;
  const milestoneHT = round2(subtotalHT * proportion);
  const displayedShare = `${formatPercent(sharePercent)}%`;
  const selectedMilestoneName = milestone.label?.trim() || milestoneLabel.fr;
  const echeanceTag = `Échéance ${milestoneIndex + 1}/${totalMilestones} — Réf. devis ${quote.documentNumber}`;
  const designationFr = `${echeanceTag} — ${selectedMilestoneName} (${displayedShare})`;
  const formNatureOperation = ['service', 'goods', 'mixed'].includes(docData.natureOperation)
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
      designation_ar: '',
      quantity: 1,
      unit: 'forfait',
      unitPrice: milestoneHT,
    }],
    acompteLabel: `Acompte de ${displayedShare}`,
    notes: `Facture d'échéance : ${selectedMilestoneName}\nPaiement de ${displayedShare} sur devis n° ${quote.documentNumber}\nMontant total du devis : ${formatCurrency(quote.totalTTC)} TTC`,
    source: 'milestone_invoice',
    sourceDocumentId: quote.id,
    sourceDocumentNumber: quote.documentNumber,
    milestoneIndex,
    milestoneLabel: selectedMilestoneName,
    milestonePercent: sharePercent,
    milestoneMontantTTC: round2(quote.totalTTC * proportion),
    milestonesEnabled: false,
    paymentMilestones: [],
    acompteEnabled: false,
    discountEnabled: false,
  };
}
