import { describe, expect, it } from 'vitest';
import {
  assertGarageFrontState,
  createDefaultGarageFrontState,
  createGarageFrontState,
  describeGarageFront,
  getGarageFrontGeometry,
  getGarageFrontOpenings,
  getGarageFrontSvgModel,
  isGarageFrontConfigurationSupported,
  setGarageFrontWidth,
  syncGarageFrontToGarage,
  updateGarageFront,
  type GarageFrontSegmentInput,
} from './index';

/** The garage this project was built for. */
const STATED_GARAGE_WIDTH_INCHES = 230;

function segmentSummary(widthInches: number): (string | number)[][] {
  return getGarageFrontGeometry(createDefaultGarageFrontState(widthInches)).segments.map(
    (segment) => [segment.kind, segment.lengthInches]
  );
}

describe('garage front defaults', () => {
  it('defaults a 230 inch front to two single doors split by a small center wall', () => {
    const state = createDefaultGarageFrontState(STATED_GARAGE_WIDTH_INCHES);

    expect(state.type).toBe('two-single-doors');
    expect(state.doorWidthInches).toBe(94);
    expect(state.centerWallInches).toBe(12);
    expect(state.leftWallInches).toBe(15);
    expect(state.rightWallInches).toBe(15);
  });

  it('lays the default front out as wall, opening, center wall, opening, wall', () => {
    expect(segmentSummary(STATED_GARAGE_WIDTH_INCHES)).toEqual([
      ['wall', 15],
      ['opening', 94],
      ['wall', 12],
      ['opening', 94],
      ['wall', 15],
    ]);
  });

  it('totals the garage width and counts ramp length across openings only', () => {
    const geometry = getGarageFrontGeometry(
      createDefaultGarageFrontState(STATED_GARAGE_WIDTH_INCHES)
    );
    const total = geometry.segments.reduce((sum, segment) => sum + segment.lengthInches, 0);

    expect(total).toBe(STATED_GARAGE_WIDTH_INCHES);
    expect(geometry.openingCount).toBe(2);
    expect(geometry.totalOpeningInches).toBe(188);
    expect(geometry.totalWallInches).toBe(42);
    expect(geometry.totalOpeningInches + geometry.totalWallInches).toBe(STATED_GARAGE_WIDTH_INCHES);
  });

  it('falls back to one double door when two single doors cannot fit', () => {
    const state = createDefaultGarageFrontState(50);

    expect(state.type).toBe('one-double-door');
    expect(isGarageFrontConfigurationSupported('two-single-doors', 50)).toBe(false);
    expect(isGarageFrontConfigurationSupported('one-double-door', 50)).toBe(true);
  });
});

describe('garage front configurations', () => {
  it('models one double door as a single centered opening', () => {
    const state = createGarageFrontState(STATED_GARAGE_WIDTH_INCHES, { type: 'one-double-door' });
    const geometry = getGarageFrontGeometry(state);

    expect(state.centerWallInches).toBeNull();
    expect(geometry.segments.map((segment) => [segment.kind, segment.lengthInches])).toEqual([
      ['wall', 19],
      ['opening', 192],
      ['wall', 19],
    ]);
    expect(geometry.openingCount).toBe(1);
    expect(geometry.totalOpeningInches).toBe(192);
  });

  it('models three single doors with two center walls', () => {
    const state = createGarageFrontState(STATED_GARAGE_WIDTH_INCHES, {
      type: 'three-single-doors',
    });
    const geometry = getGarageFrontGeometry(state);

    expect(geometry.segments.map((segment) => [segment.kind, segment.lengthInches])).toEqual([
      ['wall', 6.25],
      ['opening', 64.5],
      ['wall', 12],
      ['opening', 64.5],
      ['wall', 12],
      ['opening', 64.5],
      ['wall', 6.25],
    ]);
    expect(geometry.openingCount).toBe(3);
    expect(geometry.totalOpeningInches).toBe(193.5);
    expect(
      geometry.segments.filter((segment) => segment.label.startsWith('Center wall'))
    ).toHaveLength(2);
  });

  it('names the walls by position so a center wall is never mistaken for a side wall', () => {
    const labels = getGarageFrontGeometry(
      createDefaultGarageFrontState(STATED_GARAGE_WIDTH_INCHES)
    ).segments.map((segment) => segment.label);

    expect(labels).toEqual([
      'Left wall',
      'Door opening 1',
      'Center wall',
      'Door opening 2',
      'Right wall',
    ]);
  });

  it('drops a zero-width side wall instead of emitting an empty segment', () => {
    const state = createGarageFrontState(STATED_GARAGE_WIDTH_INCHES, {
      type: 'two-single-doors',
      leftWallInches: 0,
    });
    const geometry = getGarageFrontGeometry(state);

    expect(state.rightWallInches).toBe(30);
    expect(geometry.segments.map((segment) => segment.kind)).toEqual([
      'opening',
      'wall',
      'opening',
      'wall',
    ]);
    expect(geometry.segments[0]?.label).toBe('Door opening 1');
  });
});

describe('garage front configuration edits', () => {
  it('absorbs a wider door into the side walls', () => {
    const state = updateGarageFront(createDefaultGarageFrontState(STATED_GARAGE_WIDTH_INCHES), {
      doorWidthInches: 108,
    });

    expect(state.doorWidthInches).toBe(108);
    expect(state.leftWallInches).toBe(1);
    expect(state.rightWallInches).toBe(1);
    expect(() => {
      assertGarageFrontState(state);
    }).not.toThrow();
  });

  it('derives the door width when both side walls are pinned', () => {
    const state = updateGarageFront(createDefaultGarageFrontState(STATED_GARAGE_WIDTH_INCHES), {
      leftWallInches: 20,
      rightWallInches: 20,
      centerWallInches: 10,
    });

    expect(state.doorWidthInches).toBe(90);
    expect(getGarageFrontGeometry(state).totalOpeningInches).toBe(180);
  });

  it('rejects a door that no longer fits the garage width', () => {
    expect(() =>
      updateGarageFront(createDefaultGarageFrontState(STATED_GARAGE_WIDTH_INCHES), {
        doorWidthInches: 120,
      })
    ).toThrow(/cannot be negative/);
  });

  it('rejects a center wall too small to separate two doors', () => {
    expect(() =>
      updateGarageFront(createDefaultGarageFrontState(STATED_GARAGE_WIDTH_INCHES), {
        centerWallInches: 1,
      })
    ).toThrow(/at least 4 inches/);
  });

  it('rejects a center wall on a single-opening front', () => {
    expect(() =>
      assertGarageFrontState({
        ...createGarageFrontState(STATED_GARAGE_WIDTH_INCHES, { type: 'one-double-door' }),
        centerWallInches: 12,
      })
    ).toThrow(/no center wall/);
  });

  it('rebuilds preset dimensions when the configuration type changes', () => {
    const state = updateGarageFront(createDefaultGarageFrontState(STATED_GARAGE_WIDTH_INCHES), {
      type: 'three-single-doors',
    });

    expect(state.type).toBe('three-single-doors');
    expect(state.doorWidthInches).toBe(64.5);
    expect(getGarageFrontOpenings(state)).toHaveLength(3);
  });
});

describe('custom garage fronts', () => {
  const custom: readonly GarageFrontSegmentInput[] = [
    { kind: 'wall', lengthInches: 20 },
    { kind: 'opening', lengthInches: 108 },
    { kind: 'wall', lengthInches: 24 },
    { kind: 'opening', lengthInches: 60, label: 'Side entry' },
    { kind: 'wall', lengthInches: 18 },
  ];

  it('accepts ordered segments that total the garage width', () => {
    const state = createGarageFrontState(STATED_GARAGE_WIDTH_INCHES, {
      type: 'custom',
      customSegments: custom,
    });
    const geometry = getGarageFrontGeometry(state);

    expect(geometry.openingCount).toBe(2);
    expect(geometry.totalOpeningInches).toBe(168);
    expect(geometry.segments[3]?.label).toBe('Side entry');
    expect(geometry.segments[1]?.startInches).toBe(20);
    expect(geometry.segments[1]?.endInches).toBe(128);
  });

  it('rejects segments that do not total the garage width', () => {
    expect(() =>
      createGarageFrontState(STATED_GARAGE_WIDTH_INCHES, {
        type: 'custom',
        customSegments: [
          { kind: 'wall', lengthInches: 20 },
          { kind: 'opening', lengthInches: 100 },
        ],
      })
    ).toThrow(/total 120 inches but the garage is 230 inches wide/);
  });

  it('rejects two adjacent segments of the same kind', () => {
    expect(() =>
      createGarageFrontState(STATED_GARAGE_WIDTH_INCHES, {
        type: 'custom',
        customSegments: [
          { kind: 'wall', lengthInches: 20 },
          { kind: 'opening', lengthInches: 96 },
          { kind: 'opening', lengthInches: 96 },
          { kind: 'wall', lengthInches: 18 },
        ],
      })
    ).toThrow(/combine them into one/);
  });

  it('rejects an opening below the minimum practical width', () => {
    expect(() =>
      createGarageFrontState(STATED_GARAGE_WIDTH_INCHES, {
        type: 'custom',
        customSegments: [
          { kind: 'wall', lengthInches: 103 },
          { kind: 'opening', lengthInches: 12 },
          { kind: 'wall', lengthInches: 115 },
        ],
      })
    ).toThrow(/at least 24 inches wide/);
  });

  it('rejects a zero-length segment', () => {
    expect(() =>
      createGarageFrontState(STATED_GARAGE_WIDTH_INCHES, {
        type: 'custom',
        customSegments: [
          { kind: 'wall', lengthInches: 0 },
          { kind: 'opening', lengthInches: 230 },
        ],
      })
    ).toThrow(/longer than zero inches/);
  });

  it('requires segments when the custom type is chosen', () => {
    expect(() => createGarageFrontState(STATED_GARAGE_WIDTH_INCHES, { type: 'custom' })).toThrow(
      /requires an ordered list of segments/
    );
  });
});

describe('garage width changes', () => {
  it('keeps the openings and absorbs a wider garage into the side walls', () => {
    const widened = setGarageFrontWidth(
      createDefaultGarageFrontState(STATED_GARAGE_WIDTH_INCHES),
      254
    );

    expect(widened.doorWidthInches).toBe(94);
    expect(widened.centerWallInches).toBe(12);
    expect(widened.leftWallInches).toBe(27);
    expect(widened.rightWallInches).toBe(27);
    expect(getGarageFrontGeometry(widened).totalOpeningInches).toBe(188);
  });

  it('re-derives the front when the openings no longer fit a narrower garage', () => {
    const narrowed = setGarageFrontWidth(
      createDefaultGarageFrontState(STATED_GARAGE_WIDTH_INCHES),
      180
    );
    const geometry = getGarageFrontGeometry(narrowed);

    expect(narrowed.type).toBe('two-single-doors');
    expect(narrowed.doorWidthInches).toBe(78);
    expect(geometry.segments.reduce((sum, segment) => sum + segment.lengthInches, 0)).toBe(180);
  });

  it('keeps an off-center wall split when the garage width changes', () => {
    const offset = updateGarageFront(createDefaultGarageFrontState(STATED_GARAGE_WIDTH_INCHES), {
      leftWallInches: 6,
    });
    const widened = setGarageFrontWidth(offset, 254);

    expect(offset.leftWallInches).toBe(6);
    expect(offset.rightWallInches).toBe(24);
    expect(widened.leftWallInches).toBe(10.8);
    expect(widened.rightWallInches).toBe(43.2);
    expect(widened.doorWidthInches).toBe(94);
  });

  it('scales a custom front proportionally and keeps the total exact', () => {
    const state = createGarageFrontState(200, {
      type: 'custom',
      customSegments: [
        { kind: 'wall', lengthInches: 20 },
        { kind: 'opening', lengthInches: 160 },
        { kind: 'wall', lengthInches: 20 },
      ],
    });
    const resized = setGarageFrontWidth(state, 300);
    const geometry = getGarageFrontGeometry(resized);

    expect(resized.customSegments?.map((segment) => segment.lengthInches)).toEqual([30, 240, 30]);
    expect(geometry.segments.reduce((sum, segment) => sum + segment.lengthInches, 0)).toBe(300);
  });

  it('does not round a very short custom segment away when resizing', () => {
    const state = createGarageFrontState(1000, {
      type: 'custom',
      customSegments: [
        { kind: 'wall', lengthInches: 20 },
        { kind: 'opening', lengthInches: 979.999 },
        { kind: 'wall', lengthInches: 0.001 },
      ],
    });
    const resized = setGarageFrontWidth(state, 999);
    const lengths = resized.customSegments?.map((segment) => segment.lengthInches) ?? [];

    expect(resized.type).toBe('custom');
    expect(lengths).toHaveLength(3);
    expect(lengths.every((length) => length > 0)).toBe(true);
    expect(lengths.reduce((total, length) => total + length, 0)).toBeCloseTo(999, 6);
  });

  it('syncs a stored front to the garage it belongs to', () => {
    const synced = syncGarageFrontToGarage(createDefaultGarageFrontState(230), {
      widthInches: 254,
      lengthInches: 246,
    });

    expect(synced.widthInches).toBe(254);
  });

  it('refuses a width outside the supported garage range', () => {
    expect(() => createDefaultGarageFrontState(12)).toThrow(/Garage width must be between/);
  });
});

describe('garage front presentation', () => {
  it('describes the run of segments and the ramp length needed', () => {
    const description = describeGarageFront(
      createDefaultGarageFrontState(STATED_GARAGE_WIDTH_INCHES)
    );

    expect(description).toContain('230 inches wide');
    expect(description).toContain('two single doors separated by a center wall');
    expect(description).toContain('Left wall 15 in, Door opening 1 94 in, Center wall 12 in');
    expect(description).toContain('2 door openings need 188 inches of front transition ramp');
  });

  it('gives every segment its own accessible description', () => {
    const [leftWall, firstOpening] = getGarageFrontGeometry(
      createDefaultGarageFrontState(STATED_GARAGE_WIDTH_INCHES)
    ).segments;

    expect(leftWall?.accessibleDescription).toBe(
      'Left wall, 15 inches wide, at the left edge of the garage front. No ramp needed.'
    );
    expect(firstOpening?.accessibleDescription).toBe(
      'Door opening 1, 94 inches wide, starting 15 inches from the left edge. Needs a front transition ramp.'
    );
  });

  it('exposes svg rectangles that tile the full width without gaps', () => {
    const model = getGarageFrontSvgModel(
      createDefaultGarageFrontState(STATED_GARAGE_WIDTH_INCHES),
      { bandDepthInches: 10 }
    );

    expect(model.viewBox).toBe('0 0 230 10');
    expect(model.segments.map((segment) => [segment.x, segment.width])).toEqual([
      [0, 15],
      [15, 94],
      [109, 12],
      [121, 94],
      [215, 15],
    ]);
    expect(model.segments.every((segment) => segment.height === 10)).toBe(true);
    expect(model.title).toBe('Garage front, 230 inches wide');
    expect(model.description).toContain('front transition ramp');
  });

  it('scales svg geometry by the requested units per inch', () => {
    const model = getGarageFrontSvgModel(createDefaultGarageFrontState(200), {
      unitsPerInch: 2,
      bandDepthInches: 6,
    });

    expect(model.viewBoxWidth).toBe(400);
    expect(model.viewBoxHeight).toBe(12);
  });

  it('rejects a non-positive svg scale', () => {
    expect(() =>
      getGarageFrontSvgModel(createDefaultGarageFrontState(200), { unitsPerInch: 0 })
    ).toThrow(/positive number of units per inch/);
  });
});
