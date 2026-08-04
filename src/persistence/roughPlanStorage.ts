/**
 * Versioned local storage for guided rough plans.
 *
 * A rough plan is a brand-neutral design (pattern, role colors, garage size), the front
 * wall/opening configuration, and the tile the user picked while exploring products. The existing
 * `DesignDocument` schema stores a *physical* layout: one catalog cell per grid position. Writing
 * a rough plan into that shape would persist the wrong abstraction, so this module keeps its own
 * envelope, its own key, and its own schema version next to the design store instead of
 * pretending a painted floor was saved.
 *
 * Schema history:
 * - v1: design, selected product, waste allowance.
 * - v2: adds `garageFront`. v1 payloads are migrated by deriving the default front for each
 *   plan's garage width, which is a real default rather than a guess at what the user had.
 * - v3: upgrades rough-design v1 simple pattern names to stable pattern-library ids.
 * - v4: adds one-inch-per-side expansion clearance to rough designs. Existing plans retain
 *   their outer garage and door geometry while product layouts use the new inset tile field.
 */

import { DomainValidationError } from '../domain/catalog';
import { PersistenceVersionError } from '../domain/persistence';
import {
  assertGarageFrontState,
  createDefaultGarageFrontState,
  GARAGE_FRONT_VERSION,
  isGarageFrontConfigurationType,
  isGarageFrontSegmentKind,
  syncGarageFrontToGarage,
  type GarageFrontSegmentInput,
  type GarageFrontState,
} from '../garage-front';
import {
  assertRoughDesignState,
  DEFAULT_PERIMETER_EXPANSION_CLEARANCE,
  migrateRoughDesignType,
  ROUGH_DESIGN_ROLES,
  type RoughDesignState,
} from '../rough-design';
import { createVersionedStorage, resolveLocalStorage, type StorageLike } from './storage';
import type { VersionedStorageAdapter } from './storage';

export const ROUGH_PLAN_STORAGE_KEY = 'garage-floor-design/rough-plans';
export const ROUGH_PLAN_SCHEMA_VERSION = 4;
/** Oldest envelope this module can still read and upgrade. */
export const OLDEST_SUPPORTED_ROUGH_PLAN_SCHEMA_VERSION = 1;

export type RoughPlanId = string;

export interface RoughPlanDocument {
  readonly id: RoughPlanId;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly design: RoughDesignState;
  /**
   * Front wall and opening configuration. Optional at construction so a caller can save a plan
   * before the front has been chosen; reading always resolves a front, deriving the default for
   * the plan's garage width when one was not stored.
   */
  readonly garageFront?: GarageFrontState;
  /** Catalog product the user selected while exploring tiles, when one was chosen. */
  readonly selectedProductId: string | null;
  readonly wasteAllowancePercent: number;
}

/** A v1 plan, which predates the garage front. */
export interface RoughPlanDocumentV1 {
  readonly id: RoughPlanId;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly design: RoughDesignState;
  readonly selectedProductId: string | null;
  readonly wasteAllowancePercent: number;
}

export interface PersistedRoughPlans {
  readonly schemaVersion: typeof ROUGH_PLAN_SCHEMA_VERSION;
  /** The plan currently on screen, restored on the next visit. */
  readonly activePlan: RoughPlanDocument | null;
  readonly plansById: Readonly<Record<RoughPlanId, RoughPlanDocument>>;
}

/** The v1 envelope, kept so the migration has a type to read. */
export interface PersistedRoughPlansSchemaV1 {
  readonly schemaVersion: typeof OLDEST_SUPPORTED_ROUGH_PLAN_SCHEMA_VERSION;
  readonly activePlan: RoughPlanDocumentV1 | null;
  readonly plansById: Readonly<Record<RoughPlanId, RoughPlanDocumentV1>>;
}

/** A v3 plan, which has no expansion-clearance field in its rough-design state. */
export interface RoughPlanDocumentV3 extends Omit<RoughPlanDocument, 'design'> {
  readonly design: Omit<RoughDesignState, 'version' | 'expansionClearance'> & {
    readonly version: 1 | 2;
  };
}

/** The v3 envelope, which predates persisted expansion clearance. */
export interface PersistedRoughPlansSchemaV3 {
  readonly schemaVersion: 3;
  readonly activePlan: RoughPlanDocumentV3 | null;
  readonly plansById: Readonly<Record<RoughPlanId, RoughPlanDocumentV3>>;
}

/**
 * Historic name for the current envelope. It predates the v2 schema and is kept so existing
 * callers keep compiling; new code should use {@link PersistedRoughPlans}.
 */
export type PersistedRoughPlansV1 = PersistedRoughPlans;

export const EMPTY_PERSISTED_ROUGH_PLANS: PersistedRoughPlans = Object.freeze({
  schemaVersion: ROUGH_PLAN_SCHEMA_VERSION,
  activePlan: null,
  plansById: Object.freeze({}),
});

export function parsePersistedRoughPlans(value: unknown): PersistedRoughPlans {
  const record = expectRecord(value, 'persistedRoughPlans');
  const schemaVersion = record.schemaVersion;

  if (typeof schemaVersion !== 'number' || !Number.isSafeInteger(schemaVersion)) {
    throw new PersistenceVersionError(
      schemaVersion,
      'Persisted rough plans must declare an integer schemaVersion.'
    );
  }

  if (schemaVersion > ROUGH_PLAN_SCHEMA_VERSION) {
    throw new PersistenceVersionError(
      schemaVersion,
      `Rough plan version ${String(schemaVersion)} is newer than supported version ${String(ROUGH_PLAN_SCHEMA_VERSION)}.`
    );
  }

  if (schemaVersion < OLDEST_SUPPORTED_ROUGH_PLAN_SCHEMA_VERSION) {
    throw new PersistenceVersionError(
      schemaVersion,
      `Rough plan version ${String(schemaVersion)} is unsupported.`
    );
  }

  const plans = expectRecord(record.plansById, 'persistedRoughPlans.plansById');
  const plansById: Record<RoughPlanId, RoughPlanDocument> = Object.create(null) as Record<
    RoughPlanId,
    RoughPlanDocument
  >;

  for (const [id, plan] of Object.entries(plans)) {
    validateStableId(id, 'persistedRoughPlans.plansById key');
    const parsed = parseRoughPlanDocument(plan, `persistedRoughPlans.plansById.${id}`);
    if (parsed.id !== id) {
      throw new DomainValidationError(
        `persistedRoughPlans.plansById.${id}.id`,
        'must match its plan map key'
      );
    }
    plansById[id] = parsed;
  }

  return {
    schemaVersion: ROUGH_PLAN_SCHEMA_VERSION,
    activePlan:
      record.activePlan === null || record.activePlan === undefined
        ? null
        : parseRoughPlanDocument(record.activePlan, 'persistedRoughPlans.activePlan'),
    plansById,
  };
}

/**
 * Upgrades a v1 envelope. Every plan keeps its design and gets the default front for its own
 * garage width, since v1 recorded nothing about doors.
 */
export function migrateRoughPlansV1ToV2(value: PersistedRoughPlansSchemaV1): PersistedRoughPlans {
  const plansById: Record<RoughPlanId, RoughPlanDocument> = Object.create(null) as Record<
    RoughPlanId,
    RoughPlanDocument
  >;

  for (const [id, plan] of Object.entries(value.plansById)) {
    plansById[id] = migrateRoughPlanDocumentV1ToV2(plan);
  }

  return {
    schemaVersion: ROUGH_PLAN_SCHEMA_VERSION,
    activePlan: value.activePlan === null ? null : migrateRoughPlanDocumentV1ToV2(value.activePlan),
    plansById,
  };
}

/**
 * Upgrades v3 plans by assigning the mandatory one-inch clearance. It intentionally leaves
 * outer dimensions and garage-front widths untouched, because doors remain on the outer front.
 */
export function migrateRoughPlansV3ToV4(value: PersistedRoughPlansSchemaV3): PersistedRoughPlans {
  const migrate = (plan: RoughPlanDocumentV3): RoughPlanDocument => ({
    ...plan,
    design: {
      ...plan.design,
      version: 3,
      expansionClearance: DEFAULT_PERIMETER_EXPANSION_CLEARANCE,
    },
  });

  return {
    schemaVersion: ROUGH_PLAN_SCHEMA_VERSION,
    activePlan: value.activePlan === null ? null : migrate(value.activePlan),
    plansById: Object.fromEntries(
      Object.entries(value.plansById).map(([id, plan]) => [id, migrate(plan)])
    ),
  };
}

export function migrateRoughPlanDocumentV1ToV2(plan: RoughPlanDocumentV1): RoughPlanDocument {
  return {
    ...plan,
    garageFront: createDefaultGarageFrontState(plan.design.garage.widthInches),
  };
}

/**
 * The front a plan should be shown with: the stored one, re-fitted to the plan's garage width, or
 * the default front when the plan predates the garage front or never chose one.
 */
export function resolveRoughPlanGarageFront(plan: RoughPlanDocument): GarageFrontState {
  if (plan.garageFront === undefined) {
    return createDefaultGarageFrontState(plan.design.garage.widthInches);
  }

  return syncGarageFrontToGarage(plan.garageFront, plan.design.garage);
}

export function parseRoughPlanDocument(value: unknown, path: string): RoughPlanDocument {
  const record = expectRecord(value, path);
  const rawSelectedProductId = record.selectedProductId;
  const selectedProductId =
    rawSelectedProductId === null || rawSelectedProductId === undefined
      ? null
      : readStableId(rawSelectedProductId, `${path}.selectedProductId`);
  const design = parseRoughDesign(record.design, `${path}.design`);
  const storedFront =
    record.garageFront === null || record.garageFront === undefined
      ? null
      : parseGarageFront(record.garageFront, `${path}.garageFront`);

  return {
    id: readStableId(record.id, `${path}.id`),
    name: readNonEmptyString(record.name, `${path}.name`),
    createdAt: readIsoTimestamp(record.createdAt, `${path}.createdAt`),
    updatedAt: readIsoTimestamp(record.updatedAt, `${path}.updatedAt`),
    design,
    // A v1 plan, or a plan saved before a front was chosen, gets the default for its width. A
    // stored front is re-fitted in case the garage was resized by an older build.
    garageFront:
      storedFront === null
        ? createDefaultGarageFrontState(design.garage.widthInches)
        : syncGarageFrontToGarage(storedFront, design.garage),
    selectedProductId,
    wasteAllowancePercent: readPercent(
      record.wasteAllowancePercent,
      `${path}.wasteAllowancePercent`
    ),
  };
}

export function createRoughPlanStorage(
  storage: StorageLike | null = resolveLocalStorage()
): VersionedStorageAdapter<PersistedRoughPlans> {
  return createVersionedStorage<PersistedRoughPlans>({
    key: ROUGH_PLAN_STORAGE_KEY,
    storage,
    parse: parsePersistedRoughPlans,
  });
}

/** Adds or replaces a plan and makes it the active one, keeping timestamps monotonic. */
export function upsertRoughPlan(
  state: PersistedRoughPlans,
  plan: RoughPlanDocument
): PersistedRoughPlans {
  return {
    schemaVersion: ROUGH_PLAN_SCHEMA_VERSION,
    activePlan: plan,
    plansById: { ...state.plansById, [plan.id]: plan },
  };
}

export function removeRoughPlan(state: PersistedRoughPlans, id: RoughPlanId): PersistedRoughPlans {
  const plansById = { ...state.plansById };
  delete plansById[id];

  return {
    schemaVersion: ROUGH_PLAN_SCHEMA_VERSION,
    activePlan: state.activePlan?.id === id ? null : state.activePlan,
    plansById,
  };
}

/** Saved plans, newest update first, so the most recent work is easiest to reopen. */
export function listRoughPlans(state: PersistedRoughPlans): readonly RoughPlanDocument[] {
  return Object.values(state.plansById).sort(
    (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id)
  );
}

type UnknownRecord = Record<string, unknown>;

function parseGarageFront(value: unknown, path: string): GarageFrontState {
  const record = expectRecord(value, path);

  if (record.version !== GARAGE_FRONT_VERSION) {
    throw new DomainValidationError(
      `${path}.version`,
      `must be garage front version ${String(GARAGE_FRONT_VERSION)}`
    );
  }
  if (!isGarageFrontConfigurationType(record.type)) {
    throw new DomainValidationError(`${path}.type`, 'must be a known garage front configuration');
  }

  const candidate: GarageFrontState = {
    version: GARAGE_FRONT_VERSION,
    type: record.type,
    widthInches: readPositiveNumber(record.widthInches, `${path}.widthInches`),
    doorWidthInches: readNullableNumber(record.doorWidthInches, `${path}.doorWidthInches`),
    centerWallInches: readNullableNumber(record.centerWallInches, `${path}.centerWallInches`),
    leftWallInches: readNullableNumber(record.leftWallInches, `${path}.leftWallInches`),
    rightWallInches: readNullableNumber(record.rightWallInches, `${path}.rightWallInches`),
    customSegments: parseCustomSegments(record.customSegments, `${path}.customSegments`),
  };

  try {
    assertGarageFrontState(candidate);
  } catch (cause) {
    throw new DomainValidationError(
      path,
      cause instanceof Error ? cause.message : 'is not a valid garage front'
    );
  }

  return candidate;
}

function parseCustomSegments(
  value: unknown,
  path: string
): readonly GarageFrontSegmentInput[] | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!Array.isArray(value)) {
    throw new DomainValidationError(path, 'must be an array of segments or null');
  }

  return value.map((entry, index) => {
    const record = expectRecord(entry, `${path}[${String(index)}]`);
    if (!isGarageFrontSegmentKind(record.kind)) {
      throw new DomainValidationError(`${path}[${String(index)}].kind`, 'must be wall or opening');
    }
    const label =
      record.label === undefined || record.label === null
        ? undefined
        : readNonEmptyString(record.label, `${path}[${String(index)}].label`);

    return {
      kind: record.kind,
      lengthInches: readPositiveNumber(
        record.lengthInches,
        `${path}[${String(index)}].lengthInches`
      ),
      ...(label === undefined ? {} : { label }),
    };
  });
}

function parseRoughDesign(value: unknown, path: string): RoughDesignState {
  const record = expectRecord(value, path);
  const garage = expectRecord(record.garage, `${path}.garage`);
  const colors = expectRecord(record.colors, `${path}.colors`);
  const customGrid =
    record.customGrid === null || record.customGrid === undefined
      ? null
      : parseConceptualGrid(record.customGrid, `${path}.customGrid`);
  const customCells = expectRecord(record.customCells ?? {}, `${path}.customCells`);
  const type = migrateRoughDesignType(record.type);
  if (type === null) {
    throw new DomainValidationError(`${path}.type`, 'must be a known rough design type');
  }
  const customBaseType =
    record.customBaseType === null || record.customBaseType === undefined
      ? null
      : migrateRoughDesignType(record.customBaseType);
  if (customBaseType === 'custom') {
    throw new DomainValidationError(`${path}.customBaseType`, 'must be a rough pattern preset');
  }
  if (type === 'custom' && customBaseType === null) {
    throw new DomainValidationError(
      `${path}.customBaseType`,
      'must be a known rough pattern preset'
    );
  }
  if (record.version !== 1 && record.version !== 2 && record.version !== 3) {
    throw new DomainValidationError(`${path}.version`, 'must be rough design version 1, 2, or 3');
  }
  const candidate = {
    version: 3,
    garage: {
      widthInches: readPositiveNumber(garage.widthInches, `${path}.garage.widthInches`),
      lengthInches: readPositiveNumber(garage.lengthInches, `${path}.garage.lengthInches`),
    },
    expansionClearance:
      record.expansionClearance === null || record.expansionClearance === undefined
        ? DEFAULT_PERIMETER_EXPANSION_CLEARANCE
        : parseExpansionClearance(record.expansionClearance, `${path}.expansionClearance`),
    type,
    colors: Object.fromEntries(
      ROUGH_DESIGN_ROLES.map((role) => [
        role,
        parseDisplayColor(colors[role], `${path}.colors.${role}`),
      ])
    ),
    customBaseType,
    customGrid,
    customCells,
  } as RoughDesignState;

  try {
    assertRoughDesignState(candidate);
  } catch (cause) {
    throw new DomainValidationError(
      path,
      cause instanceof Error ? cause.message : 'is not a valid rough design'
    );
  }

  return candidate;
}

function parseExpansionClearance(
  value: unknown,
  path: string
): RoughDesignState['expansionClearance'] {
  const record = expectRecord(value, path);
  return {
    leftInches: readNonNegativeNumber(record.leftInches, `${path}.leftInches`),
    rightInches: readNonNegativeNumber(record.rightInches, `${path}.rightInches`),
    frontInches: readNonNegativeNumber(record.frontInches, `${path}.frontInches`),
    backInches: readNonNegativeNumber(record.backInches, `${path}.backInches`),
  };
}

function parseConceptualGrid(
  value: unknown,
  path: string
): { readonly columns: number; readonly rows: number } {
  const record = expectRecord(value, path);
  return {
    columns: readPositiveInteger(record.columns, `${path}.columns`),
    rows: readPositiveInteger(record.rows, `${path}.rows`),
  };
}

function parseDisplayColor(
  value: unknown,
  path: string
): { readonly hex: string; readonly label?: string } {
  const record = expectRecord(value, path);
  const hex = readNonEmptyString(record.hex, `${path}.hex`);
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    throw new DomainValidationError(`${path}.hex`, 'must be a six-digit hexadecimal color');
  }
  const label =
    record.label === undefined ? undefined : readNonEmptyString(record.label, `${path}.label`);

  return { hex, ...(label === undefined ? {} : { label }) };
}

function expectRecord(value: unknown, path: string): UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new DomainValidationError(path, 'must be an object');
  }

  return value as UnknownRecord;
}

function readNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DomainValidationError(path, 'must be a non-empty string');
  }

  return value;
}

function readStableId(value: unknown, path: string): string {
  const id = readNonEmptyString(value, path);
  validateStableId(id, path);
  return id;
}

function validateStableId(value: string, path: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new DomainValidationError(path, 'must be a lowercase kebab-case stable identifier');
  }
}

function readPositiveNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new DomainValidationError(path, 'must be a finite number greater than zero');
  }
  return value;
}

function readNonNegativeNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new DomainValidationError(path, 'must be a finite number greater than or equal to zero');
  }

  return value;
}

function readNullableNumber(value: unknown, path: string): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new DomainValidationError(path, 'must be a finite number or null');
  }

  return value;
}

function readPositiveInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new DomainValidationError(path, 'must be a positive safe integer');
  }

  return value;
}

function readPercent(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new DomainValidationError(path, 'must be a finite percentage from 0 to 100');
  }

  return value;
}

function readIsoTimestamp(value: unknown, path: string): string {
  const timestamp = readNonEmptyString(value, path);
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime()) || date.toISOString() !== timestamp) {
    throw new DomainValidationError(path, 'must be an ISO 8601 UTC timestamp');
  }

  return timestamp;
}
