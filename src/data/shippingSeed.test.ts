import { describe, expect, it } from 'vitest';
import { estimateProductShipping } from './shippingSeed';

describe('estimateProductShipping', () => {
  it('applies TrueLock free shipping only above the published threshold', () => {
    expect(estimateProductShipping('truelock-hd-ribbed-flow-through-12in', 10_001)).toMatchObject({
      costCents: 0,
      source: { checkedDate: '2026-07-31' },
    });
    expect(estimateProductShipping('truelock-hd-ribbed-flow-through-12in', 10_000).costCents).toBe(
      null
    );
  });

  it('keeps other sellers unknown rather than treating shipping as free', () => {
    expect(estimateProductShipping('racedeck-free-flow', 100_000).costCents).toBeNull();
  });
});
