/**
 * Extract advanced prefill fields from a saved document's document_data (InvoiceData).
 * Maps stored InvoiceData fields back to form state field names.
 */
export function extractAdvancedPrefillData(docData: any) {
  if (!docData) return {};

  // Reverse-map tvaRegime → projectTvaType + isAutoEntrepreneur
  const tvaRegime = docData.tvaRegime;
  const tvaExempt = docData.tvaExempt === true;
  const tvaRate = docData.tvaRate ?? 10;

  let isAutoEntrepreneur = false;
  let projectTvaType: string = 'logement_ancien';

  if (tvaExempt || tvaRegime === 'franchise') {
    isAutoEntrepreneur = true;
  } else if (tvaRegime === 'autoliquidation') {
    projectTvaType = 'sous_traitance';
  } else if (tvaRegime === 'intracommunautaire') {
    projectTvaType = 'intracommunautaire';
  } else if (tvaRate === 20) {
    projectTvaType = 'logement_neuf';
  } else {
    projectTvaType = 'logement_ancien';
  }

  const selectedTvaRate = (tvaRate === 20 ? 20 : tvaRate === 5.5 ? 5.5 : 10) as 5.5 | 10 | 20;

  // Reverse-map paymentDeadline / paymentTerms → delaiPaiement
  let delaiPaiement = '30jours';
  if (docData.paymentDeadline === 'immediate') {
    delaiPaiement = 'immediate';
  } else if (docData.paymentDeadline === 'echeancier') {
    delaiPaiement = 'echeancier';
  } else if (docData.dueDate) {
    // Try to infer from paymentTerms text
    const pt = docData.paymentTerms || '';
    if (pt.includes('15 jours')) delaiPaiement = '15jours';
    else if (pt.includes('45 jours')) delaiPaiement = '45jours';
    else if (pt.includes('60 jours')) delaiPaiement = '60jours';
    else delaiPaiement = '30jours';
  }

  // Reverse-map moyenPaiement from paymentTerms text
  let moyenPaiement = 'virement';
  const pt = docData.paymentTerms || '';
  if (pt.includes('Chèque')) moyenPaiement = 'cheque';
  else if (pt.includes('Espèces')) moyenPaiement = 'especes';

  // Acompte
  const acompteEnabled = !!(docData.acomptePercent || docData.acompteAmount);
  const acompteMode = docData.acompteMode || 'percent';
  const acomptePercent = docData.acomptePercent ?? 30;
  const acompteFixedAmount = (acompteMode === 'fixed' && docData.acompteAmount) ? docData.acompteAmount : 0;

  // Milestones
  const paymentMilestones = docData.paymentMilestones || [];
  const milestonesEnabled = paymentMilestones.length > 0;

  // Discount
  const discountEnabled = !!(docData.discountAmount && docData.discountAmount > 0);
  const discountType = docData.discountType || 'percent';
  const discountValue = docData.discountValue ?? 0;

  // Dates — stored as formatted fr-FR strings, convert back to ISO for date inputs
  let estimatedStartDate = '';
  if (docData.estimatedStartDate) {
    // Try to parse "DD/MM/YYYY" → "YYYY-MM-DD"
    const parts = docData.estimatedStartDate.split('/');
    if (parts.length === 3) {
      estimatedStartDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  const estimatedDuration = docData.estimatedDuration || '';

  const result: Record<string, any> = {
    isAutoEntrepreneur,
    selectedTvaRate,
    projectTvaType,
    delaiPaiement,
    moyenPaiement,
    acompteEnabled,
    acomptePercent,
    acompteMode,
    acompteFixedAmount,
    milestonesEnabled,
    paymentMilestones,
    discountEnabled,
    discountType,
    discountValue,
    estimatedStartDate,
    estimatedDuration,
  };

  // Description
  if (docData.descriptionChantier) {
    result.descriptionChantier = docData.descriptionChantier;
  }

  console.log('[extractAdvancedPrefillData] Extracted:', {
    tvaRate: selectedTvaRate,
    projectTvaType,
    isAutoEntrepreneur,
    delaiPaiement,
    moyenPaiement,
    acompteEnabled,
    milestonesEnabled,
    milestones: paymentMilestones.length,
    discountEnabled,
    estimatedStartDate,
    estimatedDuration,
  });

  return result;
}
