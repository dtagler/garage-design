export interface DestinationTax {
  readonly label: string;
  readonly salesTaxBasisPoints: number;
  readonly sourceUrl: string;
  readonly checkedDate: string;
}

export interface DestinationCostEstimate {
  readonly merchandiseSubtotalCents: number;
  readonly shippingCostCents: number | null;
  readonly estimatedTaxCents: number;
  readonly totalBeforeShippingCents: number;
  readonly estimatedCheckoutTotalCents: number | null;
}

export const ILLINOIS_STATE_DESTINATION: DestinationTax = {
  label: 'Illinois state',
  salesTaxBasisPoints: 625,
  sourceUrl: 'https://mytax.illinois.gov/',
  checkedDate: '2026-07-31',
};

/**
 * Shipping is not included in the taxable base because seller-specific shipping tax treatment
 * cannot be known until checkout. The result makes that limitation visible instead of inventing
 * a destination total.
 */
export function calculateDestinationCost(
  merchandiseSubtotalCents: number,
  shippingCostCents: number | null,
  destination: DestinationTax
): DestinationCostEstimate {
  assertNonNegativeSafeInteger(merchandiseSubtotalCents, 'merchandise subtotal');
  if (shippingCostCents !== null) {
    assertNonNegativeSafeInteger(shippingCostCents, 'shipping cost');
  }
  assertNonNegativeSafeInteger(destination.salesTaxBasisPoints, 'sales tax basis points');

  const estimatedTaxCents = Math.round(
    (merchandiseSubtotalCents * destination.salesTaxBasisPoints) / 10_000
  );
  const totalBeforeShippingCents = merchandiseSubtotalCents + estimatedTaxCents;
  const estimatedCheckoutTotalCents =
    shippingCostCents === null ? null : totalBeforeShippingCents + shippingCostCents;

  assertNonNegativeSafeInteger(estimatedTaxCents, 'estimated tax');
  assertNonNegativeSafeInteger(totalBeforeShippingCents, 'total before shipping');
  if (estimatedCheckoutTotalCents !== null) {
    assertNonNegativeSafeInteger(estimatedCheckoutTotalCents, 'estimated checkout total');
  }

  return {
    merchandiseSubtotalCents,
    shippingCostCents,
    estimatedTaxCents,
    totalBeforeShippingCents,
    estimatedCheckoutTotalCents,
  };
}

export function describeShippingEstimate(shippingCostCents: number | null): string {
  if (shippingCostCents === null) {
    return 'Not published for this Illinois order; calculate at seller checkout';
  }
  if (shippingCostCents === 0) {
    return 'Free shipping (verified)';
  }
  return `${formatMoney(shippingCostCents)} (verified)`;
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function assertNonNegativeSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer.`);
  }
}
