import { describe, expect, it } from 'vitest';
import {
  ILLINOIS_STATE_DESTINATION,
  calculateDestinationCost,
  describeShippingEstimate,
} from './landedCost';

describe('calculateDestinationCost', () => {
  it('calculates Illinois state tax in integer cents and leaves unknown shipping unresolved', () => {
    expect(calculateDestinationCost(100_00, null, ILLINOIS_STATE_DESTINATION)).toEqual({
      merchandiseSubtotalCents: 100_00,
      shippingCostCents: null,
      estimatedTaxCents: 6_25,
      totalBeforeShippingCents: 106_25,
      estimatedCheckoutTotalCents: null,
    });
  });

  it('includes a known shipping charge in the checkout total without assuming it is taxable', () => {
    expect(calculateDestinationCost(100_00, 25_00, ILLINOIS_STATE_DESTINATION)).toEqual({
      merchandiseSubtotalCents: 100_00,
      shippingCostCents: 25_00,
      estimatedTaxCents: 6_25,
      totalBeforeShippingCents: 106_25,
      estimatedCheckoutTotalCents: 131_25,
    });
  });

  it('rejects invalid cent values', () => {
    expect(() => calculateDestinationCost(-1, null, ILLINOIS_STATE_DESTINATION)).toThrow(
      RangeError
    );
    expect(() => calculateDestinationCost(100, 1.5, ILLINOIS_STATE_DESTINATION)).toThrow(
      RangeError
    );
  });
});

describe('describeShippingEstimate', () => {
  it('does not present an unverified shipping charge as free', () => {
    expect(describeShippingEstimate(null)).toMatch(/not published/i);
    expect(describeShippingEstimate(null)).toMatch(/checkout/i);
    expect(describeShippingEstimate(0)).toBe('Free shipping (verified)');
  });
});
