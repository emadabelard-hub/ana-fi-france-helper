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

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

const normalizeMoney = (value: number | undefined): number => {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, roundMoney(value));
};

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

  const explicitDiscount = normalizeMoney(discountAmount);

  let computedDiscount = explicitDiscount;
  if (computedDiscount <= 0) {
    const normalizedDiscountValue = normalizeMoney(discountValue);
    if (normalizedDiscountValue > 0 && discountType) {
      if (discountType === 'percent') {
        const percent = Math.min(normalizedDiscountValue, 100);
        computedDiscount = roundMoney(normalizedSubtotal * (percent / 100));
      } else {
        computedDiscount = normalizedDiscountValue;
      }
    }
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