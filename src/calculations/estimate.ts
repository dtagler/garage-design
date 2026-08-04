import {
  isOrientationAllowed,
  type CatalogProduct,
  type ProductColorId,
  type ProductPrice,
  type TileOrientation,
} from '../domain/catalog';
import type { FloorLayout, GarageDimensions, ProductSelection } from '../domain/persistence';

const SQUARE_INCHES_PER_SQUARE_FOOT = 144;

export interface OrientedTileDimensions {
  readonly widthInches: number;
  readonly lengthInches: number;
}

export interface TileClassification {
  readonly interiorTileCount: number;
  readonly perimeterTileCount: number;
  readonly cutTileCount: number;
  readonly totalTileCount: number;
}

export interface TileGrid extends TileClassification {
  readonly fullColumns: number;
  readonly fullRows: number;
  readonly fullTileCount: number;
  readonly widthRemainderInches: number;
  readonly lengthRemainderInches: number;
  readonly rightEdgeCutTileCount: number;
  readonly bottomEdgeCutTileCount: number;
  readonly cornerCutTileCount: number;
}

export interface Coverage {
  readonly garageSquareInches: number;
  readonly garageSquareFeet: number;
  readonly fullTileSquareInches: number;
  readonly cutTileSquareInches: number;
  readonly totalCoveredSquareInches: number;
  readonly totalCoveredSquareFeet: number;
}

export interface ProductColorTileCount {
  readonly productId: string;
  readonly colorId?: ProductColorId;
  readonly tileCount: number;
}

export interface TileSelectionQuantity {
  readonly selection: ProductSelection;
  readonly tileCount: number;
}

export interface PurchaseEstimate {
  readonly baseTileCount: number;
  readonly wasteTileCount: number;
  readonly requiredTileCount: number;
  readonly saleUnitQuantity: number;
}

export interface CostEstimate extends PurchaseEstimate {
  readonly totalCostCents: number;
}

/** Applies the shared waste rule before a product/color's sale offers are optimized. */
export function calculateRequiredTileCount(
  tileCount: number,
  wasteAllowancePercent: number
): number {
  assertNonNegativeSafeInteger(tileCount, 'tile count');
  assertWasteAllowancePercent(wasteAllowancePercent);
  return roundUpWithWaste(tileCount, wasteAllowancePercent);
}

export function getSelectedProductOrientation(
  product: CatalogProduct,
  selection: ProductSelection
): OrientedTileDimensions {
  if (product.id !== selection.productId) {
    throw new RangeError('The selected product must match the product being calculated.');
  }

  if (!isOrientationAllowed(product.rotationRule, selection.orientation)) {
    throw new RangeError(`Orientation ${selection.orientation} is not allowed for this product.`);
  }

  return getOrientedTileDimensions(product, selection.orientation);
}

export function getOrientedTileDimensions(
  product: Pick<CatalogProduct, 'dimensions'>,
  orientation: TileOrientation
): OrientedTileDimensions {
  const { widthInches, lengthInches } = product.dimensions;
  assertPositiveFinite(widthInches, 'product width');
  assertPositiveFinite(lengthInches, 'product length');

  if (orientation === 90 || orientation === 270) {
    return { widthInches: lengthInches, lengthInches: widthInches };
  }

  return { widthInches, lengthInches };
}

export function calculateTileGrid(
  garage: GarageDimensions,
  tile: OrientedTileDimensions
): TileGrid {
  assertPositiveFinite(garage.widthInches, 'garage width');
  assertPositiveFinite(garage.lengthInches, 'garage length');
  assertPositiveFinite(tile.widthInches, 'tile width');
  assertPositiveFinite(tile.lengthInches, 'tile length');

  const fullColumns = calculateFullTileCount(garage.widthInches, tile.widthInches);
  const fullRows = calculateFullTileCount(garage.lengthInches, tile.lengthInches);
  const widthRemainderInches = calculateRemainder(
    garage.widthInches,
    tile.widthInches,
    fullColumns
  );
  const lengthRemainderInches = calculateRemainder(
    garage.lengthInches,
    tile.lengthInches,
    fullRows
  );
  const fullTileCount = fullColumns * fullRows;
  const rightEdgeCutTileCount = widthRemainderInches === 0 ? 0 : fullRows;
  const bottomEdgeCutTileCount = lengthRemainderInches === 0 ? 0 : fullColumns;
  const cornerCutTileCount = widthRemainderInches === 0 || lengthRemainderInches === 0 ? 0 : 1;
  const cutTileCount = rightEdgeCutTileCount + bottomEdgeCutTileCount + cornerCutTileCount;
  const interiorTileCount =
    countInteriorAxisTiles(fullColumns, widthRemainderInches === 0) *
    countInteriorAxisTiles(fullRows, lengthRemainderInches === 0);
  const perimeterTileCount = fullTileCount - interiorTileCount;

  return {
    fullColumns,
    fullRows,
    fullTileCount,
    widthRemainderInches,
    lengthRemainderInches,
    rightEdgeCutTileCount,
    bottomEdgeCutTileCount,
    cornerCutTileCount,
    interiorTileCount,
    perimeterTileCount,
    cutTileCount,
    totalTileCount: fullTileCount + cutTileCount,
  };
}

export function calculateCoverage(
  garage: GarageDimensions,
  tile: OrientedTileDimensions,
  grid = calculateTileGrid(garage, tile)
): Coverage {
  assertPositiveFinite(garage.widthInches, 'garage width');
  assertPositiveFinite(garage.lengthInches, 'garage length');
  assertPositiveFinite(tile.widthInches, 'tile width');
  assertPositiveFinite(tile.lengthInches, 'tile length');

  const garageSquareInches = garage.widthInches * garage.lengthInches;
  const fullTileSquareInches = grid.fullTileCount * tile.widthInches * tile.lengthInches;
  const cutTileSquareInches = garageSquareInches - fullTileSquareInches;

  return {
    garageSquareInches,
    garageSquareFeet: garageSquareInches / SQUARE_INCHES_PER_SQUARE_FOOT,
    fullTileSquareInches,
    cutTileSquareInches,
    totalCoveredSquareInches: fullTileSquareInches + cutTileSquareInches,
    totalCoveredSquareFeet:
      (fullTileSquareInches + cutTileSquareInches) / SQUARE_INCHES_PER_SQUARE_FOOT,
  };
}

export function countTilesByProductAndColor(
  quantities: readonly TileSelectionQuantity[]
): readonly ProductColorTileCount[] {
  const counts = new Map<string, ProductColorTileCount>();

  for (const { selection, tileCount } of quantities) {
    assertNonNegativeSafeInteger(tileCount, 'tile count');
    const key = `${selection.productId}\u0000${selection.colorId ?? ''}`;
    const current = counts.get(key);
    const totalTileCount = (current?.tileCount ?? 0) + tileCount;
    assertNonNegativeSafeInteger(totalTileCount, 'tile count');
    counts.set(key, {
      productId: selection.productId,
      ...(selection.colorId === undefined ? {} : { colorId: selection.colorId }),
      tileCount: totalTileCount,
    });
  }

  return [...counts.values()].sort(compareProductColorCounts);
}

export function countLayoutTilesByProductAndColor(
  layout: Pick<FloorLayout, 'cellsById'>
): readonly ProductColorTileCount[] {
  return countTilesByProductAndColor(
    Object.values(layout.cellsById).map((cell) => ({
      selection: cell,
      tileCount: 1,
    }))
  );
}

export function calculatePurchaseEstimate(
  tileCount: number,
  wasteAllowancePercent: number,
  product: Pick<CatalogProduct, 'dimensions'>,
  price: ProductPrice
): PurchaseEstimate {
  assertNonNegativeSafeInteger(tileCount, 'tile count');
  assertWasteAllowancePercent(wasteAllowancePercent);
  assertPositiveFinite(product.dimensions.widthInches, 'product width');
  assertPositiveFinite(product.dimensions.lengthInches, 'product length');
  assertPositiveSafeInteger(price.priceCents, 'price cents');

  const requiredTileCount = calculateRequiredTileCount(tileCount, wasteAllowancePercent);
  const saleUnitQuantity = calculateSaleUnitQuantity(requiredTileCount, product, price);

  assertNonNegativeSafeInteger(saleUnitQuantity, 'sale unit quantity');

  return {
    baseTileCount: tileCount,
    wasteTileCount: requiredTileCount - tileCount,
    requiredTileCount,
    saleUnitQuantity,
  };
}

export function estimateTotalCost(
  tileCount: number,
  wasteAllowancePercent: number,
  product: Pick<CatalogProduct, 'dimensions'>,
  price: ProductPrice
): CostEstimate {
  const purchase = calculatePurchaseEstimate(tileCount, wasteAllowancePercent, product, price);
  const totalCostCents = purchase.saleUnitQuantity * price.priceCents;
  assertNonNegativeSafeInteger(totalCostCents, 'total cost cents');

  return { ...purchase, totalCostCents };
}

function calculateRemainder(total: number, unit: number, fullUnits: number): number {
  const remainder = total - unit * fullUnits;
  const tolerance = Number.EPSILON * Math.max(total, unit) * 64;

  return Math.abs(remainder) <= tolerance ? 0 : remainder;
}

function calculateFullTileCount(total: number, unit: number): number {
  const quotient = total / unit;
  const nearestInteger = Math.round(quotient);
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(quotient)) * 64;
  const fullTileCount =
    Math.abs(quotient - nearestInteger) <= tolerance ? nearestInteger : Math.floor(quotient);
  assertNonNegativeSafeInteger(fullTileCount, 'full tile count');
  return fullTileCount;
}

function countInteriorAxisTiles(fullTileCount: number, hasNoEdgeCut: boolean): number {
  const perimeterTilesOnAxis = hasNoEdgeCut ? 2 : 1;
  return Math.max(0, fullTileCount - perimeterTilesOnAxis);
}

function roundUpWithWaste(tileCount: number, wasteAllowancePercent: number): number {
  const requiredTileCount = roundUp(tileCount * (1 + wasteAllowancePercent / 100));
  assertNonNegativeSafeInteger(requiredTileCount, 'required tile count');
  return requiredTileCount;
}

function roundUp(value: number): number {
  if (value === 0) {
    return 0;
  }

  const tolerance = Number.EPSILON * Math.abs(value) * 64;
  const rounded = Math.ceil(value - tolerance);
  return rounded === 0 ? 0 : rounded;
}

function calculateSaleUnitQuantity(
  requiredTileCount: number,
  product: Pick<CatalogProduct, 'dimensions'>,
  price: ProductPrice
): number {
  if (price.saleUnit === 'tile') {
    return requiredTileCount;
  }

  if (price.saleUnit === 'pack') {
    const packQuantity = price.packQuantity;
    assertPositiveSafeInteger(packQuantity, 'pack quantity');
    return roundUp(requiredTileCount / packQuantity);
  }

  return roundUp(
    (requiredTileCount * product.dimensions.widthInches * product.dimensions.lengthInches) /
      SQUARE_INCHES_PER_SQUARE_FOOT
  );
}

function compareProductColorCounts(
  left: ProductColorTileCount,
  right: ProductColorTileCount
): number {
  return (
    left.productId.localeCompare(right.productId) ||
    (left.colorId ?? '').localeCompare(right.colorId ?? '')
  );
}

function assertPositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite number greater than zero.`);
  }
}

function assertPositiveSafeInteger(
  value: number | undefined,
  name: string
): asserts value is number {
  if (value === undefined || !Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer.`);
  }
}

function assertNonNegativeSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer.`);
  }
}

function assertWasteAllowancePercent(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new RangeError('Waste allowance percent must be a finite number from 0 to 100.');
  }
}
