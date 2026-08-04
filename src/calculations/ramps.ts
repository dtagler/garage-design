/**
 * Front transition ramp quantities and cost.
 *
 * Two rules drive everything here:
 *
 * 1. Ramps cross door openings only. Wall segments contribute nothing, so a center wall between
 *    two single doors is never bridged by a ramp piece.
 * 2. Each opening is planned on its own. A piece bought for one opening cannot be "shared" with
 *    the next one across a wall, so every opening rounds up independently. The only exception is
 *    an accessory the vendor publishes as trim-to-length, which unlocks an explicit offcut
 *    strategy instead of a silent assumption.
 */

import {
  assertRampAccessory,
  getRampCompatibility,
  getRampUnavailableReason,
  listRampAccessoriesForProduct,
  RAMP_PRICING_DISCLAIMER,
  type RampAccessorySeed,
  type RampCompatibility,
} from '../data/accessories/rampSeed';
import type { GarageFrontGeometry, GarageFrontOpening } from '../garage-front';

/** Length comparisons tolerate a thousandth of an inch of floating-point drift. */
const LENGTH_EPSILON_INCHES = 0.001;

export type RampCutStrategy = 'whole-pieces-per-opening' | 'cut-to-length-with-offcuts';

export interface RampOpeningPlan {
  readonly openingId: string;
  readonly openingLabel: string;
  readonly openingWidthInches: number;
  /** Straight pieces consumed at this opening. */
  readonly segmentsRequired: number;
  readonly purchasedLengthInches: number;
  /**
   * Ramp length bought for this opening that nothing uses. Never negative, and per-opening
   * leftovers add up to the plan's cut waste before whole-kit surplus is included.
   */
  readonly leftoverInches: number;
  /** True when the opening is a whole number of ramp pieces wide. */
  readonly isExactFit: boolean;
  /** True when a cut piece charged to another opening finishes this one. */
  readonly usesSharedOffcut: boolean;
  readonly description: string;
}

export interface RampPlan {
  readonly status: 'available';
  readonly productId: string;
  readonly accessory: RampAccessorySeed;
  readonly compatibility: RampCompatibility;
  readonly cutStrategy: RampCutStrategy;
  readonly cutStrategyExplanation: string;
  readonly openings: readonly RampOpeningPlan[];
  readonly totalOpeningInches: number;
  readonly totalSegments: number;
  /** Total linear length included in the sale units that must be bought. */
  readonly totalPurchasedLengthInches: number;
  /** Unused length from the pieces allocated to openings, excluding unopened surplus pieces. */
  readonly totalCutWasteInches: number;
  /** All purchased length not covering an opening, including whole surplus kit pieces. */
  readonly totalLeftoverInches: number;
  /** Sale units (single pieces or kits) to buy. */
  readonly saleUnitsRequired: number;
  readonly straightSegmentsPurchased: number;
  /** Straight pieces bought but not used, because kits are sold whole. */
  readonly surplusSegments: number;
  readonly totalCostCents: number;
  readonly currency: string;
  readonly priceIsEstimate: true;
  readonly alternatives: readonly RampAccessorySeed[];
  readonly caveats: readonly string[];
  /**
   * Ramps are measured along complete door openings. Their transverse profile may bridge the
   * front expansion clearance, but that clearance never reduces opening length or ramp quantity.
   */
  readonly expansionClearanceFact: string;
  readonly description: string;
}

export interface RampUnavailable {
  readonly status: 'unavailable';
  readonly productId: string;
  readonly reason: string;
}

export type RampResult = RampPlan | RampUnavailable;

export interface RampPlanOptions {
  /** Force a specific accessory instead of the best-ranked compatible one. */
  readonly accessoryId?: string;
}

export function isRampPlan(result: RampResult): result is RampPlan {
  return result.status === 'available';
}

/**
 * Plans ramps for a product across a garage front.
 *
 * Returns an explicit `unavailable` result when no compatible accessory could be verified. A
 * generic stand-in ramp is never substituted, because the quantities and cost would be fiction.
 */
export function planFrontRamps(
  productId: string,
  geometry: GarageFrontGeometry,
  options: RampPlanOptions = {}
): RampResult {
  const compatible = listRampAccessoriesForProduct(productId);

  if (compatible.length === 0) {
    return {
      status: 'unavailable',
      productId,
      reason:
        getRampUnavailableReason(productId) ??
        `No front transition ramp compatible with "${productId}" has been verified, so no ramp ` +
          'quantity or cost can be estimated.',
    };
  }

  const accessory =
    options.accessoryId === undefined
      ? compatible[0]
      : compatible.find((candidate) => candidate.id === options.accessoryId);

  if (accessory === undefined) {
    return {
      status: 'unavailable',
      productId,
      reason:
        `Ramp accessory "${String(options.accessoryId)}" is not recorded as compatible with ` +
        `"${productId}".`,
    };
  }

  return buildPlan(productId, accessory, compatible, geometry);
}

/** Every compatible accessory planned against the same front, best-ranked first. */
export function planFrontRampAlternatives(
  productId: string,
  geometry: GarageFrontGeometry
): readonly RampResult[] {
  const compatible = listRampAccessoriesForProduct(productId);

  if (compatible.length === 0) {
    return [planFrontRamps(productId, geometry)];
  }

  return compatible.map((accessory) => buildPlan(productId, accessory, compatible, geometry));
}

/**
 * Plans a front using an explicit accessory record rather than the seeded catalog. Useful for
 * pricing a listing the catalog does not carry yet; the accessory must still declare the product
 * it is compatible with, so an unrelated part cannot be priced against a floor by accident.
 */
export function planFrontRampsWithAccessory(
  productId: string,
  accessory: RampAccessorySeed,
  geometry: GarageFrontGeometry
): RampPlan {
  return buildPlan(productId, accessory, [accessory], geometry);
}

function buildPlan(
  productId: string,
  accessory: RampAccessorySeed,
  compatible: readonly RampAccessorySeed[],
  geometry: GarageFrontGeometry
): RampPlan {
  const compatibility = getRampCompatibility(accessory, productId);
  if (compatibility === undefined) {
    throw new Error(
      `Ramp accessory "${accessory.id}" is not compatible with product "${productId}".`
    );
  }
  assertRampAccessory(accessory);

  const cutStrategy: RampCutStrategy =
    accessory.cuttability === 'cuttable'
      ? 'cut-to-length-with-offcuts'
      : 'whole-pieces-per-opening';
  const openings =
    cutStrategy === 'cut-to-length-with-offcuts'
      ? planWithOffcuts(geometry.openings, accessory.segmentLengthInches)
      : geometry.openings.map((opening) => planWholePieces(opening, accessory.segmentLengthInches));

  const totalSegments = openings.reduce((total, opening) => total + opening.segmentsRequired, 0);
  const totalOpeningInches = round(
    openings.reduce((total, opening) => total + opening.openingWidthInches, 0)
  );
  const saleUnitsRequired = Math.ceil(totalSegments / accessory.straightSegmentsPerSaleUnit);
  const straightSegmentsPurchased = saleUnitsRequired * accessory.straightSegmentsPerSaleUnit;
  const surplusSegments = straightSegmentsPurchased - totalSegments;
  const totalPurchasedLengthInches = round(
    straightSegmentsPurchased * accessory.segmentLengthInches
  );
  const totalCutWasteInches = round(
    openings.reduce((total, opening) => total + opening.leftoverInches, 0)
  );
  const totalLeftoverInches = round(totalPurchasedLengthInches - totalOpeningInches);
  const totalCostCents = saleUnitsRequired * accessory.priceCents;

  const caveats = buildCaveats(accessory, compatibility, cutStrategy, surplusSegments);

  return {
    status: 'available',
    productId,
    accessory,
    compatibility,
    cutStrategy,
    cutStrategyExplanation: explainCutStrategy(accessory, cutStrategy),
    openings,
    totalOpeningInches,
    totalSegments,
    totalPurchasedLengthInches,
    totalCutWasteInches,
    totalLeftoverInches,
    saleUnitsRequired,
    straightSegmentsPurchased,
    surplusSegments,
    totalCostCents,
    currency: accessory.currency,
    priceIsEstimate: true,
    alternatives: compatible.filter((candidate) => candidate.id !== accessory.id),
    caveats,
    expansionClearanceFact:
      'Ramp quantities use the full door-opening widths. A ramp may bridge or cover front ' +
      'expansion clearance transversely, but no front-clearance amount is subtracted from its ' +
      'linear opening length.',
    description: describePlan(
      accessory,
      openings,
      totalSegments,
      saleUnitsRequired,
      totalCostCents,
      totalLeftoverInches
    ),
  };
}

function planWholePieces(
  opening: GarageFrontOpening,
  segmentLengthInches: number
): RampOpeningPlan {
  const segmentsRequired = Math.max(
    1,
    Math.ceil((opening.lengthInches - LENGTH_EPSILON_INCHES) / segmentLengthInches)
  );
  const leftoverInches = round(
    Math.max(0, segmentsRequired * segmentLengthInches - opening.lengthInches)
  );

  return toOpeningPlan(opening, segmentsRequired, segmentLengthInches, false, leftoverInches);
}

/**
 * Cut-to-length planning. Each opening still gets its own whole pieces for the full runs; the
 * short remainders are then packed into the minimum number of shared pieces so an offcut left by
 * one opening can finish another. No piece ever spans two openings: a remainder always sits
 * entirely within one opening, and a shared piece, along with whatever of it nobody used, is
 * charged to the opening that first drew from it.
 */
function planWithOffcuts(
  openings: readonly GarageFrontOpening[],
  segmentLengthInches: number
): readonly RampOpeningPlan[] {
  const wholePieces = openings.map((opening) =>
    Math.floor(opening.lengthInches / segmentLengthInches + LENGTH_EPSILON_INCHES)
  );
  const remainders = openings.map((opening, index) =>
    round(opening.lengthInches - (wholePieces[index] ?? 0) * segmentLengthInches)
  );

  const order = remainders
    .map((length, index) => ({ length, index }))
    .filter((entry) => entry.length > LENGTH_EPSILON_INCHES)
    .sort((left, right) => right.length - left.length || left.index - right.index);
  const bins = packRemaindersIntoMinimumPieces(order, segmentLengthInches);

  const chargedPieces = new Map<number, number>();
  const chargedWasteInches = new Map<number, number>();
  const borrowers = new Set<number>();
  for (const bin of bins) {
    const [owner, ...borrowed] = bin.shares;
    if (owner === undefined) {
      continue;
    }
    chargedPieces.set(owner, (chargedPieces.get(owner) ?? 0) + 1);
    chargedWasteInches.set(
      owner,
      round((chargedWasteInches.get(owner) ?? 0) + bin.remainingInches)
    );
    for (const index of borrowed) {
      borrowers.add(index);
    }
  }

  return openings.map((opening, index) => {
    const segments = (wholePieces[index] ?? 0) + (chargedPieces.get(index) ?? 0);
    return toOpeningPlan(
      opening,
      segments,
      segmentLengthInches,
      borrowers.has(index),
      chargedWasteInches.get(index) ?? 0
    );
  });
}

interface RemainderEntry {
  readonly length: number;
  readonly index: number;
}

interface RemainderBin {
  readonly remainingInches: number;
  readonly shares: readonly number[];
}

/**
 * Exact bin packing for cuttable offcuts.
 *
 * Garage fronts have few openings, so a branch-and-bound feasibility search is both fast and
 * preferable to a greedy heuristic that can charge an unnecessary ramp piece. Lengths are scaled
 * to thousandths of an inch, matching the planner's length arithmetic. Coarser scaling can round
 * two legal remainders down enough to fit a piece they physically exceed.
 */
function packRemaindersIntoMinimumPieces(
  entries: readonly RemainderEntry[],
  segmentLengthInches: number
): readonly RemainderBin[] {
  if (entries.length === 0) return [];

  const scale = 1000;
  const capacity = Math.round(segmentLengthInches * scale);
  const items = entries.map((entry) => ({
    index: entry.index,
    length: Math.round(entry.length * scale),
  }));
  const totalLength = items.reduce((total, item) => total + item.length, 0);
  const greedy = packFirstFit(items, capacity);
  const minimumBinCount = Math.ceil(totalLength / capacity);

  for (let binCount = minimumBinCount; binCount <= greedy.length; binCount++) {
    const bins = Array.from({ length: binCount }, () => ({
      remaining: capacity,
      shares: [] as number[],
    }));
    const failedStates = new Set<string>();

    if (placeRemainder(0, items, bins, failedStates)) {
      return bins
        .filter((bin) => bin.shares.length > 0)
        .map((bin) => ({
          remainingInches: round(bin.remaining / scale),
          shares: bin.shares,
        }));
    }
  }

  return greedy.map((bin) => ({
    remainingInches: round(bin.remaining / scale),
    shares: bin.shares,
  }));
}

function packFirstFit(
  items: readonly { readonly index: number; readonly length: number }[],
  capacity: number
): { remaining: number; shares: number[] }[] {
  const bins: { remaining: number; shares: number[] }[] = [];
  for (const item of items) {
    const bin = bins.find((candidate) => candidate.remaining >= item.length);
    if (bin === undefined) {
      bins.push({ remaining: capacity - item.length, shares: [item.index] });
    } else {
      bin.remaining -= item.length;
      bin.shares.push(item.index);
    }
  }
  return bins;
}

function placeRemainder(
  itemIndex: number,
  items: readonly { readonly index: number; readonly length: number }[],
  bins: { remaining: number; shares: number[] }[],
  failedStates: Set<string>
): boolean {
  if (itemIndex === items.length) return true;

  const stateKey = `${String(itemIndex)}|${bins
    .map((bin) => bin.remaining)
    .sort((left, right) => right - left)
    .join(',')}`;
  if (failedStates.has(stateKey)) return false;

  const item = items[itemIndex];
  const triedRemaining = new Set<number>();
  for (const bin of bins) {
    if (bin.remaining < item.length || triedRemaining.has(bin.remaining)) continue;
    triedRemaining.add(bin.remaining);
    const wasEmpty = bin.shares.length === 0;

    bin.remaining -= item.length;
    bin.shares.push(item.index);
    if (placeRemainder(itemIndex + 1, items, bins, failedStates)) return true;
    bin.shares.pop();
    bin.remaining += item.length;

    if (wasEmpty) break;
  }

  failedStates.add(stateKey);
  return false;
}

/**
 * `purchasedLengthInches` is the length charged to this opening, which for a shared piece also
 * covers the part another opening cut from it. `leftoverInches` is the genuinely unused length,
 * so per-opening leftovers always add up to the plan total.
 */
function toOpeningPlan(
  opening: GarageFrontOpening,
  segmentsRequired: number,
  segmentLengthInches: number,
  usesSharedOffcut: boolean,
  leftoverInches: number
): RampOpeningPlan {
  const purchasedLengthInches = round(segmentsRequired * segmentLengthInches);
  const remainder = opening.lengthInches % segmentLengthInches;
  const isExactFit =
    remainder <= LENGTH_EPSILON_INCHES || segmentLengthInches - remainder <= LENGTH_EPSILON_INCHES;
  const fit = usesSharedOffcut
    ? ', finished with a cut piece shared with another opening'
    : isExactFit
      ? ', an exact fit'
      : `, ${formatNumber(leftoverInches)} inches left over`;

  return {
    openingId: opening.id,
    openingLabel: opening.label,
    openingWidthInches: opening.lengthInches,
    segmentsRequired,
    purchasedLengthInches,
    leftoverInches,
    isExactFit,
    usesSharedOffcut,
    description:
      `${opening.label} spans ${formatNumber(opening.lengthInches)} inches and needs ` +
      `${String(segmentsRequired)} ramp ${segmentsRequired === 1 ? 'piece' : 'pieces'} ` +
      `(${formatNumber(purchasedLengthInches)} inches${fit}).`,
  };
}

function explainCutStrategy(accessory: RampAccessorySeed, cutStrategy: RampCutStrategy): string {
  if (cutStrategy === 'cut-to-length-with-offcuts') {
    return (
      `${accessory.name} is published as trim-to-length, so each opening is filled with whole ` +
      `${formatNumber(accessory.segmentLengthInches)} inch pieces and the short remainders are ` +
      'cut from shared pieces. No piece is ever run across a wall between two openings.'
    );
  }

  return (
    `${accessory.name} publishes no trim-to-length guidance, so every opening is rounded up to ` +
    `whole ${formatNumber(accessory.segmentLengthInches)} inch pieces on its own. Pieces are ` +
    'never joined across a wall between openings.'
  );
}

function buildCaveats(
  accessory: RampAccessorySeed,
  compatibility: RampCompatibility,
  cutStrategy: RampCutStrategy,
  surplusSegments: number
): readonly string[] {
  const caveats: string[] = [...accessory.caveats];

  if (compatibility.basis === 'inferred') {
    caveats.unshift(`Compatibility is inferred, not published: ${compatibility.evidence}`);
  }
  if (accessory.saleUnit === 'kit' && surplusSegments > 0) {
    caveats.push(
      `Kits are sold whole, so ${String(surplusSegments)} straight ` +
        `${surplusSegments === 1 ? 'piece is' : 'pieces are'} bought but not used at a door opening.`
    );
  }
  if (cutStrategy === 'whole-pieces-per-opening') {
    caveats.push('Cut waste is counted per opening because pieces are not confirmed cuttable.');
  }
  caveats.push(RAMP_PRICING_DISCLAIMER);

  return Object.freeze(caveats);
}

function describePlan(
  accessory: RampAccessorySeed,
  openings: readonly RampOpeningPlan[],
  totalSegments: number,
  saleUnitsRequired: number,
  totalCostCents: number,
  totalLeftoverInches: number
): string {
  if (openings.length === 0) {
    return `${accessory.name}: this garage front has no door opening, so no ramp is needed.`;
  }

  const perOpening = openings.map((opening) => opening.description).join(' ');
  const saleUnitLabel =
    accessory.saleUnit === 'kit'
      ? `${String(saleUnitsRequired)} ${saleUnitsRequired === 1 ? 'kit' : 'kits'} of ${String(accessory.piecesPerSaleUnit)} pieces`
      : `${String(saleUnitsRequired)} ${saleUnitsRequired === 1 ? 'piece' : 'pieces'}`;

  return (
    `${perOpening} In total, ${String(totalSegments)} ramp ` +
    `${totalSegments === 1 ? 'piece' : 'pieces'} are needed, bought as ${saleUnitLabel} for an ` +
    `estimated ${formatCents(totalCostCents)}, leaving ${formatNumber(totalLeftoverInches)} ` +
    'inches of leftover ramp.'
  );
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function formatNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function formatCents(value: number): string {
  return `$${(value / 100).toFixed(2)}`;
}
