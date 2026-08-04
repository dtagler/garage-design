/**
 * View-model for the guided planner.
 *
 * Every number shown by the planner comes from shared logic: the rough-design model maps a
 * brand-neutral pattern into a product grid and reports edge fit, `src/calculations/estimate.ts`
 * sizes the grid and rounds purchases, and `buildMaterialSummary` prices them. Nothing here
 * re-implements grid fit, waste, pack rounding, or cost arithmetic.
 */

import {
  buildMaterialSummary,
  formatInches,
  formatMoney,
  type CatalogEntry,
  type MaterialSummary,
} from '../catalog';
import {
  getOrientedTileDimensions,
  type OrientedTileDimensions,
} from '../../calculations/estimate';
import { isRampPlan, planFrontRamps, type RampResult } from '../../calculations/ramps';
import type { GarageFrontGeometry } from '../../garage-front';
import type { ProductColor } from '../../domain/catalog';
import { DEFAULT_CATALOG_OVERRIDES, type LayoutCell } from '../../domain/persistence';
import {
  assertRoughGarageDimensions,
  createRoughDesignState,
  DEFAULT_ROUGH_DESIGN_COLORS,
  DEFAULT_ROUGH_GARAGE_DIMENSIONS,
  getConceptualGrid,
  mapRoughColorsToProduct,
  mapRoughDesignToProduct,
  ROUGH_PATTERN_PRESETS,
  ROUGH_DESIGN_ROLES,
  type ConceptualGrid,
  type RoughCustomCells,
  type RoughDesignRole,
  type RoughDesignState,
  type RoughDesignType,
  type LegacyRoughDesignType,
  type RoughDisplayColor,
  type PerimeterExpansionClearance,
  type RoughGarageDimensions,
  type RoughPatternCategory,
  type RoughPresetDesignType,
  type RoughProductColorMapping,
  type RoughProductDesign,
} from '../../rough-design';
import {
  calculateDestinationCost,
  describeShippingEstimate,
  ILLINOIS_STATE_DESTINATION,
  type DestinationCostEstimate,
} from '../../calculations/landedCost';
import { estimateProductShipping, type ProductShippingEstimate } from '../../data/shippingSeed';

export interface PatternChoice {
  readonly id: RoughDesignType;
  readonly label: string;
  readonly description: string;
}

/** The rough shapes people actually ask for, in the order the cards are shown. */
export const PATTERN_CHOICES: readonly PatternChoice[] = Object.freeze([
  ...ROUGH_PATTERN_PRESETS.map((preset) => ({
    id: preset.id,
    label: preset.name,
    description: preset.description,
  })),
  { id: 'custom', label: 'Customize', description: 'Paint the rough shapes yourself.' },
]);

export interface PaletteColor extends RoughDisplayColor {
  readonly label: string;
}

/**
 * Brand-neutral display colors. They are deliberately not catalog colors: step 2 has no product,
 * so each color is matched to a real product color only while exploring tiles in step 3.
 */
export const PLANNER_PALETTE: readonly PaletteColor[] = Object.freeze([
  { hex: '#f2f2f0', label: 'White' },
  { hex: DEFAULT_ROUGH_DESIGN_COLORS.base.hex, label: 'Silver' },
  { hex: '#9ba0a6', label: 'Grey' },
  { hex: '#4a4e52', label: 'Graphite' },
  { hex: '#1a1a1a', label: 'Black' },
  { hex: DEFAULT_ROUGH_DESIGN_COLORS.accent.hex, label: 'Blue' },
  { hex: DEFAULT_ROUGH_DESIGN_COLORS.secondary.hex, label: 'Red' },
  { hex: '#e36414', label: 'Orange' },
  { hex: '#f2c500', label: 'Yellow' },
  { hex: '#2f7d32', label: 'Green' },
  { hex: '#c8b294', label: 'Tan' },
  { hex: '#5b21b6', label: 'Purple' },
] as const);

export const ROLE_LABELS: Readonly<Record<RoughDesignRole, string>> = Object.freeze({
  base: 'Base',
  accent: 'Accent',
  secondary: 'Secondary',
});

export const PATTERN_CATEGORY_LABELS: Readonly<Record<RoughPatternCategory, string>> =
  Object.freeze({
    frames: 'Frames & borders',
    'parking-bays': 'Parking bays',
    'stripes-bands': 'Stripes & bands',
    'checkers-grids': 'Checkers & grids',
    'diagonals-chevrons': 'Diagonals & chevrons',
    'corners-accents': 'Corners & accents',
    'center-fields': 'Center fields',
    'racing-showroom': 'Racing & showroom',
  });

export const PATTERN_CATEGORIES = Object.keys(
  PATTERN_CATEGORY_LABELS
) as readonly RoughPatternCategory[];

/** Sentinel for "no category filter", kept out of the category union on purpose. */
export const ALL_PATTERN_CATEGORIES = 'all';

export type PatternCategoryFilter = RoughPatternCategory | typeof ALL_PATTERN_CATEGORIES;

export type ParseResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly message: string };

export type GarageDimensionField = 'width' | 'length';

/**
 * Validates one typed dimension against the rough-design model's own rule, so the planner cannot
 * drift from what the model accepts.
 */
export function parseGarageDimensionInput(
  raw: string,
  field: GarageDimensionField
): ParseResult<number> {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || !/^\d*(?:\.\d+)?$/.test(trimmed)) {
    return {
      ok: false,
      message: `Enter the garage ${field} in inches, for example ${field === 'width' ? '230' : '246'}.`,
    };
  }

  const value = Number(trimmed);
  const candidate: RoughGarageDimensions =
    field === 'width'
      ? { widthInches: value, lengthInches: DEFAULT_ROUGH_GARAGE_DIMENSIONS.lengthInches }
      : { widthInches: DEFAULT_ROUGH_GARAGE_DIMENSIONS.widthInches, lengthInches: value };

  try {
    assertRoughGarageDimensions(candidate);
    return { ok: true, value };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof RangeError ? error.message : `The garage ${field} is not usable.`,
    };
  }
}

/** The grid a rough design is drawn and painted on. Custom designs keep their painted grid. */
export function conceptualGridFor(state: RoughDesignState): ConceptualGrid {
  return state.type === 'custom' && state.customGrid !== null
    ? state.customGrid
    : getConceptualGrid(state.garage, state.expansionClearance);
}

export function withPatternType(
  state: RoughDesignState,
  type: RoughDesignType | LegacyRoughDesignType
): RoughDesignState {
  if (type === state.type) return state;

  if (type !== 'custom') {
    // A preset replaces painted cells: the model only allows custom cell data on a custom design.
    return createRoughDesignState({
      garage: state.garage,
      expansionClearance: state.expansionClearance,
      type,
      colors: state.colors,
    });
  }

  const customBaseType: RoughPresetDesignType =
    state.type === 'custom' ? (state.customBaseType ?? 'solid-field') : state.type;

  return createRoughDesignState({
    garage: state.garage,
    expansionClearance: state.expansionClearance,
    type: 'custom',
    colors: state.colors,
    customBaseType,
    customGrid: state.customGrid ?? getConceptualGrid(state.garage, state.expansionClearance),
    customCells: state.customCells,
  });
}

export function withRoleColor(
  state: RoughDesignState,
  role: RoughDesignRole,
  color: RoughDisplayColor
): RoughDesignState {
  return rebuild(state, { colors: { ...state.colors, [role]: color } });
}

/**
 * Applies new garage dimensions. A custom design is re-drawn on the grid the new proportions
 * imply and its painted cells carry across proportionally instead of being thrown away.
 */
export function withGarageDimensions(
  state: RoughDesignState,
  garage: RoughGarageDimensions
): RoughDesignState {
  if (
    garage.widthInches === state.garage.widthInches &&
    garage.lengthInches === state.garage.lengthInches
  ) {
    return state;
  }

  if (state.type !== 'custom' || state.customGrid === null) {
    return createRoughDesignState({
      garage,
      expansionClearance: state.expansionClearance,
      type: state.type,
      colors: state.colors,
    });
  }

  const nextGrid = getConceptualGrid(garage, state.expansionClearance);
  return createRoughDesignState({
    garage,
    expansionClearance: state.expansionClearance,
    type: 'custom',
    colors: state.colors,
    customBaseType: state.customBaseType ?? 'solid-field',
    customGrid: nextGrid,
    customCells: remapCustomCells(state.customCells, state.customGrid, nextGrid),
  });
}

/** Changes clearance without moving the garage-front geometry, which remains on outer width. */
export function withExpansionClearance(
  state: RoughDesignState,
  expansionClearance: PerimeterExpansionClearance
): RoughDesignState {
  if (
    expansionClearance.leftInches === state.expansionClearance.leftInches &&
    expansionClearance.rightInches === state.expansionClearance.rightInches &&
    expansionClearance.frontInches === state.expansionClearance.frontInches &&
    expansionClearance.backInches === state.expansionClearance.backInches
  ) {
    return state;
  }
  const nextGrid = getConceptualGrid(state.garage, expansionClearance);
  return createRoughDesignState({
    garage: state.garage,
    expansionClearance,
    type: state.type,
    colors: state.colors,
    ...(state.type === 'custom'
      ? {
          customBaseType: state.customBaseType ?? 'solid-field',
          customGrid: nextGrid,
          customCells: remapCustomCells(state.customCells, state.customGrid!, nextGrid),
        }
      : {}),
  });
}

export function clearCustomCells(state: RoughDesignState): RoughDesignState {
  return state.type === 'custom' ? rebuild(state, { customCells: {} }) : state;
}

export interface RoughMaterialCounts {
  /** Source tiles needed for each role, including tiles that are cut down for the edges. */
  readonly byRole: Readonly<Record<RoughDesignRole, number>>;
  readonly fullTileCount: number;
  readonly cutTileCount: number;
  readonly totalTileCount: number;
}

/**
 * Counts the source tiles a mapped design needs, per role.
 *
 * The visual grid shows edge pieces with full tiles anchored at the front and right. Any width
 * remainder is cut along the left edge and any length remainder is cut along the back edge.
 */
export function countRoughProductMaterialTiles(design: RoughProductDesign): RoughMaterialCounts {
  const { grid, materialTileGrid } = design;
  const roleAt = (column: number, row: number): RoughDesignRole =>
    design.cells[row * grid.columns + column].role;
  const byRole: Record<RoughDesignRole, number> = { base: 0, accent: 0, secondary: 0 };
  const hasWidthCuts = materialTileGrid.widthRemainderInches > 0;
  const hasLengthCuts = materialTileGrid.lengthRemainderInches > 0;
  const firstFullColumn = hasWidthCuts ? 1 : 0;
  const lastFullColumn = grid.columns - 1;
  const firstFullRow = 0;
  const lastFullRow = grid.rows - 1 - (hasLengthCuts ? 1 : 0);
  let fullTileCount = 0;
  let cutTileCount = 0;

  for (let row = firstFullRow; row <= lastFullRow; row++) {
    for (let column = firstFullColumn; column <= lastFullColumn; column++) {
      byRole[roleAt(column, row)]++;
      fullTileCount++;
    }
  }

  const addCutTile = (role: RoughDesignRole): void => {
    byRole[role]++;
    cutTileCount++;
  };

  if (hasWidthCuts) {
    for (let row = firstFullRow; row <= lastFullRow; row++) {
      addCutTile(roleAt(0, row));
    }
  }
  if (hasLengthCuts) {
    for (let column = firstFullColumn; column <= lastFullColumn; column++) {
      addCutTile(roleAt(column, grid.rows - 1));
    }
  }
  if (hasWidthCuts && hasLengthCuts) {
    addCutTile(roleAt(0, grid.rows - 1));
  }

  return { byRole, fullTileCount, cutTileCount, totalTileCount: fullTileCount + cutTileCount };
}

export interface PlannedRoleColor {
  readonly role: RoughDesignRole;
  readonly mapping: RoughProductColorMapping;
  readonly tileCount: number;
}

export interface ProductPlan {
  readonly entry: CatalogEntry;
  readonly productId: string;
  readonly tile: OrientedTileDimensions;
  readonly design: RoughProductDesign;
  readonly layout: ProductLayoutSummary;
  readonly materials: RoughMaterialCounts;
  readonly roleColors: readonly PlannedRoleColor[];
  readonly summary: MaterialSummary;
  readonly wasteAllowancePercent: number;
  /** `null` whenever a color or a price is missing, so no total is ever invented. */
  readonly estimatedTotalCostCents: number | null;
  /**
   * Front transition ramps for this product across the garage openings, or `null` when no front
   * geometry was supplied. An `unavailable` result is a real answer, not a missing one.
   */
  readonly ramp: RampResult | null;
  readonly rampCostCents: number | null;
  /** Tiles plus ramps. `null` when either part cannot be priced from verified offers. */
  readonly combinedTotalCostCents: number | null;
  /**
   * Illinois state tax on the merchandise costs that are known. Shipping remains unknown unless
   * a seller publishes a rule that resolves to a charge for this order.
   */
  readonly destinationCost: DestinationCostEstimate | null;
  readonly shipping: ProductShippingEstimate;
  readonly unavailableRoles: readonly RoughDesignRole[];
  readonly issues: readonly string[];
  /** False when a color the design needs does not exist for this product. */
  readonly canSelect: boolean;
}

export interface EdgeCutPieceDimensions {
  readonly edge: 'left' | 'back' | 'back-left';
  readonly quantity: number;
  readonly widthInches: number;
  readonly lengthInches: number;
}

/**
 * Separates mandatory wall clearance from optional tile-fit cuts. Front is always SVG/model top,
 * the horizontal garage-door edge; back is the opposite bottom edge.
 */
export interface ProductLayoutSummary {
  readonly outerDimensions: RoughGarageDimensions;
  readonly tileField: RoughProductDesign['tileField'];
  readonly clearance: PerimeterExpansionClearance;
  readonly edgeCutPieces: readonly EdgeCutPieceDimensions[];
  readonly cuttingRequired: boolean;
  readonly explanation: string;
}

export interface ProductPlanOptions {
  /**
   * Front wall and opening geometry. Supplying it prices front transition ramps with the same
   * per-opening rules the ramp calculator uses; omitting it leaves `ramp` null rather than
   * guessing at a door arrangement.
   */
  readonly frontGeometry?: GarageFrontGeometry;
}

export function buildProductPlan(
  state: RoughDesignState,
  entry: CatalogEntry,
  wasteAllowancePercent: number,
  options: ProductPlanOptions = {}
): ProductPlan {
  const seedProduct = entry.seedProduct;
  const design = mapRoughDesignToProduct(state, seedProduct.product);
  const productColors: readonly ProductColor[] = seedProduct.colors.map((color) => color.color);
  const colorMappings = mapRoughColorsToProduct(state, productColors, design);
  const materials = countRoughProductMaterialTiles(design);
  const layout = buildProductLayoutSummary(
    state,
    design,
    getOrientedTileDimensions(seedProduct.product, 0)
  );
  const roleColors: readonly PlannedRoleColor[] = ROUGH_DESIGN_ROLES.filter(
    (role) => materials.byRole[role] > 0
  ).map((role) => ({
    role,
    mapping: colorMappings.find((mapping) => mapping.role === role) ?? {
      role,
      requested: state.colors[role],
      status: 'unavailable',
      message: `${describeColor(state.colors[role])} is unavailable for this product.`,
    },
    tileCount: materials.byRole[role],
  }));
  const unavailableRoles = roleColors
    .filter((roleColor) => roleColor.mapping.color === undefined)
    .map((roleColor) => roleColor.role);

  const summary = buildMaterialSummary({
    layout: { cellsById: buildSyntheticLayoutCells(seedProduct.product.id, roleColors) },
    wasteAllowancePercent,
    overrides: DEFAULT_CATALOG_OVERRIDES,
    offerIdBySelection: {},
  });

  const issues = [
    ...roleColors
      .filter((roleColor) => roleColor.mapping.color === undefined)
      .map((roleColor) => roleColor.mapping.message),
    ...summary.issues,
  ];
  const hasEveryEstimate =
    unavailableRoles.length === 0 &&
    summary.lines.length > 0 &&
    summary.lines.every(
      (line) => line.purchase !== undefined && line.purchase.totalCostCents !== null
    );
  const estimatedTotalCostCents = hasEveryEstimate ? summary.totalCostCents : null;
  const ramp =
    options.frontGeometry === undefined
      ? null
      : planFrontRamps(seedProduct.product.id, options.frontGeometry);
  const rampCostCents = ramp !== null && isRampPlan(ramp) ? ramp.totalCostCents : null;
  const merchandiseSubtotalCents =
    estimatedTotalCostCents === null ||
    (options.frontGeometry !== undefined && rampCostCents === null)
      ? null
      : estimatedTotalCostCents + (rampCostCents ?? 0);
  const shipping =
    merchandiseSubtotalCents === null
      ? estimateProductShipping(seedProduct.product.id, 0)
      : estimateProductShipping(seedProduct.product.id, merchandiseSubtotalCents);

  return {
    entry,
    productId: seedProduct.product.id,
    tile: getOrientedTileDimensions(seedProduct.product, 0),
    design,
    layout,
    materials,
    roleColors,
    summary,
    wasteAllowancePercent,
    estimatedTotalCostCents,
    ramp,
    rampCostCents,
    combinedTotalCostCents:
      estimatedTotalCostCents === null || rampCostCents === null
        ? null
        : estimatedTotalCostCents + rampCostCents,
    destinationCost:
      merchandiseSubtotalCents === null
        ? null
        : calculateDestinationCost(
            merchandiseSubtotalCents,
            shipping.costCents,
            ILLINOIS_STATE_DESTINATION
          ),
    shipping,
    unavailableRoles,
    issues,
    canSelect: unavailableRoles.length === 0,
  };
}

export function buildProductPlans(
  state: RoughDesignState,
  entries: readonly CatalogEntry[],
  wasteAllowancePercent: number,
  options: ProductPlanOptions = {}
): readonly ProductPlan[] {
  return entries.map((entry) => buildProductPlan(state, entry, wasteAllowancePercent, options));
}

export type PlanSortOrder = 'lowest-estimate' | 'largest-tile' | 'brand';

export function sortProductPlans(
  plans: readonly ProductPlan[],
  order: PlanSortOrder
): readonly ProductPlan[] {
  const byName = (left: ProductPlan, right: ProductPlan): number =>
    left.entry.manufacturer.name.localeCompare(right.entry.manufacturer.name) ||
    left.entry.seedProduct.product.name.localeCompare(right.entry.seedProduct.product.name);

  return [...plans].sort((left, right) => {
    if (order === 'brand') return byName(left, right);
    if (order === 'largest-tile') {
      return right.tile.widthInches - left.tile.widthInches || byName(left, right);
    }
    // Products that cannot be priced sort last rather than pretending to be free.
    const leftCost = left.estimatedTotalCostCents ?? Number.POSITIVE_INFINITY;
    const rightCost = right.estimatedTotalCostCents ?? Number.POSITIVE_INFINITY;
    return leftCost - rightCost || byName(left, right);
  });
}

export interface EdgeGap {
  readonly edge: 'left' | 'right' | 'front' | 'back';
  readonly label: string;
  readonly inches: number;
}

export function listEdgeGaps(design: RoughProductDesign): readonly EdgeGap[] {
  const { edgeFit } = design;

  return [
    { edge: 'left', label: 'Left edge', inches: edgeFit.leftGapInches },
    { edge: 'right', label: 'Right edge', inches: edgeFit.rightGapInches },
    { edge: 'front', label: 'Front edge (top)', inches: edgeFit.topGapInches },
    { edge: 'back', label: 'Back edge (bottom)', inches: edgeFit.bottomGapInches },
  ];
}

/** One sentence that states whether tiles must be cut, and exactly why. */
export function describeCutRequirement(
  garage: RoughGarageDimensions,
  plan: Pick<ProductPlan, 'design' | 'tile' | 'materials'>
): string {
  const { materialTileGrid, edgeFit } = plan.design;
  if (!edgeFit.cutsRequired) {
    return (
      `No cutting required: ${String(materialTileGrid.fullColumns)} × ` +
      `${String(materialTileGrid.fullRows)} whole ${formatInches(plan.tile.widthInches)} tiles ` +
      `fill the ${formatInches(plan.design.tileField.widthInches)} × ` +
      `${formatInches(plan.design.tileField.lengthInches)} tile field exactly. ` +
      `The outer garage remains ${formatInches(garage.widthInches)} × ` +
      `${formatInches(garage.lengthInches)}.`
    );
  }

  const parts: string[] = [];
  if (materialTileGrid.widthRemainderInches > 0) {
    parts.push(
      `${String(materialTileGrid.fullColumns)} whole tiles leave ` +
        `${formatInches(materialTileGrid.widthRemainderInches)} across the ` +
        `${formatInches(plan.design.tileField.widthInches)} tile-field width, cut as ` +
        `a ${formatInches(edgeFit.leftGapInches)} strip on the left so the right edge stays full`
    );
  }
  if (materialTileGrid.lengthRemainderInches > 0) {
    parts.push(
      `${String(materialTileGrid.fullRows)} whole rows leave ` +
        `${formatInches(materialTileGrid.lengthRemainderInches)} along the ` +
        `${formatInches(plan.design.tileField.lengthInches)} tile-field length, cut as ` +
        `a ${formatInches(edgeFit.bottomGapInches)} strip at the back so the garage-door edge stays full`
    );
  }

  return (
    `Cutting required: ${parts.join('; ')}. Edge pieces come from ` +
    `${String(plan.materials.cutTileCount)} tiles that are cut down.`
  );
}

export interface PurchasePackLine {
  /** The seller's own sale basis, for example "per pack of 50 tiles". */
  readonly offerLabel: string;
  readonly seller: string;
  readonly tilesPerPack: number;
  readonly packCount: number;
  readonly purchasedTileCount: number;
  readonly costCents: number;
  readonly sourceUrl: string;
  readonly checkedDate: string;
  readonly isOverridden: boolean;
}

export interface PurchaseIndividualLine {
  readonly seller: string;
  readonly tileCount: number;
  readonly unitCostCents: number;
  readonly costCents: number;
  readonly sourceUrl: string;
  readonly checkedDate: string;
  readonly isOverridden: boolean;
}

/**
 * What to buy for one catalog color, which may serve more than one design role. Every field comes
 * from the least-cost verified combination the purchase optimizer returned: nothing here rounds,
 * re-prices, or assumes an individual-tile listing that no seller published.
 */
export interface ColorPurchasePlan {
  readonly key: string;
  readonly roles: readonly RoughDesignRole[];
  readonly roleLabel: string;
  readonly colorName: string;
  readonly swatchHex: string;
  readonly placedTileCount: number;
  readonly requiredTileCount: number;
  readonly wasteTileCount: number;
  readonly packs: readonly PurchasePackLine[];
  readonly individuals: readonly PurchaseIndividualLine[];
  readonly individualTileCount: number;
  readonly canBuyIndividually: boolean;
  readonly individualAvailabilityNote: string;
  readonly totalPurchasedTileCount: number;
  readonly leftoverTileCount: number;
  readonly totalCostCents: number | null;
  readonly sellers: readonly string[];
  readonly explanation: string;
  readonly issue?: string;
}

/** Purchase rows for the summary, one per catalog color, in design-role order. */
export function buildColorPurchasePlans(plan: ProductPlan): readonly ColorPurchasePlan[] {
  const rolesByColorId = new Map<string, RoughDesignRole[]>();
  for (const roleColor of plan.roleColors) {
    const colorId = roleColor.mapping.color?.id;
    if (colorId === undefined) continue;
    rolesByColorId.set(colorId, [...(rolesByColorId.get(colorId) ?? []), roleColor.role]);
  }

  return plan.summary.lines.map((line) => {
    const roles = (
      line.colorId === undefined ? [] : (rolesByColorId.get(line.colorId) ?? [])
    ) as readonly RoughDesignRole[];
    const purchase = line.purchase;
    const packs: readonly PurchasePackLine[] = (purchase?.packPurchases ?? []).map((pack) => ({
      offerLabel: pack.offer.basisLabel,
      seller: pack.offer.seller,
      tilesPerPack: pack.tilesPerPack,
      packCount: pack.packCount,
      purchasedTileCount: pack.purchasedTileCount,
      costCents: pack.costCents,
      sourceUrl: pack.offer.price.sourceUrl,
      checkedDate: pack.offer.price.checkedDate,
      isOverridden: pack.offer.isOverridden === true,
    }));
    const individuals: readonly PurchaseIndividualLine[] = (
      purchase?.individualPurchases ?? []
    ).map((individual) => ({
      seller: individual.offer.seller,
      tileCount: individual.tileCount,
      unitCostCents: individual.offer.price.priceCents,
      costCents: individual.costCents,
      sourceUrl: individual.offer.price.sourceUrl,
      checkedDate: individual.offer.price.checkedDate,
      isOverridden: individual.offer.isOverridden === true,
    }));

    return {
      key: line.key,
      roles,
      roleLabel: roles.map((role) => ROLE_LABELS[role]).join(' + ') || line.colorName,
      colorName: line.colorName,
      swatchHex: line.swatchHex,
      placedTileCount: line.tileCount,
      requiredTileCount: purchase?.requiredTileCount ?? line.tileCount,
      wasteTileCount: (purchase?.requiredTileCount ?? line.tileCount) - line.tileCount,
      packs,
      individuals,
      individualTileCount: purchase?.individualTileCount ?? 0,
      canBuyIndividually: purchase?.canBuyIndividually === true,
      individualAvailabilityNote:
        purchase?.canBuyIndividually === true
          ? 'Individual tiles are published by a verified seller.'
          : 'No verified individual-tile listing, so only whole packages are counted.',
      totalPurchasedTileCount: purchase?.totalPurchasedTileCount ?? 0,
      leftoverTileCount: purchase?.leftoverTileCount ?? 0,
      totalCostCents: purchase?.totalCostCents ?? null,
      sellers: [
        ...new Set([...packs.map((pack) => pack.seller), ...individuals.map((one) => one.seller)]),
      ],
      explanation: purchase?.explanation ?? 'No verified purchase applies to this color.',
      ...(line.issue === undefined ? {} : { issue: line.issue }),
    };
  });
}

/** One sentence naming the accessory, pieces per opening, packaging, leftovers, and cost. */
export function describeRampPlan(ramp: RampResult | null): string {
  if (ramp === null) {
    return 'No garage front is configured, so no ramp quantity is calculated.';
  }
  if (!isRampPlan(ramp)) {
    return ramp.reason;
  }
  return ramp.description;
}

export interface PlanSource {
  readonly label: string;
  readonly url: string;
  readonly checkedDate: string;
}

/**
 * Dated sources behind a plan: tile dimensions, colors, every purchased offer, and the ramp
 * accessory. Product photography is deliberately excluded, because a report never carries or
 * cites a remote image.
 */
export function listPlanSources(plan: ProductPlan): readonly PlanSource[] {
  const seedProduct = plan.entry.seedProduct;
  const sources: PlanSource[] = [
    {
      label: `${seedProduct.product.name} dimensions`,
      url: seedProduct.dimensionsSource.url,
      checkedDate: seedProduct.dimensionsSource.checkedDate,
    },
    {
      label: `${seedProduct.product.name} colors`,
      url: seedProduct.colorsSource.url,
      checkedDate: seedProduct.colorsSource.checkedDate,
    },
  ];

  for (const line of buildColorPurchasePlans(plan)) {
    for (const pack of line.packs) {
      sources.push({
        label: `${line.colorName} ${pack.offerLabel} from ${pack.seller}`,
        url: pack.sourceUrl,
        checkedDate: pack.checkedDate,
      });
    }
    for (const individual of line.individuals) {
      sources.push({
        label: `${line.colorName} individual tiles from ${individual.seller}`,
        url: individual.sourceUrl,
        checkedDate: individual.checkedDate,
      });
    }
  }

  if (plan.ramp !== null && isRampPlan(plan.ramp)) {
    sources.push({
      label: `${plan.ramp.accessory.name} ramp price from ${plan.ramp.accessory.seller}`,
      url: plan.ramp.accessory.source.url,
      checkedDate: plan.ramp.accessory.source.checkedDate,
    });
  }

  if (plan.destinationCost !== null) {
    sources.push({
      label: `${ILLINOIS_STATE_DESTINATION.label} sales-tax rate`,
      url: ILLINOIS_STATE_DESTINATION.sourceUrl,
      checkedDate: ILLINOIS_STATE_DESTINATION.checkedDate,
    });
  }
  if (plan.shipping.source !== undefined) {
    sources.push({
      label: `${plan.entry.manufacturer.name} shipping policy`,
      url: plan.shipping.source.url,
      checkedDate: plan.shipping.source.checkedDate,
    });
  }

  return sources.filter(
    (source, index, values) =>
      values.findIndex(
        (candidate) => candidate.label === source.label && candidate.url === source.url
      ) === index
  );
}

/** Package and leftover facts, phrased for an export legend or a printed report. */
export function describePurchaseTotals(plan: ProductPlan): string {
  const lines = buildColorPurchasePlans(plan);
  if (lines.length === 0) {
    return 'No tiles are required.';
  }

  const parts = lines.map((line) => {
    const units = [
      ...line.packs.map(
        (pack) =>
          `${String(pack.packCount)} × ${pack.offerLabel} (${String(pack.tilesPerPack)} tiles) from ${pack.seller}`
      ),
      ...(line.individualTileCount === 0
        ? []
        : [
            `${String(line.individualTileCount)} individual tile${line.individualTileCount === 1 ? '' : 's'}`,
          ]),
    ];
    return (
      `${line.roleLabel} ${line.colorName}: ${String(line.requiredTileCount)} tiles with waste, ` +
      `${units.length === 0 ? 'no verified purchase' : units.join(' + ')}, ` +
      `${String(line.totalPurchasedTileCount)} purchased, ` +
      `${String(line.leftoverTileCount)} left over`
    );
  });

  const total =
    plan.estimatedTotalCostCents === null
      ? 'Tile cost unavailable'
      : `Tiles ${formatMoney(plan.estimatedTotalCostCents)}`;
  const ramp =
    plan.rampCostCents === null ? 'ramps unavailable' : `ramps ${formatMoney(plan.rampCostCents)}`;
  const combined =
    plan.combinedTotalCostCents === null
      ? ''
      : `, combined ${formatMoney(plan.combinedTotalCostCents)}`;
  const destination =
    plan.destinationCost === null
      ? ''
      : ` Illinois state tax ${formatMoney(plan.destinationCost.estimatedTaxCents)}; ` +
        `total before shipping ${formatMoney(plan.destinationCost.totalBeforeShippingCents)}; ` +
        `${describeShippingEstimate(plan.destinationCost.shippingCostCents)}.`;

  return `${parts.join('; ')}. ${total}, ${ramp}${combined}.${destination}`;
}

function buildProductLayoutSummary(
  state: RoughDesignState,
  design: RoughProductDesign,
  tile: OrientedTileDimensions
): ProductLayoutSummary {
  const { tileField, edgeFit, materialTileGrid } = design;
  const edgeCutPieces: readonly EdgeCutPieceDimensions[] = [
    ...(edgeFit.leftGapInches > 0
      ? [
          {
            edge: 'left' as const,
            quantity: materialTileGrid.fullRows,
            widthInches: edgeFit.leftGapInches,
            lengthInches: tile.lengthInches,
          },
        ]
      : []),
    ...(edgeFit.bottomGapInches > 0
      ? [
          {
            edge: 'back' as const,
            quantity: materialTileGrid.fullColumns,
            widthInches: tile.widthInches,
            lengthInches: edgeFit.bottomGapInches,
          },
        ]
      : []),
    ...(edgeFit.leftGapInches > 0 && edgeFit.bottomGapInches > 0
      ? [
          {
            edge: 'back-left' as const,
            quantity: 1,
            widthInches: edgeFit.leftGapInches,
            lengthInches: edgeFit.bottomGapInches,
          },
        ]
      : []),
  ];
  const cuttingRequired = edgeFit.cutsRequired;
  const explanation =
    `Outer garage walls measure ${formatInches(state.garage.widthInches)} × ` +
    `${formatInches(state.garage.lengthInches)}. Mandatory expansion clearance leaves a ` +
    `${formatInches(tileField.widthInches)} × ${formatInches(tileField.lengthInches)} tile field; ` +
    (cuttingRequired
      ? 'tile-fit remainders require the listed edge cut pieces.'
      : 'whole tiles fit that tile field without cuts.');

  return {
    outerDimensions: state.garage,
    tileField,
    clearance: state.expansionClearance,
    edgeCutPieces,
    cuttingRequired,
    explanation,
  };
}

export interface PreviewRect {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fill: string;
  readonly role: RoughDesignRole;
  readonly isCut: boolean;
}

export interface ExactPreviewGeometry {
  /** Outer wall dimensions. The returned tile geometry is inset within this rectangle. */
  readonly widthInches: number;
  readonly lengthInches: number;
  /** Physical inset rectangle; front is its top edge in SVG coordinates. */
  readonly tileField: RoughProductDesign['tileField'];
  readonly rects: readonly PreviewRect[];
  readonly columnEdges: readonly number[];
  readonly rowEdges: readonly number[];
  readonly hasCuts: boolean;
}

/**
 * True-to-scale geometry for a mapped design: cut strips are drawn at their real width, so the
 * preview shows the floor as it would be laid instead of a grid of equal squares. Runs of the same
 * color merge into one rectangle to keep large floors light; tile seams are drawn separately.
 */
export function buildExactPreviewGeometry(
  garage: RoughGarageDimensions,
  plan: Pick<ProductPlan, 'design' | 'tile'>
): ExactPreviewGeometry {
  const { design, tile } = plan;
  const grid = design.materialTileGrid;
  const columnWidths = axisSizes(
    design.edgeFit.leftGapInches,
    design.edgeFit.rightGapInches,
    grid.fullColumns,
    tile.widthInches
  );
  const rowHeights = axisSizes(
    design.edgeFit.topGapInches,
    design.edgeFit.bottomGapInches,
    grid.fullRows,
    tile.lengthInches
  );
  const columnEdges = toEdges(columnWidths, design.tileField.xInches);
  const rowEdges = toEdges(rowHeights, design.tileField.yInches);
  const rects: PreviewRect[] = [];

  for (let row = 0; row < design.grid.rows; row++) {
    let runStart = 0;
    for (let column = 1; column <= design.grid.columns; column++) {
      const first = design.cells[row * design.grid.columns + runStart];
      const cell =
        column === design.grid.columns ? null : design.cells[row * design.grid.columns + column];
      if (
        cell !== null &&
        cell.displayColor.hex === first.displayColor.hex &&
        cell.isCut === first.isCut
      ) {
        continue;
      }

      rects.push({
        key: `${String(runStart)}-${String(row)}`,
        x: columnEdges[runStart],
        y: rowEdges[row],
        width: columnEdges[column] - columnEdges[runStart],
        height: rowHeights[row],
        fill: first.displayColor.hex,
        role: first.role,
        isCut: first.isCut,
      });
      runStart = column;
    }
  }

  return {
    widthInches: garage.widthInches,
    lengthInches: garage.lengthInches,
    tileField: design.tileField,
    rects,
    columnEdges,
    rowEdges,
    hasCuts: design.edgeFit.cutsRequired,
  };
}

export function formatGap(inches: number): string {
  return inches === 0 ? 'flush, no gap' : formatInches(inches);
}

function axisSizes(
  leadingCutInches: number,
  trailingCutInches: number,
  fullTileCount: number,
  tileSizeInches: number
): readonly number[] {
  return [
    ...(leadingCutInches > 0 ? [leadingCutInches] : []),
    ...Array.from({ length: fullTileCount }, () => tileSizeInches),
    ...(trailingCutInches > 0 ? [trailingCutInches] : []),
  ];
}

function toEdges(sizes: readonly number[], originInches = 0): readonly number[] {
  const edges = [originInches];
  for (const size of sizes) {
    edges.push(edges[edges.length - 1] + size);
  }
  return edges;
}

function buildSyntheticLayoutCells(
  productId: string,
  roleColors: readonly PlannedRoleColor[]
): Readonly<Record<string, LayoutCell>> {
  const cellsById: Record<string, LayoutCell> = {};
  let index = 0;

  for (const { mapping, tileCount } of roleColors) {
    const color = mapping.color;
    // A role without an available color is reported as an issue instead of being priced with
    // another color's offer.
    if (color === undefined) continue;

    for (let count = 0; count < tileCount; count++) {
      const id = `tile-${String(index)}`;
      cellsById[id] = { id, column: index, row: 0, productId, colorId: color.id, orientation: 0 };
      index++;
    }
  }

  return cellsById;
}

function rebuild(
  state: RoughDesignState,
  overrides: {
    readonly colors?: RoughDesignState['colors'];
    readonly customCells?: RoughCustomCells;
  }
): RoughDesignState {
  const colors = overrides.colors ?? state.colors;

  if (state.type !== 'custom' || state.customGrid === null) {
    return createRoughDesignState({
      garage: state.garage,
      expansionClearance: state.expansionClearance,
      type: state.type,
      colors,
    });
  }

  return createRoughDesignState({
    garage: state.garage,
    expansionClearance: state.expansionClearance,
    type: 'custom',
    colors,
    customBaseType: state.customBaseType ?? 'solid',
    customGrid: state.customGrid,
    customCells: overrides.customCells ?? state.customCells,
  });
}

function remapCustomCells(
  cells: RoughCustomCells,
  from: ConceptualGrid,
  to: ConceptualGrid
): RoughCustomCells {
  const remapped: Record<string, RoughDesignRole> = {};

  for (const [cellId, role] of Object.entries(cells).sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    const [column, row] = cellId.split('-').map((part) => Number.parseInt(part, 10));
    const nextColumn = scalePosition(column, from.columns, to.columns);
    const nextRow = scalePosition(row, from.rows, to.rows);
    remapped[`${String(nextColumn)}-${String(nextRow)}`] = role;
  }

  return remapped;
}

function scalePosition(position: number, fromSize: number, toSize: number): number {
  return Math.min(toSize - 1, Math.max(0, Math.floor(((position + 0.5) * toSize) / fromSize)));
}

function describeColor(color: RoughDisplayColor): string {
  return color.label ?? color.hex;
}
