import { describe, expect, it } from 'vitest';
import {
  isRampPlan,
  planFrontRampAlternatives,
  planFrontRamps,
  planFrontRampsWithAccessory,
  type RampPlan,
} from './ramps';
import type { RampAccessorySeed } from '../data/accessories/rampSeed';
import {
  createDefaultGarageFrontState,
  createGarageFrontState,
  getGarageFrontGeometry,
  type GarageFrontGeometry,
} from '../garage-front';

const GARAGE_WIDTH_INCHES = 230;

function defaultFront(): GarageFrontGeometry {
  return getGarageFrontGeometry(createDefaultGarageFrontState(GARAGE_WIDTH_INCHES));
}

/**
 * A front whose openings are a whole number of 12 inch and 15.75 inch ramp pieces wide, kept
 * separate from the 94 inch default so the exact-fit and per-opening rounding rules stay covered.
 */
function ninetySixInchDoorFront(): GarageFrontGeometry {
  return getGarageFrontGeometry(
    createGarageFrontState(GARAGE_WIDTH_INCHES, {
      type: 'two-single-doors',
      doorWidthInches: 96,
    })
  );
}

function frontOfType(type: 'one-double-door' | 'three-single-doors'): GarageFrontGeometry {
  return getGarageFrontGeometry(createGarageFrontState(GARAGE_WIDTH_INCHES, { type }));
}

function expectPlan(productId: string, geometry: GarageFrontGeometry): RampPlan {
  const result = planFrontRamps(productId, geometry);
  if (!isRampPlan(result)) {
    throw new Error(`Expected a ramp plan for ${productId}, got: ${result.reason}`);
  }
  return result;
}

describe('front ramp planning', () => {
  it('covers exactly the door openings and never the walls', () => {
    const geometry = defaultFront();
    const plan = expectPlan('racedeck-diamond', geometry);
    const plannedInches = plan.openings.reduce(
      (total, opening) => total + opening.openingWidthInches,
      0
    );

    expect(plan.openings).toHaveLength(geometry.openingCount);
    expect(plannedInches).toBe(geometry.totalOpeningInches);
    expect(plannedInches).toBe(188);
    expect(geometry.totalWallInches).toBe(42);
  });

  it('keeps 94-inch opening quantities unchanged by front expansion clearance', () => {
    const geometry = getGarageFrontGeometry(
      createGarageFrontState(GARAGE_WIDTH_INCHES, {
        type: 'custom',
        customSegments: [
          { kind: 'wall', lengthInches: 10 },
          { kind: 'opening', lengthInches: 94 },
          { kind: 'wall', lengthInches: 22 },
          { kind: 'opening', lengthInches: 94 },
          { kind: 'wall', lengthInches: 10 },
        ],
      })
    );
    const plan = expectPlan('racedeck-diamond', geometry);

    expect(plan.openings.map((opening) => opening.openingWidthInches)).toEqual([94, 94]);
    expect(plan.totalOpeningInches).toBe(188);
    expect(plan.expansionClearanceFact).toContain('full door-opening widths');
    expect(plan.expansionClearanceFact).toContain('no front-clearance amount is subtracted');
  });

  it('fits twelve inch edges exactly across two ninety-six inch openings', () => {
    const plan = expectPlan('racedeck-diamond', ninetySixInchDoorFront());

    expect(plan.accessory.id).toBe('racedeck-female-edge-12');
    expect(plan.openings.map((opening) => opening.segmentsRequired)).toEqual([8, 8]);
    expect(plan.openings.every((opening) => opening.isExactFit)).toBe(true);
    expect(plan.totalSegments).toBe(16);
    expect(plan.totalPurchasedLengthInches).toBe(192);
    expect(plan.totalCutWasteInches).toBe(0);
    expect(plan.totalLeftoverInches).toBe(0);
    expect(plan.saleUnitsRequired).toBe(16);
    expect(plan.totalCostCents).toBe(3184);
    expect(plan.currency).toBe('USD');
  });

  it('prices published VEVOR drainage-mat edge kits across both default doors', () => {
    const plan = expectPlan('vevor-interlocking-drainage-mat-12in', defaultFront());

    expect(plan.accessory.id).toBe('vevor-drainage-mat-straight-transition-edge-kit');
    expect(plan.compatibility.basis).toBe('published');
    expect(plan.openings.map((opening) => opening.segmentsRequired)).toEqual([8, 8]);
    expect(plan.totalSegments).toBe(16);
    expect(plan.saleUnitsRequired).toBe(2);
    expect(plan.straightSegmentsPurchased).toBe(22);
    expect(plan.surplusSegments).toBe(6);
    expect(plan.totalCostCents).toBe(2780);
    expect(plan.totalPurchasedLengthInches).toBe(268.4);
    expect(plan.totalCutWasteInches).toBe(7.2);
    expect(plan.totalLeftoverInches).toBe(80.4);
  });

  it('rounds each opening up on its own rather than joining across the center wall', () => {
    const plan = expectPlan('swisstrax-ribtrax-pro', ninetySixInchDoorFront());

    expect(plan.accessory.segmentLengthInches).toBe(15.75);
    expect(plan.openings.map((opening) => opening.segmentsRequired)).toEqual([7, 7]);
    expect(plan.totalSegments).toBe(14);
    // Treating both openings as one 192 inch run would need only 13 pieces, which would leave a
    // piece bridging the center wall.
    expect(Math.ceil(192 / 15.75)).toBe(13);
    expect(plan.cutStrategy).toBe('whole-pieces-per-opening');
    expect(plan.cutStrategyExplanation).toContain('never joined across a wall');
  });

  it('reports leftover ramp length per opening', () => {
    const plan = expectPlan('swisstrax-ribtrax-pro', ninetySixInchDoorFront());

    expect(plan.openings.map((opening) => opening.leftoverInches)).toEqual([14.25, 14.25]);
    expect(plan.openings.every((opening) => opening.isExactFit)).toBe(false);
    expect(plan.totalPurchasedLengthInches).toBe(220.5);
    expect(plan.totalCutWasteInches).toBe(28.5);
    expect(plan.totalLeftoverInches).toBe(28.5);
    expect(plan.totalCostCents).toBe(4746);
  });

  it('plans the 94 inch default openings with their own leftovers', () => {
    const plan = expectPlan('swisstrax-ribtrax-pro', defaultFront());

    expect(plan.openings.map((opening) => opening.openingWidthInches)).toEqual([94, 94]);
    expect(plan.openings.map((opening) => opening.segmentsRequired)).toEqual([6, 6]);
    expect(plan.openings.map((opening) => opening.leftoverInches)).toEqual([0.5, 0.5]);
    expect(plan.totalPurchasedLengthInches).toBe(189);
    expect(plan.totalCutWasteInches).toBe(1);
    expect(plan.totalLeftoverInches).toBe(1);
  });

  it('plans a single double-door opening', () => {
    const plan = expectPlan('racedeck-diamond', frontOfType('one-double-door'));

    expect(plan.openings).toHaveLength(1);
    expect(plan.openings[0]?.openingWidthInches).toBe(192);
    expect(plan.totalSegments).toBe(16);
    expect(plan.totalLeftoverInches).toBe(0);
  });

  it('plans three single doors separately', () => {
    const plan = expectPlan('racedeck-diamond', frontOfType('three-single-doors'));

    expect(plan.openings.map((opening) => opening.openingWidthInches)).toEqual([64.5, 64.5, 64.5]);
    expect(plan.openings.map((opening) => opening.segmentsRequired)).toEqual([6, 6, 6]);
    expect(plan.totalSegments).toBe(18);
    expect(plan.totalLeftoverInches).toBe(22.5);
  });

  it('buys whole kits and reports the straight pieces left over', () => {
    const plan = expectPlan('vevor-garage-floor-tiles-interlocking-20in', defaultFront());

    expect(plan.accessory.saleUnit).toBe('kit');
    expect(plan.openings.map((opening) => opening.segmentsRequired)).toEqual([5, 5]);
    expect(plan.totalSegments).toBe(10);
    expect(plan.saleUnitsRequired).toBe(1);
    expect(plan.straightSegmentsPurchased).toBe(12);
    expect(plan.surplusSegments).toBe(2);
    expect(plan.totalCostCents).toBe(2890);
    expect(plan.caveats.join(' ')).toContain('2 straight pieces are bought but not used');
  });

  it('buys another piece for an opening a hair wider than a whole number of pieces', () => {
    const geometry = getGarageFrontGeometry(
      createGarageFrontState(GARAGE_WIDTH_INCHES, {
        type: 'custom',
        customSegments: [
          { kind: 'wall', lengthInches: 66.99 },
          { kind: 'opening', lengthInches: 96.01 },
          { kind: 'wall', lengthInches: 67 },
        ],
      })
    );
    const plan = expectPlan('racedeck-diamond', geometry);

    expect(plan.openings[0]?.segmentsRequired).toBe(9);
    expect(plan.openings[0]?.isExactFit).toBe(false);
  });

  it('handles a custom front with openings of different widths', () => {
    const geometry = getGarageFrontGeometry(
      createGarageFrontState(GARAGE_WIDTH_INCHES, {
        type: 'custom',
        customSegments: [
          { kind: 'wall', lengthInches: 20 },
          { kind: 'opening', lengthInches: 108 },
          { kind: 'wall', lengthInches: 24 },
          { kind: 'opening', lengthInches: 60 },
          { kind: 'wall', lengthInches: 18 },
        ],
      })
    );
    const plan = expectPlan('racedeck-diamond', geometry);

    expect(plan.openings.map((opening) => opening.segmentsRequired)).toEqual([9, 5]);
    expect(plan.totalSegments).toBe(14);
    expect(plan.openings[0]?.isExactFit).toBe(true);
    expect(plan.openings[1]?.isExactFit).toBe(true);
  });
});

describe('ramp availability', () => {
  it('returns an explicit unavailable result for a family with no verified ramp', () => {
    const result = planFrontRamps('vevor-garage-tiles-interlocking-12in', defaultFront());

    expect(result.status).toBe('unavailable');
    expect(isRampPlan(result)).toBe(false);
    expect(result.status === 'unavailable' && result.reason).toMatch(/Upgraded 6-Lock/);
  });

  it('returns unavailable for a tile whose accessory listing could not be retrieved', () => {
    const result = planFrontRamps('techfloor-solid-raised-squares', defaultFront());

    expect(result.status).toBe('unavailable');
    expect(result.status === 'unavailable' && result.reason).toMatch(/no accessory listing/);
  });

  it('returns unavailable for a product the ramp catalog has never heard of', () => {
    const result = planFrontRamps('made-up-product', defaultFront());

    expect(result.status).toBe('unavailable');
    expect(result.status === 'unavailable' && result.reason).toMatch(
      /No front transition ramp compatible with "made-up-product" has been verified/
    );
  });

  it('refuses an accessory that is not compatible with the chosen product', () => {
    const result = planFrontRamps('racedeck-diamond', defaultFront(), {
      accessoryId: 'swisstrax-pro-looped-female-edge',
    });

    expect(result.status).toBe('unavailable');
    expect(result.status === 'unavailable' && result.reason).toMatch(
      /is not recorded as compatible/
    );
  });

  it('plans an explicitly chosen compatible accessory', () => {
    const result = planFrontRamps('swisstrax-ribtrax-pro', defaultFront(), {
      accessoryId: 'swisstrax-pro-pegged-male-edge',
    });

    expect(isRampPlan(result)).toBe(true);
    expect(isRampPlan(result) && result.accessory.id).toBe('swisstrax-pro-pegged-male-edge');
  });

  it('leads with the inferred-compatibility caveat when the match is not published', () => {
    const plan = expectPlan('swisstrax-ribtrax-smooth-12-series', defaultFront());

    expect(plan.compatibility.basis).toBe('inferred');
    expect(plan.caveats[0]).toMatch(/^Compatibility is inferred, not published/);
  });

  it('prices every compatible accessory against the same front', () => {
    const alternatives = planFrontRampAlternatives('swisstrax-ribtrax-pro', defaultFront());

    expect(alternatives).toHaveLength(2);
    expect(alternatives.every(isRampPlan)).toBe(true);
    expect(alternatives.filter(isRampPlan).map((plan) => plan.accessory.id)).toEqual([
      'swisstrax-pro-looped-female-edge',
      'swisstrax-pro-pegged-male-edge',
    ]);
  });
});

describe('cuttable ramp pieces', () => {
  const cuttable: RampAccessorySeed = {
    id: 'test-cuttable-edge',
    name: 'Test Trimmable Edge',
    manufacturerId: 'testco',
    edgeGender: 'female',
    segmentLengthInches: 24,
    segmentDepthInches: 2,
    colors: ['Black'],
    saleUnit: 'piece',
    piecesPerSaleUnit: 1,
    straightSegmentsPerSaleUnit: 1,
    priceCents: 500,
    currency: 'USD',
    isEstimate: true,
    seller: 'TestCo',
    source: {
      url: 'https://example.com/trimmable-edge',
      kind: 'manufacturer-store',
      checkedDate: '2026-07-29',
    },
    cuttability: 'cuttable',
    compatibility: [
      { productId: 'racedeck-diamond', basis: 'published', evidence: 'Test fixture.' },
    ],
    caveats: [],
  };

  const twoNarrowOpenings = getGarageFrontGeometry(
    createGarageFrontState(GARAGE_WIDTH_INCHES, {
      type: 'custom',
      customSegments: [
        { kind: 'wall', lengthInches: 85 },
        { kind: 'opening', lengthInches: 30 },
        { kind: 'wall', lengthInches: 60 },
        { kind: 'opening', lengthInches: 30 },
        { kind: 'wall', lengthInches: 25 },
      ],
    })
  );

  it('states the offcut strategy and reuses a cut piece between openings', () => {
    const plan = planFrontRampsWithAccessory('racedeck-diamond', cuttable, twoNarrowOpenings);

    expect(plan.cutStrategy).toBe('cut-to-length-with-offcuts');
    expect(plan.cutStrategyExplanation).toContain('trim-to-length');
    expect(plan.openings.map((opening) => opening.segmentsRequired)).toEqual([2, 1]);
    expect(plan.openings[1]?.usesSharedOffcut).toBe(true);
    expect(plan.totalSegments).toBe(3);
    expect(plan.totalCostCents).toBe(1500);
  });

  it('reconciles per-opening leftovers with the plan total when a piece is shared', () => {
    const plan = planFrontRampsWithAccessory('racedeck-diamond', cuttable, twoNarrowOpenings);
    const perOpening = plan.openings.reduce((total, opening) => total + opening.leftoverInches, 0);

    expect(plan.openings.map((opening) => opening.leftoverInches)).toEqual([12, 0]);
    expect(perOpening).toBe(plan.totalCutWasteInches);
    expect(plan.totalCutWasteInches).toBe(12);
    expect(plan.totalLeftoverInches).toBe(12);
  });

  it('uses the minimum number of cuttable pieces instead of a greedy packing', () => {
    const segmentLengthInches = 12.12;
    const geometry = getGarageFrontGeometry(
      createGarageFrontState(240, {
        type: 'custom',
        customSegments: [
          { kind: 'wall', lengthInches: 10 },
          { kind: 'opening', lengthInches: 26.26 },
          { kind: 'wall', lengthInches: 10 },
          { kind: 'opening', lengthInches: 26.26 },
          { kind: 'wall', lengthInches: 10 },
          { kind: 'opening', lengthInches: 26.26 },
          { kind: 'wall', lengthInches: 10 },
          { kind: 'opening', lengthInches: 27.27 },
          { kind: 'wall', lengthInches: 10 },
          { kind: 'opening', lengthInches: 31.31 },
          { kind: 'wall', lengthInches: 10 },
          { kind: 'opening', lengthInches: 32.32 },
          { kind: 'wall', lengthInches: 10.32 },
        ],
      })
    );
    const plan = planFrontRampsWithAccessory(
      'racedeck-diamond',
      { ...cuttable, segmentLengthInches },
      geometry
    );

    expect(plan.totalSegments).toBe(14);
    expect(plan.totalCostCents).toBe(7000);
    expect(plan.totalLeftoverInches).toBe(0);
  });

  it('does not round cuttable remainders down enough to underbuy a piece', () => {
    const geometry = getGarageFrontGeometry(
      createGarageFrontState(100, {
        type: 'custom',
        customSegments: [
          { kind: 'wall', lengthInches: 10 },
          { kind: 'opening', lengthInches: 30.304 },
          { kind: 'wall', lengthInches: 19.392 },
          { kind: 'opening', lengthInches: 30.304 },
          { kind: 'wall', lengthInches: 10 },
        ],
      })
    );
    const plan = expectPlan('greatmats-turbotile-perforated', geometry);

    expect(plan.totalSegments).toBe(6);
    expect(plan.totalPurchasedLengthInches).toBeGreaterThanOrEqual(plan.totalOpeningInches);
    expect(plan.totalLeftoverInches).toBeGreaterThanOrEqual(0);
  });

  it('refuses to price an accessory with nonsense dimensions', () => {
    expect(() =>
      planFrontRampsWithAccessory(
        'racedeck-diamond',
        { ...cuttable, segmentLengthInches: 0 },
        twoNarrowOpenings
      )
    ).toThrow(/positive segment length/);
  });

  it('needs more pieces when the same edge is not confirmed cuttable', () => {
    const plan = planFrontRampsWithAccessory(
      'racedeck-diamond',
      { ...cuttable, cuttability: 'unknown' },
      twoNarrowOpenings
    );

    expect(plan.cutStrategy).toBe('whole-pieces-per-opening');
    expect(plan.openings.map((opening) => opening.segmentsRequired)).toEqual([2, 2]);
    expect(plan.openings.every((opening) => opening.usesSharedOffcut)).toBe(false);
    expect(plan.totalSegments).toBe(4);
  });
});
