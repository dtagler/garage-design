/**
 * Product-neutral model of the garage front wall.
 *
 * The front of a garage is an ordered run of wall and opening segments whose lengths always add
 * up to the garage width. Front transition ramps are only ever needed across the openings, so
 * modelling the front as segments (rather than as "a door count") keeps that rule structural:
 * a wall segment simply has no ramp length to contribute.
 *
 * Nothing here knows about a catalog product, a tile size, or a brand. Ramp accessories are
 * matched to this geometry separately in `src/calculations/ramps.ts`.
 */

import {
  MAXIMUM_GARAGE_DIMENSION_INCHES,
  MINIMUM_GARAGE_DIMENSION_INCHES,
  type RoughGarageDimensions,
} from '../rough-design';

export const GARAGE_FRONT_VERSION = 1;

export const GARAGE_FRONT_CONFIGURATION_TYPES = [
  'one-double-door',
  'two-single-doors',
  'three-single-doors',
  'custom',
] as const;

export const GARAGE_FRONT_SEGMENT_KINDS = ['wall', 'opening'] as const;

export type GarageFrontConfigurationType = (typeof GARAGE_FRONT_CONFIGURATION_TYPES)[number];
export type GarageFrontPresetType = Exclude<GarageFrontConfigurationType, 'custom'>;
export type GarageFrontSegmentKind = (typeof GARAGE_FRONT_SEGMENT_KINDS)[number];

/**
 * Smallest opening the model accepts. This is deliberately permissive: it exists to reject
 * nonsense such as a two-inch "door", not to second-guess an unusual but real garage.
 */
export const MINIMUM_OPENING_WIDTH_INCHES = 24;
/** A center wall of zero width would not be two separate doors, it would be one wide opening. */
export const MINIMUM_CENTER_WALL_INCHES = 4;
/** Used only when deriving defaults. A user may configure a door flush to a side wall. */
export const DEFAULT_MINIMUM_SIDE_WALL_INCHES = 6;
/**
 * Rough opening for a single door, which is narrower than the 96 inch nominal door because the
 * jambs sit inside it. On the 230 inch front this project was measured against, two of these
 * plus a 12 inch center wall leave a 15 inch wall at each side.
 */
export const DEFAULT_SINGLE_DOOR_WIDTH_INCHES = 94;
export const DEFAULT_DOUBLE_DOOR_WIDTH_INCHES = 192;
export const DEFAULT_CENTER_WALL_INCHES = 12;
/** Segment sums are compared at a hundredth of an inch, well below construction precision. */
export const GARAGE_FRONT_LENGTH_TOLERANCE_INCHES = 0.01;

export const DEFAULT_GARAGE_FRONT_TYPE: GarageFrontConfigurationType = 'two-single-doors';

/** Ordered preference used when a width cannot support the preferred configuration. */
const DEFAULT_TYPE_FALLBACK_ORDER: readonly GarageFrontPresetType[] = [
  'two-single-doors',
  'one-double-door',
];

export interface GarageFrontSegmentInput {
  readonly kind: GarageFrontSegmentKind;
  readonly lengthInches: number;
  /** Optional user-supplied name, for example "Man door" or "Bump-out". */
  readonly label?: string;
}

/**
 * Persisted front configuration. `widthInches` is stored so the front can be validated on its
 * own; {@link syncGarageFrontToGarage} re-derives it whenever the garage is resized.
 */
export interface GarageFrontState {
  readonly version: typeof GARAGE_FRONT_VERSION;
  readonly type: GarageFrontConfigurationType;
  readonly widthInches: number;
  /** Width of each door opening. Null for custom fronts, which size each segment individually. */
  readonly doorWidthInches: number | null;
  /** Wall between adjacent doors. Null when the configuration has fewer than two doors. */
  readonly centerWallInches: number | null;
  readonly leftWallInches: number | null;
  readonly rightWallInches: number | null;
  readonly customSegments: readonly GarageFrontSegmentInput[] | null;
}

export interface GarageFrontChanges {
  readonly type?: GarageFrontConfigurationType;
  readonly widthInches?: number;
  readonly doorWidthInches?: number;
  readonly centerWallInches?: number;
  readonly leftWallInches?: number;
  readonly rightWallInches?: number;
  readonly customSegments?: readonly GarageFrontSegmentInput[];
}

export interface GarageFrontSegment {
  readonly id: string;
  readonly kind: GarageFrontSegmentKind;
  /** 1-based ordinal within the segment's own kind, so openings are "opening 1", "opening 2". */
  readonly index: number;
  readonly lengthInches: number;
  readonly startInches: number;
  readonly endInches: number;
  readonly label: string;
  readonly accessibleDescription: string;
}

export interface GarageFrontOpening extends GarageFrontSegment {
  readonly kind: 'opening';
}

export interface GarageFrontGeometry {
  readonly widthInches: number;
  readonly type: GarageFrontConfigurationType;
  readonly segments: readonly GarageFrontSegment[];
  readonly openings: readonly GarageFrontOpening[];
  readonly openingCount: number;
  /** Total ramp length needed: the sum of the openings only, never a wall. */
  readonly totalOpeningInches: number;
  readonly totalWallInches: number;
  readonly description: string;
}

export interface GarageFrontSvgOptions {
  readonly bandDepthInches?: number;
  readonly unitsPerInch?: number;
}

export interface GarageFrontSvgSegment extends GarageFrontSegment {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface GarageFrontSvgModel {
  readonly viewBox: string;
  readonly viewBoxWidth: number;
  readonly viewBoxHeight: number;
  readonly unitsPerInch: number;
  readonly segments: readonly GarageFrontSvgSegment[];
  readonly title: string;
  readonly description: string;
}

export function isGarageFrontConfigurationType(
  value: unknown
): value is GarageFrontConfigurationType {
  return (
    typeof value === 'string' &&
    (GARAGE_FRONT_CONFIGURATION_TYPES as readonly string[]).includes(value)
  );
}

export function isGarageFrontSegmentKind(value: unknown): value is GarageFrontSegmentKind {
  return (
    typeof value === 'string' && (GARAGE_FRONT_SEGMENT_KINDS as readonly string[]).includes(value)
  );
}

/** Number of door openings a preset configuration produces. */
export function getGarageFrontDoorCount(type: GarageFrontPresetType): number {
  switch (type) {
    case 'one-double-door':
      return 1;
    case 'two-single-doors':
      return 2;
    case 'three-single-doors':
      return 3;
  }
}

/** Whether a preset can physically fit in a width, using the smallest legal segment sizes. */
export function isGarageFrontConfigurationSupported(
  type: GarageFrontPresetType,
  widthInches: number
): boolean {
  assertGarageWidth(widthInches);
  const doorCount = getGarageFrontDoorCount(type);
  const minimum =
    doorCount * MINIMUM_OPENING_WIDTH_INCHES +
    (doorCount - 1) * MINIMUM_CENTER_WALL_INCHES -
    GARAGE_FRONT_LENGTH_TOLERANCE_INCHES;

  return widthInches >= minimum;
}

/**
 * The starting front for a garage width. Two single doors with a small center wall is the
 * default because it is the most common two-car layout; narrower garages fall back to a single
 * double door rather than to an invented arrangement that would not fit.
 */
export function createDefaultGarageFrontState(widthInches: number): GarageFrontState {
  assertGarageWidth(widthInches);

  for (const type of DEFAULT_TYPE_FALLBACK_ORDER) {
    const preset = derivePresetDimensions(type, widthInches);
    if (preset !== null) {
      return freezeState({
        version: GARAGE_FRONT_VERSION,
        type,
        widthInches,
        ...preset,
        customSegments: null,
      });
    }
  }

  throw new RangeError(
    `A garage ${formatInches(widthInches)} inches wide cannot hold any standard door configuration.`
  );
}

export function createGarageFrontState(
  widthInches: number,
  options: Omit<GarageFrontChanges, 'widthInches'> = {}
): GarageFrontState {
  assertGarageWidth(widthInches);
  const type = options.type ?? DEFAULT_GARAGE_FRONT_TYPE;

  if (type === 'custom') {
    if (options.customSegments === undefined) {
      throw new RangeError('A custom garage front requires an ordered list of segments.');
    }
    const state = freezeState({
      version: GARAGE_FRONT_VERSION,
      type,
      widthInches,
      doorWidthInches: null,
      centerWallInches: null,
      leftWallInches: null,
      rightWallInches: null,
      customSegments: options.customSegments.map(normalizeSegmentInput),
    });
    assertGarageFrontState(state);
    return state;
  }

  const preset = derivePresetDimensions(type, widthInches);
  if (preset === null) {
    throw new RangeError(
      `A garage ${formatInches(widthInches)} inches wide cannot hold ${describeType(type)}.`
    );
  }

  const base = freezeState({
    version: GARAGE_FRONT_VERSION,
    type,
    widthInches,
    ...preset,
    customSegments: null,
  });

  const overrides: GarageFrontChanges = {
    ...(options.doorWidthInches === undefined ? {} : { doorWidthInches: options.doorWidthInches }),
    ...(options.centerWallInches === undefined
      ? {}
      : { centerWallInches: options.centerWallInches }),
    ...(options.leftWallInches === undefined ? {} : { leftWallInches: options.leftWallInches }),
    ...(options.rightWallInches === undefined ? {} : { rightWallInches: options.rightWallInches }),
  };

  return Object.keys(overrides).length === 0 ? base : updateGarageFront(base, overrides);
}

/**
 * Applies a change and rebalances the segments so they still total the garage width.
 *
 * Whatever the caller does not specify absorbs the remainder: side walls first, and the door
 * width only when both side walls were pinned. Over-specifying a front whose parts do not add
 * up is an error rather than a silently adjusted value.
 */
export function updateGarageFront(
  state: GarageFrontState,
  changes: GarageFrontChanges
): GarageFrontState {
  assertGarageFrontState(state);
  const widthInches = changes.widthInches ?? state.widthInches;
  assertGarageWidth(widthInches);
  const type = changes.type ?? state.type;

  if (type === 'custom') {
    const segments = changes.customSegments ?? state.customSegments;
    if (segments === null || segments === undefined) {
      throw new RangeError('A custom garage front requires an ordered list of segments.');
    }
    const next = freezeState({
      version: GARAGE_FRONT_VERSION,
      type,
      widthInches,
      doorWidthInches: null,
      centerWallInches: null,
      leftWallInches: null,
      rightWallInches: null,
      customSegments: segments.map(normalizeSegmentInput),
    });
    assertGarageFrontState(next);
    return next;
  }

  if (changes.customSegments !== undefined) {
    throw new RangeError('Only a custom garage front can define its own segments.');
  }

  // Switching away from custom, or to a different preset, restarts from that preset's defaults.
  const source: GarageFrontState =
    state.type === type ? state : createGarageFrontState(widthInches, { type });

  const doorCount = getGarageFrontDoorCount(type);
  const centerCount = doorCount - 1;
  const centerWallInches =
    centerCount === 0 ? null : (changes.centerWallInches ?? source.centerWallInches ?? 0);
  const centerTotal = centerWallInches === null ? 0 : centerWallInches * centerCount;

  const leftGiven = changes.leftWallInches;
  const rightGiven = changes.rightWallInches;
  const doorGiven = changes.doorWidthInches;

  let doorWidthInches: number;
  let leftWallInches: number;
  let rightWallInches: number;

  if (leftGiven !== undefined && rightGiven !== undefined) {
    leftWallInches = leftGiven;
    rightWallInches = rightGiven;
    doorWidthInches =
      doorGiven ??
      roundToHundredth((widthInches - leftGiven - rightGiven - centerTotal) / doorCount);
  } else {
    doorWidthInches = doorGiven ?? source.doorWidthInches ?? 0;
    const wallTotal = widthInches - doorWidthInches * doorCount - centerTotal;
    if (leftGiven !== undefined) {
      leftWallInches = leftGiven;
      rightWallInches = roundToHundredth(wallTotal - leftGiven);
    } else if (rightGiven !== undefined) {
      rightWallInches = rightGiven;
      leftWallInches = roundToHundredth(wallTotal - rightGiven);
    } else {
      leftWallInches = roundToHundredth(wallTotal / 2);
      rightWallInches = roundToHundredth(wallTotal - leftWallInches);
    }
  }

  const next = freezeState({
    version: GARAGE_FRONT_VERSION,
    type,
    widthInches,
    doorWidthInches,
    centerWallInches,
    leftWallInches,
    rightWallInches,
    customSegments: null,
  });

  assertGarageFrontState(next);
  return next;
}

/**
 * Re-fits a front to a new garage width.
 *
 * Openings are preserved wherever possible so a width tweak does not silently resize the doors;
 * the side walls absorb the change and keep their original left/right proportion, so a
 * deliberately off-center front stays off-center. When the openings can no longer fit, the front
 * falls back to the default configuration for the new width instead of producing invalid
 * geometry.
 */
export function setGarageFrontWidth(
  state: GarageFrontState,
  widthInches: number
): GarageFrontState {
  assertGarageFrontState(state);
  assertGarageWidth(widthInches);

  if (widthInches === state.widthInches) {
    return state;
  }

  if (state.type === 'custom') {
    const scaled = scaleCustomSegments(state.customSegments ?? [], state.widthInches, widthInches);
    if (scaled !== null) {
      const next = freezeState({ ...state, widthInches, customSegments: scaled });
      if (isValidGarageFront(next)) {
        return next;
      }
    }
    return createDefaultGarageFrontState(widthInches);
  }

  try {
    return updateGarageFront(state, {
      widthInches,
      ...(state.doorWidthInches === null ? {} : { doorWidthInches: state.doorWidthInches }),
      ...proportionalSideWalls(state, widthInches),
    });
  } catch {
    const preset = derivePresetDimensions(state.type, widthInches);
    if (preset !== null) {
      const rebuilt = freezeState({
        version: GARAGE_FRONT_VERSION,
        type: state.type,
        widthInches,
        ...preset,
        customSegments: null,
      });
      assertGarageFrontState(rebuilt);
      return rebuilt;
    }
    return createDefaultGarageFrontState(widthInches);
  }
}

/**
 * Splits the new wall allowance the way the old one was split, so a front with a wide wall on one
 * side is not silently re-centered by a width change.
 */
function proportionalSideWalls(
  state: GarageFrontState,
  widthInches: number
): { leftWallInches: number; rightWallInches: number } {
  const doorCount = getGarageFrontDoorCount(state.type as GarageFrontPresetType);
  const left = state.leftWallInches ?? 0;
  const right = state.rightWallInches ?? 0;
  const previousTotal = left + right;
  const wallTotal = roundToHundredth(
    widthInches -
      (state.doorWidthInches ?? 0) * doorCount -
      (state.centerWallInches ?? 0) * (doorCount - 1)
  );
  const leftShare = previousTotal > 0 ? left / previousTotal : 0.5;
  const leftWallInches = roundToHundredth(wallTotal * leftShare);

  return { leftWallInches, rightWallInches: roundToHundredth(wallTotal - leftWallInches) };
}

/** Keeps a stored front consistent with the garage it belongs to. */
export function syncGarageFrontToGarage(
  state: GarageFrontState,
  garage: RoughGarageDimensions
): GarageFrontState {
  return setGarageFrontWidth(state, garage.widthInches);
}

export function assertGarageFrontState(state: GarageFrontState): void {
  if (state.version !== GARAGE_FRONT_VERSION) {
    throw new RangeError(`Unsupported garage front version ${String(state.version)}.`);
  }
  if (!isGarageFrontConfigurationType(state.type)) {
    throw new RangeError('Garage front configuration type is invalid.');
  }
  assertGarageWidth(state.widthInches);

  if (state.type === 'custom') {
    assertCustomFront(state);
    return;
  }

  if (state.customSegments !== null) {
    throw new RangeError('Only a custom garage front can define its own segments.');
  }

  const doorCount = getGarageFrontDoorCount(state.type);
  const centerCount = doorCount - 1;

  if (typeof state.doorWidthInches !== 'number' || !Number.isFinite(state.doorWidthInches)) {
    throw new RangeError('Door opening width must be a finite number of inches.');
  }
  if (state.doorWidthInches < MINIMUM_OPENING_WIDTH_INCHES) {
    throw new RangeError(
      `Each door opening must be at least ${String(MINIMUM_OPENING_WIDTH_INCHES)} inches wide.`
    );
  }

  if (centerCount === 0) {
    if (state.centerWallInches !== null) {
      throw new RangeError('A single door opening has no center wall.');
    }
  } else {
    if (typeof state.centerWallInches !== 'number' || !Number.isFinite(state.centerWallInches)) {
      throw new RangeError('Center wall width must be a finite number of inches.');
    }
    if (state.centerWallInches < MINIMUM_CENTER_WALL_INCHES) {
      throw new RangeError(
        `A wall between doors must be at least ${String(MINIMUM_CENTER_WALL_INCHES)} inches wide.`
      );
    }
  }

  assertSideWall(state.leftWallInches, 'Left wall');
  assertSideWall(state.rightWallInches, 'Right wall');

  const total =
    (state.leftWallInches ?? 0) +
    (state.rightWallInches ?? 0) +
    state.doorWidthInches * doorCount +
    (state.centerWallInches ?? 0) * centerCount;

  assertTotalMatchesWidth(total, state.widthInches);
}

export function resolveGarageFrontSegments(state: GarageFrontState): readonly GarageFrontSegment[] {
  assertGarageFrontState(state);
  const inputs =
    state.type === 'custom' ? (state.customSegments ?? []) : presetSegmentInputs(state);

  const segments: GarageFrontSegment[] = [];
  const counts: Record<GarageFrontSegmentKind, number> = { wall: 0, opening: 0 };
  const centerWallCount = inputs.filter(
    (segment, position) =>
      segment.kind === 'wall' && position !== 0 && position !== inputs.length - 1
  ).length;

  let cursor = 0;
  let centerIndex = 0;

  for (const [position, input] of inputs.entries()) {
    const kind = input.kind;
    counts[kind] += 1;
    const index = counts[kind];
    let label: string;

    if (input.label !== undefined) {
      label = input.label;
    } else if (kind === 'opening') {
      label = `Door opening ${String(index)}`;
    } else if (position === 0) {
      label = 'Left wall';
    } else if (position === inputs.length - 1) {
      label = 'Right wall';
    } else {
      centerIndex += 1;
      label = centerWallCount > 1 ? `Center wall ${String(centerIndex)}` : 'Center wall';
    }

    const startInches = cursor;
    const endInches = roundToHundredth(cursor + input.lengthInches);
    segments.push({
      id: `${kind}-${String(index)}`,
      kind,
      index,
      lengthInches: input.lengthInches,
      startInches,
      endInches,
      label,
      accessibleDescription: describeSegment(label, kind, input.lengthInches, startInches),
    });
    cursor = endInches;
  }

  return segments;
}

export function getGarageFrontOpenings(state: GarageFrontState): readonly GarageFrontOpening[] {
  return resolveGarageFrontSegments(state).filter(isOpening);
}

export function getGarageFrontGeometry(state: GarageFrontState): GarageFrontGeometry {
  const segments = resolveGarageFrontSegments(state);
  const openings = segments.filter(isOpening);
  const totalOpeningInches = roundToHundredth(sumLengths(openings));
  const totalWallInches = roundToHundredth(
    sumLengths(segments.filter((segment) => segment.kind === 'wall'))
  );

  return {
    widthInches: state.widthInches,
    type: state.type,
    segments,
    openings,
    openingCount: openings.length,
    totalOpeningInches,
    totalWallInches,
    description: describeGarageFrontSegments(state, segments, openings, totalOpeningInches),
  };
}

export function describeGarageFront(state: GarageFrontState): string {
  return getGarageFrontGeometry(state).description;
}

/**
 * Rectangles for a straight-on elevation of the garage front, in inch-based user units so an
 * SVG can be drawn without re-deriving any geometry.
 */
export function getGarageFrontSvgModel(
  state: GarageFrontState,
  options: GarageFrontSvgOptions = {}
): GarageFrontSvgModel {
  const unitsPerInch = options.unitsPerInch ?? 1;
  const bandDepthInches = options.bandDepthInches ?? 12;

  if (!Number.isFinite(unitsPerInch) || unitsPerInch <= 0) {
    throw new RangeError('SVG scale must be a positive number of units per inch.');
  }
  if (!Number.isFinite(bandDepthInches) || bandDepthInches <= 0) {
    throw new RangeError('SVG band depth must be a positive number of inches.');
  }

  const geometry = getGarageFrontGeometry(state);
  const viewBoxWidth = roundToHundredth(geometry.widthInches * unitsPerInch);
  const viewBoxHeight = roundToHundredth(bandDepthInches * unitsPerInch);

  return {
    viewBox: `0 0 ${String(viewBoxWidth)} ${String(viewBoxHeight)}`,
    viewBoxWidth,
    viewBoxHeight,
    unitsPerInch,
    segments: geometry.segments.map((segment) => ({
      ...segment,
      x: roundToHundredth(segment.startInches * unitsPerInch),
      y: 0,
      width: roundToHundredth(segment.lengthInches * unitsPerInch),
      height: viewBoxHeight,
    })),
    title: `Garage front, ${formatInches(geometry.widthInches)} inches wide`,
    description: geometry.description,
  };
}

export function describeGarageFrontType(type: GarageFrontConfigurationType): string {
  return describeType(type);
}

/** Trims trailing zeros so 96 reads as "96" and 64.50 reads as "64.5". */
export function formatInches(value: number): string {
  return String(roundToHundredth(value));
}

function describeType(type: GarageFrontConfigurationType): string {
  switch (type) {
    case 'one-double-door':
      return 'one double door';
    case 'two-single-doors':
      return 'two single doors separated by a center wall';
    case 'three-single-doors':
      return 'three single doors separated by center walls';
    case 'custom':
      return 'a custom arrangement of walls and openings';
  }
}

function describeGarageFrontSegments(
  state: GarageFrontState,
  segments: readonly GarageFrontSegment[],
  openings: readonly GarageFrontOpening[],
  totalOpeningInches: number
): string {
  const run = segments
    .map((segment) => `${segment.label} ${formatInches(segment.lengthInches)} in`)
    .join(', ');
  const ramps =
    openings.length === 0
      ? 'No door openings, so no front transition ramp is needed.'
      : `${
          openings.length === 1
            ? 'One door opening needs'
            : `${String(openings.length)} door openings need`
        } ${formatInches(totalOpeningInches)} inches of front transition ramp in total.`;

  return (
    `Garage front, ${formatInches(state.widthInches)} inches wide, configured as ` +
    `${describeType(state.type)}: ${run}. ${ramps}`
  );
}

function describeSegment(
  label: string,
  kind: GarageFrontSegmentKind,
  lengthInches: number,
  startInches: number
): string {
  const position =
    startInches === 0
      ? 'at the left edge of the garage front'
      : `starting ${formatInches(startInches)} inches from the left edge`;

  return kind === 'opening'
    ? `${label}, ${formatInches(lengthInches)} inches wide, ${position}. Needs a front transition ramp.`
    : `${label}, ${formatInches(lengthInches)} inches wide, ${position}. No ramp needed.`;
}

function presetSegmentInputs(state: GarageFrontState): readonly GarageFrontSegmentInput[] {
  const doorCount = getGarageFrontDoorCount(state.type as GarageFrontPresetType);
  const inputs: GarageFrontSegmentInput[] = [];
  const left = state.leftWallInches ?? 0;
  const right = state.rightWallInches ?? 0;

  if (left > 0) {
    inputs.push({ kind: 'wall', lengthInches: left });
  }
  for (let door = 0; door < doorCount; door++) {
    if (door > 0 && state.centerWallInches !== null) {
      inputs.push({ kind: 'wall', lengthInches: state.centerWallInches });
    }
    inputs.push({ kind: 'opening', lengthInches: state.doorWidthInches ?? 0 });
  }
  if (right > 0) {
    inputs.push({ kind: 'wall', lengthInches: right });
  }

  return inputs;
}

function derivePresetDimensions(
  type: GarageFrontPresetType,
  widthInches: number
): Pick<
  GarageFrontState,
  'doorWidthInches' | 'centerWallInches' | 'leftWallInches' | 'rightWallInches'
> | null {
  const doorCount = getGarageFrontDoorCount(type);
  const centerCount = doorCount - 1;
  const preferredDoor =
    type === 'one-double-door'
      ? DEFAULT_DOUBLE_DOOR_WIDTH_INCHES
      : DEFAULT_SINGLE_DOOR_WIDTH_INCHES;
  const centerCandidates =
    centerCount === 0 ? [0] : [DEFAULT_CENTER_WALL_INCHES, MINIMUM_CENTER_WALL_INCHES];

  for (const centerWall of centerCandidates) {
    for (const minimumSideWall of [DEFAULT_MINIMUM_SIDE_WALL_INCHES, 0]) {
      const centerTotal = centerWall * centerCount;
      const available = widthInches - centerTotal - minimumSideWall * 2;
      if (available <= 0) {
        continue;
      }

      const doorWidthInches = Math.min(preferredDoor, floorToQuarter(available / doorCount));
      if (doorWidthInches < MINIMUM_OPENING_WIDTH_INCHES) {
        continue;
      }

      const wallTotal = roundToHundredth(widthInches - doorWidthInches * doorCount - centerTotal);
      const leftWallInches = roundToHundredth(wallTotal / 2);
      const rightWallInches = roundToHundredth(wallTotal - leftWallInches);
      if (leftWallInches < 0 || rightWallInches < 0) {
        continue;
      }

      return {
        doorWidthInches,
        centerWallInches: centerCount === 0 ? null : centerWall,
        leftWallInches,
        rightWallInches,
      };
    }
  }

  return null;
}

/**
 * Scales a custom front to a new width. Lengths are rounded to a hundredth of an inch for tidy
 * numbers, and the residual is absorbed by the longest segment so it cannot round a short wall
 * away to nothing. If rounding would still erase a segment, the unrounded scale is used instead.
 */
function scaleCustomSegments(
  segments: readonly GarageFrontSegmentInput[],
  fromWidthInches: number,
  toWidthInches: number
): readonly GarageFrontSegmentInput[] | null {
  if (segments.length === 0 || fromWidthInches <= 0) {
    return null;
  }

  const ratio = toWidthInches / fromWidthInches;
  const rounded = segments.map((segment) => ({
    ...segment,
    lengthInches: roundToHundredth(segment.lengthInches * ratio),
  }));
  const scaled = rounded.some((segment) => segment.lengthInches <= 0)
    ? segments.map((segment) => ({ ...segment, lengthInches: segment.lengthInches * ratio }))
    : rounded;

  let longest = 0;
  for (const [index, segment] of scaled.entries()) {
    if (segment.lengthInches > (scaled[longest]?.lengthInches ?? 0)) {
      longest = index;
    }
  }

  const others = scaled.reduce(
    (total, segment, index) => (index === longest ? total : total + segment.lengthInches),
    0
  );
  const target = scaled[longest];
  if (target === undefined) {
    return null;
  }
  scaled[longest] = { ...target, lengthInches: toWidthInches - others };

  return scaled;
}

function assertCustomFront(state: GarageFrontState): void {
  const segments = state.customSegments;
  if (segments === null || segments.length === 0) {
    throw new RangeError('A custom garage front needs at least one wall or opening segment.');
  }
  if (
    state.doorWidthInches !== null ||
    state.centerWallInches !== null ||
    state.leftWallInches !== null ||
    state.rightWallInches !== null
  ) {
    throw new RangeError('A custom garage front sizes every segment individually.');
  }

  let previousKind: GarageFrontSegmentKind | null = null;
  let total = 0;

  for (const [position, segment] of segments.entries()) {
    const ordinal = String(position + 1);
    if (!isGarageFrontSegmentKind(segment.kind)) {
      throw new RangeError(`Segment ${ordinal} must be a wall or an opening.`);
    }
    if (typeof segment.lengthInches !== 'number' || !Number.isFinite(segment.lengthInches)) {
      throw new RangeError(`Segment ${ordinal} must have a finite length in inches.`);
    }
    if (segment.lengthInches <= 0) {
      throw new RangeError(`Segment ${ordinal} must be longer than zero inches.`);
    }
    if (segment.kind === 'opening' && segment.lengthInches < MINIMUM_OPENING_WIDTH_INCHES) {
      throw new RangeError(
        `Segment ${ordinal} is an opening, so it must be at least ${String(MINIMUM_OPENING_WIDTH_INCHES)} inches wide.`
      );
    }
    if (segment.kind === previousKind) {
      throw new RangeError(
        `Segments ${String(position)} and ${ordinal} are both ${segment.kind} segments; combine them into one.`
      );
    }
    if (segment.label !== undefined && segment.label.trim().length === 0) {
      throw new RangeError(`Segment ${ordinal} has an empty label.`);
    }

    previousKind = segment.kind;
    total += segment.lengthInches;
  }

  assertTotalMatchesWidth(total, state.widthInches);
}

function assertTotalMatchesWidth(total: number, widthInches: number): void {
  if (Math.abs(total - widthInches) > GARAGE_FRONT_LENGTH_TOLERANCE_INCHES) {
    throw new RangeError(
      `Garage front segments total ${formatInches(total)} inches but the garage is ` +
        `${formatInches(widthInches)} inches wide.`
    );
  }
}

function assertSideWall(value: number | null, label: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RangeError(`${label} width must be a finite number of inches.`);
  }
  if (value < 0) {
    throw new RangeError(`${label} width cannot be negative.`);
  }
}

function assertGarageWidth(widthInches: number): void {
  if (typeof widthInches !== 'number' || !Number.isFinite(widthInches)) {
    throw new RangeError('Garage width must be a finite number of inches.');
  }
  if (
    widthInches < MINIMUM_GARAGE_DIMENSION_INCHES ||
    widthInches > MAXIMUM_GARAGE_DIMENSION_INCHES
  ) {
    throw new RangeError(
      `Garage width must be between ${String(MINIMUM_GARAGE_DIMENSION_INCHES)} and ` +
        `${String(MAXIMUM_GARAGE_DIMENSION_INCHES)} inches.`
    );
  }
}

function isValidGarageFront(state: GarageFrontState): boolean {
  try {
    assertGarageFrontState(state);
    return true;
  } catch {
    return false;
  }
}

function isOpening(segment: GarageFrontSegment): segment is GarageFrontOpening {
  return segment.kind === 'opening';
}

function sumLengths(segments: readonly GarageFrontSegment[]): number {
  return segments.reduce((total, segment) => total + segment.lengthInches, 0);
}

function normalizeSegmentInput(segment: GarageFrontSegmentInput): GarageFrontSegmentInput {
  return Object.freeze({
    kind: segment.kind,
    lengthInches: segment.lengthInches,
    ...(segment.label === undefined ? {} : { label: segment.label }),
  });
}

function freezeState(state: GarageFrontState): GarageFrontState {
  return Object.freeze({
    ...state,
    customSegments: state.customSegments === null ? null : Object.freeze([...state.customSegments]),
  });
}

function floorToQuarter(value: number): number {
  return Math.floor(value * 4) / 4;
}

function roundToHundredth(value: number): number {
  return Math.round(value * 100) / 100;
}
