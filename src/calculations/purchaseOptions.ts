import type { ProductColorId, ProductId, ProductPrice } from '../domain/catalog';

/**
 * The source metadata travels with an offer so a recommendation can always identify the seller
 * and listing that support it. `SeedPrice` satisfies this shape without coupling calculations to
 * the seed-data module.
 */
export interface TilePurchaseOffer {
  readonly price: ProductPrice;
  readonly seller: string;
  readonly sourceKind: string;
  readonly basisLabel: string;
  /** True when this exact offer's source, price, or basis came from a user override. */
  readonly isOverridden?: boolean;
}

export interface PurchaseOptimizationInput {
  readonly productId: ProductId;
  /**
   * A color-specific offer is eligible only when this id exactly matches. When no color is chosen,
   * only catalog-wide offers can be used.
   */
  readonly colorId?: ProductColorId;
  readonly requiredTileCount: number;
  readonly offers: readonly TilePurchaseOffer[];
}

export interface PurchasedPack {
  readonly offer: TilePurchaseOffer;
  readonly packCount: number;
  readonly tilesPerPack: number;
  readonly purchasedTileCount: number;
  readonly costCents: number;
}

export interface PurchasedIndividualTiles {
  readonly offer: TilePurchaseOffer;
  readonly tileCount: number;
  readonly costCents: number;
}

export interface InvalidPurchaseOffer {
  readonly offer: TilePurchaseOffer;
  readonly reason: string;
}

export type PurchaseOptimizationStatus =
  'optimized' | 'no-applicable-offers' | 'no-fixed-tile-offers';

/**
 * A real purchase recommendation, rather than a normalized price. Square-foot listings are kept
 * visible as exclusions because they have no verified fixed number of tiles to buy.
 */
export interface PurchaseOptimization {
  readonly status: PurchaseOptimizationStatus;
  readonly requiredTileCount: number;
  readonly totalPurchasedTileCount: number;
  readonly leftoverTileCount: number;
  readonly totalCostCents: number | null;
  readonly packPurchases: readonly PurchasedPack[];
  readonly individualPurchases: readonly PurchasedIndividualTiles[];
  readonly individualTileCount: number;
  readonly canBuyIndividually: boolean;
  readonly excludedSquareFootOffers: readonly TilePurchaseOffer[];
  readonly invalidOffers: readonly InvalidPurchaseOffer[];
  readonly explanation: string;
}

interface Candidate {
  readonly offer: TilePurchaseOffer;
  readonly tileCount: number;
}

interface PurchaseState {
  readonly costCents: number;
  readonly unitCount: number;
  readonly counts: readonly number[];
}

// This bounds browser work for user-entered price overrides while covering any realistic garage.
const MAXIMUM_OPTIMIZATION_PURCHASE_TILES = 20_000;

/**
 * Finds the least-cost way to cover one product/color's already-calculated required tile count.
 * Every fixed pack and verified individual-tile listing may participate, including listings from
 * different sellers. It never converts a square-foot price into an invented tile purchase.
 */
export function optimizeTilePurchase(input: PurchaseOptimizationInput): PurchaseOptimization {
  assertRequiredTileCount(input.requiredTileCount);

  const invalidOffers: InvalidPurchaseOffer[] = [];
  const squareFootOffers: TilePurchaseOffer[] = [];
  const candidates: Candidate[] = [];

  for (const offer of input.offers) {
    const invalidReason = validateOffer(offer, input.productId, input.requiredTileCount);
    if (invalidReason !== undefined) {
      invalidOffers.push({ offer, reason: invalidReason });
      continue;
    }

    if (!appliesToColor(offer.price, input.colorId)) {
      continue;
    }

    if (offer.price.saleUnit === 'square-foot') {
      squareFootOffers.push(offer);
      continue;
    }

    candidates.push({
      offer,
      tileCount: offer.price.saleUnit === 'tile' ? 1 : offer.price.packQuantity!,
    });
  }

  const orderedCandidates = [...candidates].sort(compareCandidates);
  const canBuyIndividually = orderedCandidates.some(
    (candidate) => candidate.offer.price.saleUnit === 'tile'
  );

  if (input.requiredTileCount === 0) {
    return {
      status: 'optimized',
      requiredTileCount: 0,
      totalPurchasedTileCount: 0,
      leftoverTileCount: 0,
      totalCostCents: 0,
      packPurchases: [],
      individualPurchases: [],
      individualTileCount: 0,
      canBuyIndividually,
      excludedSquareFootOffers: sortOffers(squareFootOffers),
      invalidOffers: sortInvalidOffers(invalidOffers),
      explanation: 'No tiles are required, so no purchase is needed.',
    };
  }

  if (orderedCandidates.length === 0) {
    return {
      status: squareFootOffers.length > 0 ? 'no-fixed-tile-offers' : 'no-applicable-offers',
      requiredTileCount: input.requiredTileCount,
      totalPurchasedTileCount: 0,
      leftoverTileCount: 0,
      totalCostCents: null,
      packPurchases: [],
      individualPurchases: [],
      individualTileCount: 0,
      canBuyIndividually: false,
      excludedSquareFootOffers: sortOffers(squareFootOffers),
      invalidOffers: sortInvalidOffers(invalidOffers),
      explanation:
        squareFootOffers.length > 0
          ? 'Only square-foot offers apply. They have no verified fixed tile count, so no tile purchase is calculated.'
          : 'No verified fixed pack or individual-tile offer applies to this product and color.',
    };
  }

  const maxTileCount = Math.max(...orderedCandidates.map((candidate) => candidate.tileCount));
  const maximumPurchase = input.requiredTileCount + maxTileCount - 1;
  const states: Array<PurchaseState | undefined> = Array.from(
    { length: maximumPurchase + 1 },
    () => undefined
  );
  states[0] = { costCents: 0, unitCount: 0, counts: orderedCandidates.map(() => 0) };

  for (let purchasedTileCount = 1; purchasedTileCount <= maximumPurchase; purchasedTileCount++) {
    let best: PurchaseState | undefined;
    for (let index = 0; index < orderedCandidates.length; index++) {
      const candidate = orderedCandidates[index];
      const prior = states[purchasedTileCount - candidate.tileCount];
      if (prior === undefined) continue;

      const next: PurchaseState = {
        costCents: prior.costCents + candidate.offer.price.priceCents,
        unitCount: prior.unitCount + 1,
        counts: prior.counts.map((count, countIndex) => (countIndex === index ? count + 1 : count)),
      };
      if (best === undefined || compareStates(next, best) < 0) {
        best = next;
      }
    }
    states[purchasedTileCount] = best;
  }

  const selected = states
    .slice(input.requiredTileCount)
    .flatMap((state, offset) =>
      state === undefined ? [] : [{ state, purchasedTileCount: input.requiredTileCount + offset }]
    )
    .sort(
      (left, right) =>
        left.state.costCents - right.state.costCents ||
        left.purchasedTileCount - right.purchasedTileCount ||
        left.state.unitCount - right.state.unitCount ||
        compareCounts(left.state.counts, right.state.counts)
    )[0];

  if (selected === undefined) {
    throw new RangeError('No fixed purchase combination can cover the requested tile quantity.');
  }

  const packPurchases: PurchasedPack[] = [];
  const individualPurchases: PurchasedIndividualTiles[] = [];
  for (let index = 0; index < orderedCandidates.length; index++) {
    const count = selected.state.counts[index];
    if (count === 0) continue;

    const candidate = orderedCandidates[index];
    const costCents = count * candidate.offer.price.priceCents;
    if (candidate.offer.price.saleUnit === 'pack') {
      packPurchases.push({
        offer: candidate.offer,
        packCount: count,
        tilesPerPack: candidate.tileCount,
        purchasedTileCount: count * candidate.tileCount,
        costCents,
      });
    } else {
      individualPurchases.push({ offer: candidate.offer, tileCount: count, costCents });
    }
  }

  const individualTileCount = individualPurchases.reduce(
    (total, purchase) => total + purchase.tileCount,
    0
  );
  const leftoverTileCount = selected.purchasedTileCount - input.requiredTileCount;

  return {
    status: 'optimized',
    requiredTileCount: input.requiredTileCount,
    totalPurchasedTileCount: selected.purchasedTileCount,
    leftoverTileCount,
    totalCostCents: selected.state.costCents,
    packPurchases,
    individualPurchases,
    individualTileCount,
    canBuyIndividually,
    excludedSquareFootOffers: sortOffers(squareFootOffers),
    invalidOffers: sortInvalidOffers(invalidOffers),
    explanation: buildExplanation(packPurchases, individualTileCount, leftoverTileCount),
  };
}

function appliesToColor(price: ProductPrice, colorId: ProductColorId | undefined): boolean {
  return price.colorId === undefined || (colorId !== undefined && price.colorId === colorId);
}

function validateOffer(
  offer: TilePurchaseOffer,
  productId: ProductId,
  requiredTileCount: number
): string | undefined {
  const { price } = offer;
  if (price.productId !== productId) return 'Offer belongs to a different product.';
  if (!Number.isSafeInteger(price.priceCents) || price.priceCents <= 0) {
    return 'Offer price must be a positive whole number of cents.';
  }
  if (price.saleUnit !== 'tile' && price.saleUnit !== 'pack' && price.saleUnit !== 'square-foot') {
    return 'Offer sale basis is not recognized.';
  }
  if (
    price.saleUnit === 'pack' &&
    (!Number.isSafeInteger(price.packQuantity) ||
      price.packQuantity === undefined ||
      price.packQuantity <= 0)
  ) {
    return 'Pack offer has no verified positive tile count.';
  }
  if (price.saleUnit !== 'pack' && price.packQuantity !== undefined) {
    return 'Only pack offers may declare a tile count per sale unit.';
  }
  const tilesPerUnit = price.saleUnit === 'pack' ? price.packQuantity! : 1;
  if (requiredTileCount + tilesPerUnit - 1 > MAXIMUM_OPTIMIZATION_PURCHASE_TILES) {
    return `Offer exceeds the ${String(MAXIMUM_OPTIMIZATION_PURCHASE_TILES)}-tile purchase optimization limit.`;
  }
  return undefined;
}

function assertRequiredTileCount(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError('required tile count must be a non-negative safe integer.');
  }
}

function compareCandidates(left: Candidate, right: Candidate): number {
  return (
    left.offer.price.id.localeCompare(right.offer.price.id) ||
    left.offer.seller.localeCompare(right.offer.seller) ||
    left.offer.price.sourceUrl.localeCompare(right.offer.price.sourceUrl)
  );
}

function compareStates(left: PurchaseState, right: PurchaseState): number {
  return (
    left.costCents - right.costCents ||
    left.unitCount - right.unitCount ||
    compareCounts(left.counts, right.counts)
  );
}

/** Prefer the lexically first offer when otherwise indistinguishable. */
function compareCounts(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < left.length; index++) {
    const difference = right[index] - left[index];
    if (difference !== 0) return difference;
  }
  return 0;
}

function sortOffers(offers: readonly TilePurchaseOffer[]): readonly TilePurchaseOffer[] {
  return [...offers].sort(
    (left, right) =>
      left.price.id.localeCompare(right.price.id) ||
      left.seller.localeCompare(right.seller) ||
      left.price.sourceUrl.localeCompare(right.price.sourceUrl)
  );
}

function sortInvalidOffers(
  offers: readonly InvalidPurchaseOffer[]
): readonly InvalidPurchaseOffer[] {
  return [...offers].sort((left, right) => left.offer.price.id.localeCompare(right.offer.price.id));
}

function buildExplanation(
  packPurchases: readonly PurchasedPack[],
  individualTileCount: number,
  leftoverTileCount: number
): string {
  const parts = [
    ...packPurchases.map(
      (purchase) =>
        `${String(purchase.packCount)} × ${purchase.offer.basisLabel} from ${purchase.offer.seller}`
    ),
    ...(individualTileCount === 0
      ? []
      : [`${String(individualTileCount)} individual tile${individualTileCount === 1 ? '' : 's'}`]),
  ];
  const leftovers =
    leftoverTileCount === 0
      ? 'with no leftovers'
      : `with ${String(leftoverTileCount)} leftover tile${leftoverTileCount === 1 ? '' : 's'}`;
  return `Lowest verified cost uses ${parts.join(' and ')} ${leftovers}.`;
}
