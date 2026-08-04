import { TRUELOCK_CHECKED_DATE, type SourceReference } from './seedTypes';

export interface ProductShippingEstimate {
  readonly costCents: number | null;
  readonly explanation: string;
  readonly source?: SourceReference;
}

const TRUELOCK_FREE_SHIPPING_SOURCE: SourceReference = {
  url: 'https://www.garageflooringllc.com/free-shipping/',
  kind: 'manufacturer-store',
  checkedDate: TRUELOCK_CHECKED_DATE,
  quote:
    'Every order over $100 shipped to the Contiguous United States ships free of charge for the original order.',
};

export function estimateProductShipping(
  productId: string,
  merchandiseSubtotalCents: number
): ProductShippingEstimate {
  if (!Number.isSafeInteger(merchandiseSubtotalCents) || merchandiseSubtotalCents < 0) {
    throw new RangeError('merchandise subtotal must be a non-negative safe integer.');
  }

  if (productId === 'truelock-hd-ribbed-flow-through-12in' && merchandiseSubtotalCents > 10_000) {
    return {
      costCents: 0,
      explanation:
        'Free shipping is published for orders over $100 to the contiguous United States. ' +
        'Orders over 1,000 square feet may ship by freight.',
      source: TRUELOCK_FREE_SHIPPING_SOURCE,
    };
  }

  return {
    costCents: null,
    explanation:
      'The seller does not publish a verifiable Illinois shipping charge for this order.',
  };
}
