/**
 * View-model helpers that adapt the seed catalog, the calculation engine, and the persistence
 * shapes to the catalog and material-summary panels.
 *
 * Nothing here re-implements grid fit, rounding, waste, or cost arithmetic: every number comes
 * from `src/calculations/estimate.ts`, and every validation error comes from the domain parsers or
 * the saved-design service.
 */

import {
  calculateRequiredTileCount,
  calculateCoverage,
  calculateTileGrid,
  countLayoutTilesByProductAndColor,
  estimateTotalCost,
  getOrientedTileDimensions,
  type CostEstimate,
  type Coverage,
  type OrientedTileDimensions,
  type TileGrid,
} from '../../calculations/estimate';
import {
  optimizeTilePurchase,
  type PurchaseOptimization,
} from '../../calculations/purchaseOptions';
import {
  describePriceBasis,
  findSeedColor,
  findSeedProduct,
  SEED_CATALOG,
  tileAreaSquareFeet,
  tilesPerSaleUnit,
  type SeedPrice,
  type SeedProduct,
} from '../../data';
import {
  DomainValidationError,
  parseEditablePriceOverride,
  type CatalogOverrides,
  type EditablePriceOverride,
  type Manufacturer,
  type PriceId,
  type ProductColorId,
  type ProductId,
  type ProductPrice,
  type TileOrientation,
} from '../../domain/catalog';
import type { FloorLayout, GarageDimensions } from '../../domain/persistence';
import { layoutColorKey } from '../../domain/tileSymbols';
import { EMPTY_PERSISTED_APP_STATE, updateSettings } from '../../persistence/savedDesignService';

export const ALL_MANUFACTURERS = 'all';
export const ALL_TILE_SIZES = 'all';

export interface CatalogEntry {
  readonly manufacturer: Manufacturer;
  readonly trademarkNotice: string;
  readonly seedProduct: SeedProduct;
  /** Square tile edge used as the editor grid size, in inches. */
  readonly tileSizeInches: number;
}

export interface CatalogFilter {
  readonly manufacturerId: string;
  readonly tileSize: string;
  readonly search: string;
}

export const DEFAULT_CATALOG_FILTER: CatalogFilter = Object.freeze({
  manufacturerId: ALL_MANUFACTURERS,
  tileSize: ALL_TILE_SIZES,
  search: '',
});

export function listCatalogEntries(): readonly CatalogEntry[] {
  return SEED_CATALOG.manufacturers.flatMap((manufacturer) =>
    manufacturer.products.map((seedProduct) => ({
      manufacturer: manufacturer.manufacturer,
      trademarkNotice: manufacturer.trademarkNotice,
      seedProduct,
      tileSizeInches: seedProduct.product.dimensions.widthInches,
    }))
  );
}

/**
 * The entries the planner may offer.
 *
 * This tool plans garages that get wet, so a tile only earns a place when its vendor publishes an
 * open, perforated, or self-draining *top* surface. The closed-surface entries stay reachable
 * through {@link listCatalogEntries} - the comparison view and the seeded reference designs are
 * still written against them - but they are never a planner choice.
 */
export function listDrainableCatalogEntries(): readonly CatalogEntry[] {
  return listCatalogEntries().filter((entry) => entry.seedProduct.drainage.isDrainable);
}

/** Entries deliberately kept out of the planner, so a caller can explain the omission. */
export function listNonDrainableCatalogEntries(): readonly CatalogEntry[] {
  return listCatalogEntries().filter((entry) => !entry.seedProduct.drainage.isDrainable);
}

export function findCatalogEntry(
  entries: readonly CatalogEntry[],
  productId: ProductId | undefined
): CatalogEntry | null {
  if (productId === undefined) {
    return null;
  }

  return entries.find((entry) => entry.seedProduct.product.id === productId) ?? null;
}

/** Distinct square tile edges in the catalog, ascending, used for the grid-size filter. */
export function listTileSizeOptions(entries: readonly CatalogEntry[]): readonly number[] {
  return [...new Set(entries.map((entry) => entry.tileSizeInches))].sort((a, b) => a - b);
}

export function filterCatalogEntries(
  entries: readonly CatalogEntry[],
  filter: CatalogFilter
): readonly CatalogEntry[] {
  const search = filter.search.trim().toLowerCase();

  return entries.filter((entry) => {
    if (
      filter.manufacturerId !== ALL_MANUFACTURERS &&
      entry.manufacturer.id !== filter.manufacturerId
    ) {
      return false;
    }

    if (filter.tileSize !== ALL_TILE_SIZES && String(entry.tileSizeInches) !== filter.tileSize) {
      return false;
    }

    if (search.length === 0) {
      return true;
    }

    return [
      entry.manufacturer.name,
      entry.seedProduct.product.name,
      entry.seedProduct.surfaceStyle?.label ?? '',
      ...entry.seedProduct.colors.map((color) => color.color.name),
    ]
      .join(' ')
      .toLowerCase()
      .includes(search);
  });
}

export interface NormalizedOfferPricing {
  readonly perTileCents: number;
  readonly perSquareFootCents: number;
}

/**
 * Per-tile and per-square-foot prices for one offer. Square-foot listings cover no fixed tile
 * count, so the per-tile figure is derived from the tile's own face area rather than invented.
 */
export function normalizeOfferPricing(
  price: ProductPrice,
  dimensions: SeedProduct['product']['dimensions']
): NormalizedOfferPricing {
  const areaSquareFeet = tileAreaSquareFeet(dimensions);
  const tileCount = tilesPerSaleUnit(price);
  const perTileCents =
    tileCount === undefined ? price.priceCents * areaSquareFeet : price.priceCents / tileCount;

  return { perTileCents, perSquareFootCents: perTileCents / areaSquareFeet };
}

export function findPriceOverride(
  overrides: CatalogOverrides,
  priceId: PriceId
): EditablePriceOverride | undefined {
  return Object.hasOwn(overrides.priceOverridesById, priceId)
    ? overrides.priceOverridesById[priceId]
    : undefined;
}

export interface EffectiveOffer {
  /** The offer with any override applied, ready for the calculation engine. */
  readonly offer: SeedPrice;
  readonly seeded: SeedPrice;
  readonly isOverridden: boolean;
}

/** Applies a saved price override to a seeded offer without losing its source metadata. */
export function resolveEffectiveOffer(
  seeded: SeedPrice,
  overrides: CatalogOverrides
): EffectiveOffer {
  const override = findPriceOverride(overrides, seeded.price.id);
  if (override === undefined) {
    return { offer: seeded, seeded, isOverridden: false };
  }

  const price: ProductPrice = {
    id: seeded.price.id,
    productId: seeded.price.productId,
    ...(seeded.price.colorId === undefined ? {} : { colorId: seeded.price.colorId }),
    priceCents: override.priceCents,
    saleUnit: override.saleUnit,
    ...(override.packQuantity === undefined ? {} : { packQuantity: override.packQuantity }),
    sourceUrl: override.sourceUrl,
    checkedDate: override.checkedDate,
  };
  const tileCount = tilesPerSaleUnit(price);

  return {
    offer: {
      ...seeded,
      price,
      basisLabel: describePriceBasis(price),
      ...(tileCount === undefined ? {} : { tilesPerSaleUnit: tileCount }),
    },
    seeded,
    isOverridden: true,
  };
}

/** Offers that may legitimately be applied to a color: catalog-wide offers plus its own. */
export function listApplicableOffers(
  seedProduct: SeedProduct,
  colorId: ProductColorId | undefined
): readonly SeedPrice[] {
  // A color-specific listing says nothing about any other color, and nothing about a tile with no
  // color chosen, so it is never borrowed. This matches the comparison module's rule.
  return seedProduct.prices.filter(
    (offer) => offer.price.colorId === undefined || offer.price.colorId === colorId
  );
}

/**
 * The offer used for a color: the explicitly chosen one when it still applies, otherwise the first
 * applicable seeded offer. Seed order follows the seller's own listing order and is deterministic.
 */
export function selectOfferForColor(
  seedProduct: SeedProduct,
  colorId: ProductColorId | undefined,
  selectedPriceId: PriceId | undefined
): SeedPrice | undefined {
  const applicable = listApplicableOffers(seedProduct, colorId);
  const chosen =
    selectedPriceId === undefined
      ? undefined
      : applicable.find((offer) => offer.price.id === selectedPriceId);

  return chosen ?? applicable[0];
}

export interface GridFit {
  readonly garage: GarageDimensions;
  readonly tile: OrientedTileDimensions;
  readonly grid: TileGrid;
  readonly coverage: Coverage;
  /** Whole tiles the editor grid holds, which excludes the cut edge row and column. */
  readonly editorGrid: { readonly columns: number; readonly rows: number };
}

export function buildGridFit(
  garage: GarageDimensions,
  seedProduct: SeedProduct,
  orientation: TileOrientation
): GridFit {
  const tile = getOrientedTileDimensions(seedProduct.product, orientation);
  const grid = calculateTileGrid(garage, tile);

  return {
    garage,
    tile,
    grid,
    coverage: calculateCoverage(garage, tile, grid),
    editorGrid: { columns: grid.fullColumns, rows: grid.fullRows },
  };
}

export interface MaterialLine {
  readonly key: string;
  readonly productId: ProductId;
  readonly productName: string;
  readonly manufacturerName: string;
  readonly colorId?: ProductColorId;
  readonly colorName: string;
  readonly swatchHex: string;
  readonly tileCount: number;
  readonly offer?: SeedPrice;
  readonly seededPriceCents?: number;
  readonly isOverridden: boolean;
  readonly pricing?: NormalizedOfferPricing;
  /** Least-cost verified packs and individual tiles for this exact product/color. */
  readonly purchase?: PurchaseOptimization;
  readonly estimate?: CostEstimate;
  readonly issue?: string;
}

export interface MaterialSummary {
  readonly lines: readonly MaterialLine[];
  readonly placedTileCount: number;
  readonly wasteAllowancePercent: number;
  readonly requiredTileCount: number;
  /** Null when one or more lines have no computable fixed-tile purchase. */
  readonly totalCostCents: number | null;
  readonly issues: readonly string[];
}

export interface MaterialSummaryInput {
  readonly layout: Pick<FloorLayout, 'cellsById'>;
  readonly wasteAllowancePercent: number;
  readonly overrides: CatalogOverrides;
  /** Chosen offer per product and color, keyed by {@link offerSelectionKey}. */
  readonly offerIdBySelection: Readonly<Record<string, PriceId>>;
  /** Grid pitch the layout is painted on, used to flag tiles left over from a conversion. */
  readonly cellSizeInches?: number;
}

/**
 * Offers are chosen per product *and* color: sellers list colors of the same tile at different
 * prices, so one product-wide choice would silently re-price the other colors. The key format is
 * shared with {@link layoutColorKey} so material rows and canvas tiles resolve the same symbol.
 */
export function offerSelectionKey(
  productId: ProductId,
  colorId: ProductColorId | undefined
): string {
  return layoutColorKey(productId, colorId);
}

const UNKNOWN_SWATCH_HEX = '#8a9099';

export function buildMaterialSummary(input: MaterialSummaryInput): MaterialSummary {
  const counts = countLayoutTilesByProductAndColor(input.layout);
  const issues: string[] = [];
  let placedTileCount = 0;
  let requiredTileCount = 0;
  let totalCostCents: number | null = 0;

  const lines = counts.map((count): MaterialLine => {
    placedTileCount += count.tileCount;
    const key = offerSelectionKey(count.productId, count.colorId);
    const seedProduct = findSeedProduct(count.productId);

    if (!seedProduct) {
      totalCostCents = null;
      const issue = `"${count.productId}" is no longer in the catalog, so it cannot be priced.`;
      issues.push(issue);
      return {
        key,
        productId: count.productId,
        productName: count.productId,
        manufacturerName: 'Unknown',
        ...(count.colorId === undefined ? {} : { colorId: count.colorId }),
        colorName: count.colorId ?? 'Unspecified',
        swatchHex: UNKNOWN_SWATCH_HEX,
        tileCount: count.tileCount,
        isOverridden: false,
        issue,
      };
    }

    const color =
      count.colorId === undefined ? undefined : findSeedColor(count.productId, count.colorId);
    const base = {
      key,
      productId: count.productId,
      productName: seedProduct.product.name,
      manufacturerName: findManufacturerName(seedProduct.product.manufacturerId),
      ...(count.colorId === undefined ? {} : { colorId: count.colorId }),
      colorName: color?.color.name ?? 'Unspecified color',
      swatchHex: color?.color.swatchHex ?? UNKNOWN_SWATCH_HEX,
      tileCount: count.tileCount,
    };

    if (count.colorId !== undefined && color === undefined) {
      totalCostCents = null;
      const issue = `"${count.colorId}" is not a current color of ${base.productName}, so it cannot be priced.`;
      issues.push(issue);
      return { ...base, isOverridden: false, issue };
    }

    if (
      input.cellSizeInches !== undefined &&
      seedProduct.product.dimensions.widthInches !== input.cellSizeInches
    ) {
      issues.push(
        `${base.productName} is ${formatInches(seedProduct.product.dimensions.widthInches)} wide ` +
          `but the grid is ${formatInches(input.cellSizeInches)}, so ${String(count.tileCount)} ` +
          `${base.colorName} tile${count.tileCount === 1 ? '' : 's'} carried over from an earlier ` +
          'conversion. Repaint them to price the floor as it will be built.'
      );
    }

    const seededOffer = selectOfferForColor(
      seedProduct,
      count.colorId,
      input.offerIdBySelection[key]
    );
    if (!seededOffer) {
      totalCostCents = null;
      const issue = `No seeded offer applies to ${base.colorName} of ${base.productName}.`;
      issues.push(issue);
      return { ...base, isOverridden: false, issue };
    }

    const effective = resolveEffectiveOffer(seededOffer, input.overrides);
    const estimate = estimateTotalCost(
      count.tileCount,
      input.wasteAllowancePercent,
      seedProduct.product,
      effective.offer.price
    );
    const effectiveOffers = listApplicableOffers(seedProduct, count.colorId).map((offer) => {
      const candidate = resolveEffectiveOffer(offer, input.overrides);
      return { ...candidate.offer, isOverridden: candidate.isOverridden };
    });
    const purchase = optimizeTilePurchase({
      productId: seedProduct.product.id,
      ...(count.colorId === undefined ? {} : { colorId: count.colorId }),
      requiredTileCount: calculateRequiredTileCount(count.tileCount, input.wasteAllowancePercent),
      offers: effectiveOffers,
    });

    requiredTileCount += purchase.requiredTileCount;
    if (purchase.totalCostCents === null) {
      const issue = `${base.colorName} of ${base.productName}: ${purchase.explanation}`;
      issues.push(issue);
      totalCostCents = null;
      return {
        ...base,
        offer: effective.offer,
        seededPriceCents: effective.seeded.price.priceCents,
        isOverridden: effective.isOverridden,
        pricing: normalizeOfferPricing(effective.offer.price, seedProduct.product.dimensions),
        purchase,
        estimate,
        issue,
      };
    }
    if (totalCostCents !== null) {
      totalCostCents += purchase.totalCostCents;
    }

    return {
      ...base,
      offer: effective.offer,
      seededPriceCents: effective.seeded.price.priceCents,
      isOverridden: effective.isOverridden,
      pricing: normalizeOfferPricing(effective.offer.price, seedProduct.product.dimensions),
      purchase,
      estimate,
    };
  });

  return {
    lines,
    placedTileCount,
    wasteAllowancePercent: input.wasteAllowancePercent,
    requiredTileCount,
    totalCostCents,
    issues,
  };
}

/** A concise, traceable purchase description for planner and report view models. */
export function describePurchaseUnits(purchase: PurchaseOptimization | undefined): string {
  if (purchase?.status !== 'optimized') {
    return purchase?.explanation ?? 'Unavailable';
  }

  const units = [
    ...purchase.packPurchases.map(
      (pack) => `${String(pack.packCount)} × ${pack.offer.basisLabel} from ${pack.offer.seller}`
    ),
    ...(purchase.individualTileCount === 0
      ? []
      : [
          `${String(purchase.individualTileCount)} individual tile${purchase.individualTileCount === 1 ? '' : 's'}`,
        ]),
  ];
  const leftover =
    purchase.leftoverTileCount === 0 ? '' : ` (${String(purchase.leftoverTileCount)} left over)`;
  return units.length === 0 ? 'No purchase needed' : `${units.join(' + ')}${leftover}`;
}

/** Average paid per purchased tile; this is not a normalized offer price. */
export function effectivePurchaseTileCostCents(
  purchase: PurchaseOptimization | undefined
): number | undefined {
  return purchase?.totalCostCents !== null &&
    purchase?.totalCostCents !== undefined &&
    purchase.totalPurchasedTileCount > 0
    ? purchase.totalCostCents / purchase.totalPurchasedTileCount
    : undefined;
}

function findManufacturerName(manufacturerId: string): string {
  return (
    SEED_CATALOG.manufacturers.find((candidate) => candidate.manufacturer.id === manufacturerId)
      ?.manufacturer.name ?? manufacturerId
  );
}

export type ParseResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly message: string };

export interface PriceOverrideDraft {
  readonly priceId: PriceId;
  readonly amount: string;
  readonly packQuantity: string;
  readonly saleUnit: ProductPrice['saleUnit'];
  readonly sourceUrl: string;
  readonly checkedDate: string;
}

/**
 * Turns the override form fields into a persistence-compatible override. Field-level errors come
 * from the domain parser so the UI never invents its own rules.
 */
export function parsePriceOverrideDraft(
  draft: PriceOverrideDraft
): ParseResult<EditablePriceOverride> {
  const amount = draft.amount.trim();
  if (amount.length === 0) {
    return { ok: false, message: 'Enter a price in dollars, for example 8.58.' };
  }
  if (!/^\d*(?:\.\d{1,2})?$/.test(amount)) {
    return { ok: false, message: 'Enter a price in dollars with at most two decimal places.' };
  }

  const priceCents = Math.round(Number(amount) * 100);
  const packQuantity = draft.saleUnit === 'pack' ? parseCount(draft.packQuantity) : undefined;
  if (draft.saleUnit === 'pack' && packQuantity === undefined) {
    return {
      ok: false,
      message: 'Enter how many tiles are in one pack, as a whole number greater than zero.',
    };
  }

  try {
    return {
      ok: true,
      value: parseEditablePriceOverride({
        priceId: draft.priceId,
        priceCents,
        saleUnit: draft.saleUnit,
        ...(packQuantity === undefined ? {} : { packQuantity }),
        sourceUrl: draft.sourceUrl,
        checkedDate: draft.checkedDate,
      }),
    };
  } catch (error) {
    if (error instanceof DomainValidationError) {
      return { ok: false, message: describeOverrideError(error) };
    }
    throw error;
  }
}

function describeOverrideError(error: DomainValidationError): string {
  if (error.path.endsWith('priceCents')) {
    return 'Enter a price greater than zero.';
  }
  if (error.path.endsWith('packQuantity')) {
    return 'Enter how many tiles are in one pack, as a whole number greater than zero.';
  }
  return error.message;
}

function parseCount(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return undefined;
  }

  const value = Number(trimmed);
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

/** Validates the waste allowance with the same rule the saved-design service enforces. */
export function parseWasteAllowance(raw: string): ParseResult<number> {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || !/^\d*(?:\.\d+)?$/.test(trimmed)) {
    return { ok: false, message: 'Waste allowance must be between 0 and 100 percent.' };
  }

  const result = updateSettings(EMPTY_PERSISTED_APP_STATE, {
    wasteAllowancePercent: Number(trimmed),
  });

  return result.ok
    ? { ok: true, value: result.value.settings.wasteAllowancePercent }
    : { ok: false, message: result.error.message };
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Fractions of a cent matter when a pack price is spread across tiles. */
export function formatUnitMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  }).format(cents / 100);
}

export function formatInches(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 2)} in`;
}

export function formatDollarsInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function describeSourceKind(kind: SeedPrice['sourceKind']): string {
  switch (kind) {
    case 'manufacturer-official':
      return 'Manufacturer site';
    case 'manufacturer-store':
      return 'Manufacturer store';
    case 'retailer-listing':
      return 'Retailer listing';
  }
}
