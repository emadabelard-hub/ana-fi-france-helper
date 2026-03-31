export type InvoiceDiscountType = 'percent' | 'fixed';

interface CalculateInvoiceTotalsInput {
  subtotal: number;
  tvaRate: number;
  tvaExempt?: boolean;
  discountType?: InvoiceDiscountType;
  discountValue?: number;
  discountAmount?: number;
}

interface InvoiceTotalsResult {
  discountAmount: number;
  subtotalAfterDiscount: number;
  tvaAmount: number;
  total: number;
}

interface ValidateInvoiceTotalsConsistencyInput extends CalculateInvoiceTotalsInput {
  computedSubtotalAfterDiscount?: number;
  computedTvaAmount: number;
  computedTotal: number;
}

export interface InvoiceTotalsConsistencyResult {
  isValid: boolean;
  reason?: 'zero_total' | 'subtotal_after_discount_mismatch' | 'tva_mismatch' | 'total_mismatch';
  expectedTotals: InvoiceTotalsResult;
}

const roundMoney = (value: number): number => Math.round(value * 100) / 100;
const EPSILON = 0.01;

const normalizeMoney = (value: number | undefined): number => {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, roundMoney(value));
};

const almostEqual = (a: number, b: number): boolean => Math.abs(a - b) <= EPSILON;

export const calculateInvoiceTotals = ({
  subtotal,
  tvaRate,
  tvaExempt = false,
  discountType,
  discountValue,
  discountAmount,
}: CalculateInvoiceTotalsInput): InvoiceTotalsResult => {
  const normalizedSubtotal = normalizeMoney(subtotal);
  const normalizedRate = normalizeMoney(tvaRate);

  const normalizedDiscountValue = normalizeMoney(discountValue);
  const explicitDiscount = normalizeMoney(discountAmount);

  let computedDiscount = 0;
  if (normalizedDiscountValue > 0 && discountType) {
    if (discountType === 'percent') {
      const percent = Math.min(normalizedDiscountValue, 100);
      computedDiscount = roundMoney(normalizedSubtotal * (percent / 100));
    } else {
      computedDiscount = normalizedDiscountValue;
    }
  } else {
    computedDiscount = explicitDiscount;
  }

  const appliedDiscount = Math.min(computedDiscount, normalizedSubtotal);
  const subtotalAfterDiscount = roundMoney(normalizedSubtotal - appliedDiscount);
  const tvaAmount = tvaExempt ? 0 : roundMoney(subtotalAfterDiscount * (normalizedRate / 100));
  const total = roundMoney(subtotalAfterDiscount + tvaAmount);

  return {
    discountAmount: appliedDiscount,
    subtotalAfterDiscount,
    tvaAmount,
    total,
  };
};

export const validateInvoiceTotalsConsistency = ({
  subtotal,
  tvaRate,
  tvaExempt = false,
  discountType,
  discountValue,
  discountAmount,
  computedSubtotalAfterDiscount,
  computedTvaAmount,
  computedTotal,
}: ValidateInvoiceTotalsConsistencyInput): InvoiceTotalsConsistencyResult => {
  const normalizedSubtotal = normalizeMoney(subtotal);
  const normalizedRate = normalizeMoney(tvaRate);
  const normalizedComputedTvaAmount = normalizeMoney(computedTvaAmount);
  const normalizedComputedTotal = normalizeMoney(computedTotal);

  const expectedTotals = calculateInvoiceTotals({
    subtotal,
    tvaRate,
    tvaExempt,
    discountType,
    discountValue,
    discountAmount,
  });

  const normalizedComputedSubtotalAfterDiscount =
    typeof computedSubtotalAfterDiscount === 'number'
      ? normalizeMoney(computedSubtotalAfterDiscount)
      : expectedTotals.subtotalAfterDiscount;

  if (!almostEqual(normalizedComputedSubtotalAfterDiscount, expectedTotals.subtotalAfterDiscount)) {
    return {
      isValid: false,
      reason: 'subtotal_after_discount_mismatch',
      expectedTotals,
    };
  }

  if (normalizedSubtotal > 0 && normalizedComputedTotal <= 0) {
    return {
      isValid: false,
      reason: 'zero_total',
      expectedTotals,
    };
  }

  const expectedTvaFromFormula = tvaExempt
    ? 0
    : roundMoney(normalizedComputedSubtotalAfterDiscount * (normalizedRate / 100));
  if (!almostEqual(normalizedComputedTvaAmount, expectedTvaFromFormula) || !almostEqual(normalizedComputedTvaAmount, expectedTotals.tvaAmount)) {
    return {
      isValid: false,
      reason: 'tva_mismatch',
      expectedTotals,
    };
  }

  const expectedTotalFromFormula = roundMoney(normalizedComputedSubtotalAfterDiscount + normalizedComputedTvaAmount);
  if (!almostEqual(normalizedComputedTotal, expectedTotalFromFormula) || !almostEqual(normalizedComputedTotal, expectedTotals.total)) {
    return {
      isValid: false,
      reason: 'total_mismatch',
      expectedTotals,
    };
  }

  return {
    isValid: true,
    expectedTotals,
  };
};