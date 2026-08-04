import { describe, expect, it } from 'vitest';
import {
  createRoughPlanStorage,
  EMPTY_PERSISTED_ROUGH_PLANS,
  listRoughPlans,
  migrateRoughPlansV3ToV4,
  migrateRoughPlansV1ToV2,
  OLDEST_SUPPORTED_ROUGH_PLAN_SCHEMA_VERSION,
  parsePersistedRoughPlans,
  removeRoughPlan,
  resolveRoughPlanGarageFront,
  ROUGH_PLAN_SCHEMA_VERSION,
  ROUGH_PLAN_STORAGE_KEY,
  upsertRoughPlan,
  type RoughPlanDocument,
  type RoughPlanDocumentV1,
  type RoughPlanDocumentV3,
  type PersistedRoughPlansSchemaV3,
} from './roughPlanStorage';
import { createRoughDesignState, paintRoughDesignCell } from '../rough-design';
import { createDefaultGarageFrontState, createGarageFrontState } from '../garage-front';
import type { StorageLike } from './storage';

function memoryStorage(seed: Readonly<Record<string, string>> = {}): StorageLike {
  const values = new Map(Object.entries(seed));

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

function plan(overrides: Partial<RoughPlanDocument> = {}): RoughPlanDocument {
  return {
    id: 'two-car-checkerboard',
    name: 'Two car checkerboard',
    createdAt: '2026-07-29T12:00:00.000Z',
    updatedAt: '2026-07-29T12:00:00.000Z',
    design: createRoughDesignState({ type: 'checkerboard' }),
    garageFront: createDefaultGarageFrontState(230),
    selectedProductId: 'vevor-garage-tiles-interlocking-12in',
    wasteAllowancePercent: 10,
    ...overrides,
  };
}

function planV1(overrides: Partial<RoughPlanDocumentV1> = {}): RoughPlanDocumentV1 {
  return {
    id: 'legacy-plan',
    name: 'Legacy plan',
    createdAt: '2026-07-01T12:00:00.000Z',
    updatedAt: '2026-07-01T12:00:00.000Z',
    design: createRoughDesignState({ type: 'border' }),
    selectedProductId: 'racedeck-diamond',
    wasteAllowancePercent: 5,
    ...overrides,
  };
}

describe('rough plan storage', () => {
  it('round-trips a rough plan, including painted custom cells', () => {
    const storage = memoryStorage();
    const adapter = createRoughPlanStorage(storage);
    const custom = createRoughDesignState({
      type: 'custom',
      customBaseType: 'perimeter-frame',
    });
    const painted = paintRoughDesignCell(custom, custom.customGrid!, 3, 4, 'secondary');
    const state = upsertRoughPlan(EMPTY_PERSISTED_ROUGH_PLANS, plan({ design: painted }));

    expect(adapter.write(state).ok).toBe(true);
    const read = adapter.read();
    expect(read.ok && read.value).toEqual(state);
    expect(storage.getItem(ROUGH_PLAN_STORAGE_KEY)).toContain('"schemaVersion":4');
  });

  it('round-trips a new stable pattern-library id without a schema migration', () => {
    const storage = memoryStorage();
    const adapter = createRoughPlanStorage(storage);
    const state = upsertRoughPlan(
      EMPTY_PERSISTED_ROUGH_PLANS,
      plan({
        id: 'nested-diamond-plan',
        design: createRoughDesignState({ type: 'nested-diamonds' }),
      })
    );

    expect(adapter.write(state).ok).toBe(true);
    const read = adapter.read();

    expect(read.ok && read.value?.activePlan?.design.type).toBe('nested-diamonds');
    expect(read.ok && read.value?.plansById['nested-diamond-plan']?.design.type).toBe(
      'nested-diamonds'
    );
  });

  it('reports an empty store rather than inventing a plan', () => {
    const read = createRoughPlanStorage(memoryStorage()).read();
    expect(read.ok && read.value).toBeNull();
  });

  it('refuses data written by a newer schema version', () => {
    const adapter = createRoughPlanStorage(
      memoryStorage({
        [ROUGH_PLAN_STORAGE_KEY]: JSON.stringify({
          schemaVersion: ROUGH_PLAN_SCHEMA_VERSION + 1,
          activePlan: null,
          plansById: {},
        }),
      })
    );
    const read = adapter.read();

    expect(read.ok).toBe(false);
    expect(read.ok ? '' : read.error.kind).toBe('unsupported-version');
  });

  it('rejects a stored design the rough-design model would not accept', () => {
    const broken = {
      schemaVersion: ROUGH_PLAN_SCHEMA_VERSION,
      activePlan: null,
      plansById: {
        'bad-plan': {
          ...plan({ id: 'bad-plan' }),
          design: {
            ...createRoughDesignState(),
            type: 'checkerboard',
            customCells: { '1-1': 'accent' },
          },
        },
      },
    };
    const read = createRoughPlanStorage(
      memoryStorage({ [ROUGH_PLAN_STORAGE_KEY]: JSON.stringify(broken) })
    ).read();

    expect(read.ok).toBe(false);
    expect(read.ok ? '' : read.error.kind).toBe('corrupt');
  });

  it('rejects malformed json without clearing it', () => {
    const storage = memoryStorage({ [ROUGH_PLAN_STORAGE_KEY]: '{not json' });
    const read = createRoughPlanStorage(storage).read();

    expect(read.ok).toBe(false);
    expect(read.ok ? '' : read.error.kind).toBe('corrupt');
    expect(storage.getItem(ROUGH_PLAN_STORAGE_KEY)).toBe('{not json');
  });

  it('rejects a plan whose id does not match its key', () => {
    expect(() =>
      parsePersistedRoughPlans({
        schemaVersion: ROUGH_PLAN_SCHEMA_VERSION,
        activePlan: null,
        plansById: { 'other-id': plan() },
      })
    ).toThrow(/must match its plan map key/);
  });

  it('upserts, lists newest first, and removes plans', () => {
    const first = plan({ id: 'first-plan', name: 'First', updatedAt: '2026-07-29T12:00:00.000Z' });
    const second = plan({
      id: 'second-plan',
      name: 'Second',
      updatedAt: '2026-07-29T13:00:00.000Z',
    });
    const state = upsertRoughPlan(upsertRoughPlan(EMPTY_PERSISTED_ROUGH_PLANS, first), second);

    expect(listRoughPlans(state).map((entry) => entry.id)).toEqual(['second-plan', 'first-plan']);
    expect(state.activePlan?.id).toBe('second-plan');

    const removed = removeRoughPlan(state, 'second-plan');
    expect(listRoughPlans(removed).map((entry) => entry.id)).toEqual(['first-plan']);
    expect(removed.activePlan).toBeNull();
  });

  it('reports unavailable storage explicitly', () => {
    const adapter = createRoughPlanStorage(null);

    expect(adapter.read().ok).toBe(false);
    expect(adapter.write(EMPTY_PERSISTED_ROUGH_PLANS).ok).toBe(false);
  });
});

describe('rough plan schema migration', () => {
  it('upgrades v1 simple rough pattern names to stable preset ids', () => {
    const legacy = {
      schemaVersion: 2,
      activePlan: null,
      plansById: {
        'legacy-pattern': {
          ...plan({ id: 'legacy-pattern' }),
          design: {
            ...createRoughDesignState({ type: 'checker-grid' }),
            version: 1,
            type: 'checkerboard',
          },
        },
      },
    };

    const migrated = parsePersistedRoughPlans(legacy);

    expect(migrated.schemaVersion).toBe(ROUGH_PLAN_SCHEMA_VERSION);
    expect(migrated.plansById['legacy-pattern']?.design).toMatchObject({
      version: 3,
      type: 'checker-grid',
    });
  });

  it('reads a v1 envelope and upgrades it to the current version', () => {
    const legacy = {
      schemaVersion: OLDEST_SUPPORTED_ROUGH_PLAN_SCHEMA_VERSION,
      activePlan: planV1(),
      plansById: { 'legacy-plan': planV1() },
    };
    const read = createRoughPlanStorage(
      memoryStorage({ [ROUGH_PLAN_STORAGE_KEY]: JSON.stringify(legacy) })
    ).read();

    expect(read.ok).toBe(true);
    const value = read.ok ? read.value : null;
    expect(value?.schemaVersion).toBe(ROUGH_PLAN_SCHEMA_VERSION);
    expect(value?.plansById['legacy-plan']?.name).toBe('Legacy plan');
  });

  it('migrates v3 plans to default one-inch clearance without changing outer or front geometry', () => {
    const current = plan();
    const legacyDesign: RoughPlanDocumentV3['design'] = {
      version: 2,
      garage: current.design.garage,
      type: current.design.type,
      colors: current.design.colors,
      customBaseType: current.design.customBaseType,
      customGrid: current.design.customGrid,
      customCells: current.design.customCells,
    };
    const legacy: PersistedRoughPlansSchemaV3 = {
      schemaVersion: 3,
      activePlan: { ...current, design: legacyDesign },
      plansById: { [current.id]: { ...current, design: legacyDesign } },
    };

    const migrated = migrateRoughPlansV3ToV4(legacy);
    const migratedPlan = migrated.plansById[current.id];

    expect(migratedPlan?.design.expansionClearance).toEqual({
      leftInches: 1,
      rightInches: 1,
      frontInches: 1,
      backInches: 1,
    });
    expect(migratedPlan?.design.garage).toEqual({ widthInches: 230, lengthInches: 246 });
    expect(migratedPlan?.garageFront).toEqual(current.garageFront);
  });

  it('gives a migrated v1 plan the default front for its own garage width', () => {
    const migrated = migrateRoughPlansV1ToV2({
      schemaVersion: OLDEST_SUPPORTED_ROUGH_PLAN_SCHEMA_VERSION,
      activePlan: null,
      plansById: { 'legacy-plan': planV1() },
    });
    const front = migrated.plansById['legacy-plan']?.garageFront;

    expect(migrated.schemaVersion).toBe(ROUGH_PLAN_SCHEMA_VERSION);
    expect(front?.type).toBe('two-single-doors');
    expect(front?.widthInches).toBe(230);
    expect(front?.doorWidthInches).toBe(94);
    expect(front?.centerWallInches).toBe(12);
  });

  it('derives a front when a stored plan has none', () => {
    const parsed = parsePersistedRoughPlans({
      schemaVersion: OLDEST_SUPPORTED_ROUGH_PLAN_SCHEMA_VERSION,
      activePlan: null,
      plansById: { 'legacy-plan': planV1() },
    });

    expect(parsed.plansById['legacy-plan']?.garageFront?.type).toBe('two-single-doors');
  });

  it('keeps a stored front instead of replacing it with the default', () => {
    const custom = createGarageFrontState(230, { type: 'three-single-doors' });
    const state = upsertRoughPlan(EMPTY_PERSISTED_ROUGH_PLANS, plan({ garageFront: custom }));
    const storage = memoryStorage();
    const adapter = createRoughPlanStorage(storage);

    expect(adapter.write(state).ok).toBe(true);
    const read = adapter.read();

    expect(read.ok && read.value?.plansById['two-car-checkerboard']?.garageFront).toEqual(custom);
  });

  it('re-fits a stored front whose width no longer matches its garage', () => {
    const parsed = parsePersistedRoughPlans({
      schemaVersion: ROUGH_PLAN_SCHEMA_VERSION,
      activePlan: null,
      plansById: {
        'resized-plan': {
          ...plan({ id: 'resized-plan' }),
          design: createRoughDesignState({ garage: { widthInches: 254, lengthInches: 246 } }),
          garageFront: createDefaultGarageFrontState(230),
        },
      },
    });
    const front = parsed.plansById['resized-plan']?.garageFront;

    expect(front?.widthInches).toBe(254);
    expect(front?.doorWidthInches).toBe(94);
    expect(front?.leftWallInches).toBe(27);
  });

  it('rejects a stored front the garage front model would not accept', () => {
    expect(() =>
      parsePersistedRoughPlans({
        schemaVersion: ROUGH_PLAN_SCHEMA_VERSION,
        activePlan: null,
        plansById: {
          'bad-front': {
            ...plan({ id: 'bad-front' }),
            garageFront: { ...createDefaultGarageFrontState(230), centerWallInches: 1 },
          },
        },
      })
    ).toThrow(/at least 4 inches/);
  });

  it('resolves the front for a plan that never stored one', () => {
    const front = resolveRoughPlanGarageFront(planV1());

    expect(front.type).toBe('two-single-doors');
    expect(front.widthInches).toBe(230);
  });
});
