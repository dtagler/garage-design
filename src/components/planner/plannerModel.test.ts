import { describe, expect, it } from 'vitest';
import {
  buildColorPurchasePlans,
  buildExactPreviewGeometry,
  buildProductPlan,
  countRoughProductMaterialTiles,
  describeCutRequirement,
  describePurchaseTotals,
  describeRampPlan,
  listEdgeGaps,
  listPlanSources,
  parseGarageDimensionInput,
  sortProductPlans,
  withExpansionClearance,
  withGarageDimensions,
  withPatternType,
  withRoleColor,
} from './plannerModel';
import { listCatalogEntries, type CatalogEntry } from '../catalog';
import { calculateTileGrid, estimateTotalCost } from '../../calculations/estimate';
import { isRampPlan } from '../../calculations/ramps';
import { createDefaultGarageFrontState, getGarageFrontGeometry } from '../../garage-front';
import {
  createRoughDesignState,
  mapRoughDesignToProduct,
  paintRoughDesignCell,
  getConceptualGrid,
  type RoughDesignState,
} from '../../rough-design';

const WASTE = 10;

function entryFor(productId: string): CatalogEntry {
  const entry = listCatalogEntries().find(
    (candidate) => candidate.seedProduct.product.id === productId
  );
  if (!entry) throw new Error(`The seed catalog should contain ${productId}.`);
  return entry;
}

describe('planner dimension validation', () => {
  it('accepts a customized whole-inch dimension', () => {
    expect(parseGarageDimensionInput('300', 'width')).toEqual({ ok: true, value: 300 });
    expect(parseGarageDimensionInput(' 246.5 ', 'length')).toEqual({ ok: true, value: 246.5 });
  });

  it('rejects blank, non-numeric, out-of-range, and off-increment values', () => {
    expect(parseGarageDimensionInput('', 'width').ok).toBe(false);
    expect(parseGarageDimensionInput('wide', 'width').ok).toBe(false);

    const tooSmall = parseGarageDimensionInput('12', 'width');
    expect(tooSmall.ok).toBe(false);
    expect(tooSmall.ok ? '' : tooSmall.message).toMatch(/48 to 1000 inches/);

    const tooLarge = parseGarageDimensionInput('1200', 'length');
    expect(tooLarge.ok).toBe(false);

    const offIncrement = parseGarageDimensionInput('230.03', 'width');
    expect(offIncrement.ok).toBe(false);
    expect(offIncrement.ok ? '' : offIncrement.message).toMatch(/1\/16-inch increments/);
  });
});

describe('rough design transitions', () => {
  it('keeps the previous preset as the base when switching to custom, and clears painting on the way back', () => {
    const border = createRoughDesignState({ type: 'border' });
    const custom = withPatternType(border, 'custom');

    expect(custom.type).toBe('custom');
    expect(custom.customBaseType).toBe('perimeter-frame');

    const painted = paintRoughDesignCell(custom, custom.customGrid!, 2, 3, 'secondary');
    expect(Object.keys(painted.customCells)).toHaveLength(1);

    const backToPreset = withPatternType(painted, 'solid');
    expect(backToPreset.type).toBe('solid-field');
    expect(backToPreset.customCells).toEqual({});
  });

  it('carries painted cells onto the grid new garage proportions imply', () => {
    const custom = withPatternType(createRoughDesignState({ type: 'checkerboard' }), 'custom');
    const painted = paintRoughDesignCell(custom, custom.customGrid!, 0, 0, 'secondary');
    const resized = withGarageDimensions(painted, { widthInches: 480, lengthInches: 120 });

    expect(resized.garage).toEqual({ widthInches: 480, lengthInches: 120 });
    expect(resized.customGrid).toEqual(getConceptualGrid(resized.garage));
    // The painted corner stays in the same corner of the re-proportioned grid.
    expect(resized.customCells).toEqual({ '0-0': 'secondary' });
  });

  it('changes one role color without disturbing the pattern', () => {
    const state = withRoleColor(createRoughDesignState({ type: 'checkerboard' }), 'accent', {
      hex: '#1a1a1a',
      label: 'Black',
    });

    expect(state.type).toBe('checker-grid');
    expect(state.colors.accent).toEqual({ hex: '#1a1a1a', label: 'Black' });
  });
});

describe('material counting', () => {
  const garage = { widthInches: 230, lengthInches: 246 };

  it('matches the shared tile-grid counts when every edge piece is one color', () => {
    const design = mapRoughDesignToProduct(
      createRoughDesignState({ garage, type: 'solid' }),
      entryFor('vevor-garage-tiles-interlocking-12in').seedProduct.product
    );
    const counts = countRoughProductMaterialTiles(design);
    const grid = calculateTileGrid(design.tileField, { widthInches: 12, lengthInches: 12 });

    expect(counts.fullTileCount).toBe(grid.fullTileCount);
    expect(counts.cutTileCount).toBe(grid.cutTileCount);
    expect(counts.totalTileCount).toBe(grid.totalTileCount);
    expect(counts.byRole.base).toBe(grid.totalTileCount);
    expect(counts.byRole.accent).toBe(0);
  });

  it('uses one source tile for each anchored cut strip', () => {
    const design = mapRoughDesignToProduct(
      createRoughDesignState({ garage, type: 'checkerboard' }),
      entryFor('vevor-garage-tiles-interlocking-12in').seedProduct.product
    );
    const counts = countRoughProductMaterialTiles(design);
    const grid = calculateTileGrid(design.tileField, { widthInches: 12, lengthInches: 12 });

    expect(counts.fullTileCount).toBe(grid.fullTileCount);
    expect(counts.cutTileCount).toBe(grid.cutTileCount);
    expect(counts.byRole.base + counts.byRole.accent).toBe(counts.totalTileCount);
  });

  it('lists left, back, and corner cuts separately when both axes have remainders', () => {
    const plan = buildProductPlan(
      createRoughDesignState({ garage, type: 'solid' }),
      entryFor('swisstrax-ribtrax-pro'),
      WASTE
    );

    expect(plan.layout.edgeCutPieces).toEqual([
      { edge: 'left', quantity: 15, widthInches: 7.5, lengthInches: 15.75 },
      { edge: 'back', quantity: 14, widthInches: 15.75, lengthInches: 7.75 },
      { edge: 'back-left', quantity: 1, widthInches: 7.5, lengthInches: 7.75 },
    ]);
  });
});

describe('edge fit and cut wording', () => {
  it('reports full tiles at the front and right and explains the back cut', () => {
    const garage = { widthInches: 230, lengthInches: 246 };
    const plan = buildProductPlan(
      createRoughDesignState({ garage, type: 'solid' }),
      entryFor('vevor-garage-tiles-interlocking-12in'),
      WASTE
    );
    const gaps = listEdgeGaps(plan.design);

    expect(gaps.map((gap) => gap.edge)).toEqual(['left', 'right', 'front', 'back']);
    expect(gaps[0].inches).toBe(0);
    expect(gaps[1].inches).toBe(0);
    expect(gaps[2].inches).toBe(0);
    expect(gaps[3].inches).toBeCloseTo(4, 10);

    const statement = describeCutRequirement(garage, plan);
    expect(statement).toMatch(/^Cutting required:/);
    expect(statement).toContain('20 whole rows leave 4 in');
    expect(statement).toContain('at the back so the garage-door edge stays full');
    expect(plan.layout).toMatchObject({
      outerDimensions: garage,
      tileField: { xInches: 1, yInches: 1, widthInches: 228, lengthInches: 244 },
      clearance: { leftInches: 1, rightInches: 1, frontInches: 1, backInches: 1 },
      cuttingRequired: true,
    });
  });

  it('says so plainly when whole tiles fill the floor', () => {
    const garage = { widthInches: 242, lengthInches: 242 };
    const plan = buildProductPlan(
      createRoughDesignState({ garage, type: 'solid' }),
      entryFor('vevor-garage-tiles-interlocking-12in'),
      WASTE
    );

    expect(plan.design.edgeFit.cutsRequired).toBe(false);
    expect(listEdgeGaps(plan.design).every((gap) => gap.inches === 0)).toBe(true);
    expect(describeCutRequirement(garage, plan)).toMatch(
      /^No cutting required: 20 × 20 whole 12 in tiles/
    );
  });
});

describe('product plans', () => {
  const garage = { widthInches: 230, lengthInches: 246 };
  const solid = (): RoughDesignState => createRoughDesignState({ garage, type: 'solid' });

  it('prices a pack product with the shared purchase rounding', () => {
    const entry = entryFor('vevor-garage-tiles-interlocking-12in');
    const plan = buildProductPlan(solid(), entry, WASTE);
    const line = plan.summary.lines[0];
    const expected = estimateTotalCost(
      plan.materials.totalTileCount,
      WASTE,
      entry.seedProduct.product,
      line.offer!.price
    );

    expect(plan.summary.lines).toHaveLength(1);
    expect(line.tileCount).toBe(plan.materials.totalTileCount);
    expect(line.estimate).toEqual(expected);
    expect(line.offer?.price.saleUnit).toBe('pack');
    expect(plan.estimatedTotalCostCents).toBe(line.purchase?.totalCostCents);
    expect(line.purchase?.packPurchases).toMatchObject([{ packCount: 9, tilesPerPack: 50 }]);
    expect(plan.destinationCost).toMatchObject({
      shippingCostCents: null,
      estimatedCheckoutTotalCents: null,
    });
    const destinationCost = plan.destinationCost;
    expect(destinationCost).not.toBeNull();
    if (destinationCost === null) throw new Error('Expected a destination cost estimate.');
    expect(typeof destinationCost.estimatedTaxCents).toBe('number');
    expect(destinationCost.estimatedTaxCents).toBe(
      Math.round((destinationCost.merchandiseSubtotalCents * 625) / 10_000)
    );
    expect(plan.canSelect).toBe(true);
  });

  it('maps every role to a real color and keeps substitutions visible', () => {
    const plan = buildProductPlan(
      createRoughDesignState({ garage, type: 'checkerboard' }),
      entryFor('swisstrax-ribtrax-pro'),
      WASTE
    );

    expect(plan.roleColors.map((role) => role.role)).toEqual(['base', 'accent']);
    for (const roleColor of plan.roleColors) {
      expect(roleColor.mapping.color).toBeDefined();
      expect(['matched', 'substituted']).toContain(roleColor.mapping.status);
    }
    expect(plan.tile).toEqual({ widthInches: 15.75, lengthInches: 15.75 });
  });

  it('refuses to select a product that has no color for a required role', () => {
    const plan = buildProductPlan(
      createRoughDesignState({ garage, type: 'checkerboard' }),
      entryFor('vevor-garage-floor-tiles-interlocking-20in'),
      WASTE
    );

    expect(plan.unavailableRoles).toEqual(['accent']);
    expect(plan.canSelect).toBe(false);
    expect(plan.estimatedTotalCostCents).toBeNull();
    expect(plan.issues[0]).toMatch(/unavailable/i);
  });

  it('sorts unpriceable products last when ordering by estimate', () => {
    const plans = [
      buildProductPlan(solid(), entryFor('swisstrax-ribtrax-pro'), WASTE),
      buildProductPlan(
        createRoughDesignState({ garage, type: 'checkerboard' }),
        entryFor('vevor-garage-floor-tiles-interlocking-20in'),
        WASTE
      ),
      buildProductPlan(solid(), entryFor('vevor-garage-tiles-interlocking-12in'), WASTE),
    ];

    const sorted = sortProductPlans(plans, 'lowest-estimate');
    expect(sorted[sorted.length - 1].estimatedTotalCostCents).toBeNull();
    expect(sorted[0].estimatedTotalCostCents).toBeLessThanOrEqual(
      sorted[1].estimatedTotalCostCents ?? Number.POSITIVE_INFINITY
    );
  });
});

describe('exact preview geometry', () => {
  it('draws cut strips at their real width and fills the whole floor', () => {
    const garage = { widthInches: 230, lengthInches: 246 };
    const plan = buildProductPlan(
      createRoughDesignState({ garage, type: 'solid' }),
      entryFor('vevor-garage-tiles-interlocking-12in'),
      WASTE
    );
    const geometry = buildExactPreviewGeometry(garage, plan);

    expect(geometry.tileField).toMatchObject({
      xInches: 1,
      yInches: 1,
      widthInches: 228,
      lengthInches: 244,
    });
    expect(geometry.columnEdges[0]).toBeCloseTo(1, 10);
    expect(geometry.rowEdges[0]).toBeCloseTo(1, 10);
    expect(geometry.columnEdges[geometry.columnEdges.length - 1]).toBeCloseTo(229, 10);
    expect(geometry.rowEdges[geometry.rowEdges.length - 1]).toBeCloseTo(245, 10);
    // Whole tiles begin at the front; the only tile-fit band is 4 in at the back.
    expect(geometry.columnEdges[1]).toBeCloseTo(13, 10);
    expect(geometry.rowEdges[1]).toBeCloseTo(13, 10);
    expect(geometry.rects.some((rect) => rect.isCut)).toBe(true);
    expect(geometry.rects.filter((rect) => rect.y === 241).every((rect) => rect.height === 4)).toBe(
      true
    );
    // A solid floor merges into one rectangle per row band.
    expect(geometry.rects.length).toBeLessThan(plan.design.cells.length);
  });

  it('uses the reduced field for quantities and cost while allowing no-clearance comparisons', () => {
    const garage = { widthInches: 230, lengthInches: 246 };
    const entry = entryFor('vevor-garage-tiles-interlocking-12in');
    const withClearance = buildProductPlan(
      createRoughDesignState({ garage, type: 'solid' }),
      entry,
      WASTE
    );
    const withoutClearance = buildProductPlan(
      withExpansionClearance(createRoughDesignState({ garage, type: 'solid' }), {
        leftInches: 0,
        rightInches: 0,
        frontInches: 0,
        backInches: 0,
      }),
      entry,
      WASTE
    );

    expect(withClearance.materials.totalTileCount).toBe(399);
    expect(withClearance.materials.totalTileCount).toBeLessThan(
      withoutClearance.materials.totalTileCount
    );
    expect(withClearance.estimatedTotalCostCents).toBeLessThan(
      withoutClearance.estimatedTotalCostCents!
    );
  });
});

describe('ramps and purchases in a product plan', () => {
  const front = getGarageFrontGeometry(createDefaultGarageFrontState(230));

  it('prices ramps across the door openings only when a front is supplied', () => {
    const design = createRoughDesignState();
    const withFront = buildProductPlan(design, entryFor('racedeck-free-flow'), WASTE, {
      frontGeometry: front,
    });

    const withoutFront = buildProductPlan(design, entryFor('racedeck-free-flow'), WASTE);

    expect(withoutFront.ramp).toBeNull();
    expect(withoutFront.rampCostCents).toBeNull();
    expect(withoutFront.combinedTotalCostCents).toBeNull();

    expect(withFront.ramp).not.toBeNull();
    expect(isRampPlan(withFront.ramp!)).toBe(true);
    expect(withFront.rampCostCents).toBe(3184);
    expect(withFront.combinedTotalCostCents).toBe(
      withFront.estimatedTotalCostCents! + withFront.rampCostCents!
    );
    expect(describeRampPlan(withFront.ramp)).toContain('Door opening 1 spans 94 inches');
  });

  it('applies TrueLock free shipping when the verified merchandise exceeds $100', () => {
    const plan = buildProductPlan(
      createRoughDesignState(),
      entryFor('truelock-hd-ribbed-flow-through-12in'),
      WASTE,
      { frontGeometry: front }
    );

    expect(plan.rampCostCents).not.toBeNull();
    expect(plan.shipping).toMatchObject({
      costCents: 0,
      source: { checkedDate: '2026-07-31' },
    });
    expect(plan.destinationCost?.shippingCostCents).toBe(0);
    expect(plan.destinationCost?.estimatedCheckoutTotalCents).toBe(
      plan.destinationCost?.totalBeforeShippingCents
    );
    expect(describePurchaseTotals(plan)).toContain('Free shipping (verified)');
    expect(describePurchaseTotals(plan)).not.toContain('shipping unavailable');
  });

  it('reports an unverified ramp as unavailable instead of substituting a generic part', () => {
    const plan = buildProductPlan(
      createRoughDesignState(),
      entryFor('vevor-garage-tiles-interlocking-12in'),
      WASTE,
      { frontGeometry: front }
    );

    expect(plan.ramp).not.toBeNull();
    expect(isRampPlan(plan.ramp!)).toBe(false);
    expect(plan.rampCostCents).toBeNull();
    expect(plan.combinedTotalCostCents).toBeNull();
    expect(plan.destinationCost).toBeNull();
    expect(describeRampPlan(plan.ramp)).toMatch(/no compatible ramp was verified/i);
    expect(describeRampPlan(null)).toMatch(/no garage front is configured/i);
  });

  it('describes package purchases, tiles per pack, and leftovers', () => {
    const plan = buildProductPlan(
      createRoughDesignState(),
      entryFor('vevor-garage-tiles-interlocking-12in'),
      WASTE,
      { frontGeometry: front }
    );
    const [purchase] = buildColorPurchasePlans(plan);

    expect(purchase.roleLabel).toBe('Base');
    expect(purchase.placedTileCount).toBe(399);
    expect(purchase.requiredTileCount).toBe(439);
    expect(purchase.wasteTileCount).toBe(40);
    expect(purchase.packs).toHaveLength(1);
    expect(purchase.packs[0]?.tilesPerPack).toBe(50);
    expect(purchase.packs[0]?.packCount).toBe(9);
    expect(purchase.packs[0]?.seller).toBe('Vevor');
    expect(purchase.totalPurchasedTileCount).toBe(450);
    expect(purchase.leftoverTileCount).toBe(11);
    expect(purchase.canBuyIndividually).toBe(false);
    expect(purchase.individualAvailabilityNote).toMatch(/no verified individual-tile listing/i);
    expect(purchase.explanation).toContain('9 × per pack of 50 tiles');
  });

  it('describes verified individual-tile purchases without inventing a pack', () => {
    const plan = buildProductPlan(createRoughDesignState(), entryFor('racedeck-free-flow'), WASTE, {
      frontGeometry: front,
    });
    const [purchase] = buildColorPurchasePlans(plan);

    expect(purchase.packs).toHaveLength(0);
    expect(purchase.canBuyIndividually).toBe(true);
    expect(purchase.individualTileCount).toBe(439);
    expect(purchase.individuals[0]?.seller).toBe('RaceDeck');
    expect(purchase.leftoverTileCount).toBe(0);
    expect(describePurchaseTotals(plan)).toContain('439 purchased, 0 left over');
    expect(describePurchaseTotals(plan)).toContain('combined $1,783.45');
  });

  it('lists dated tile, price, and ramp sources but never a product photo', () => {
    const plan = buildProductPlan(createRoughDesignState(), entryFor('racedeck-free-flow'), WASTE, {
      frontGeometry: front,
    });
    const sources = listPlanSources(plan);
    const image = plan.entry.seedProduct.image;

    expect(sources.map((source) => source.label)).toContain('RaceDeck Free-Flow dimensions');
    expect(sources.some((source) => source.label.includes('ramp price'))).toBe(true);
    expect(sources.every((source) => source.checkedDate.length > 0)).toBe(true);
    expect(image).toBeDefined();
    expect(sources.some((source) => source.url === image?.imageUrl)).toBe(false);
  });
});
