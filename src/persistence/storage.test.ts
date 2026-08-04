import { describe, expect, it } from 'vitest';
import { PERSISTED_APP_STATE_SCHEMA_VERSION, type PersistedAppState } from '../domain/persistence';
import {
  createAppStateStorage,
  createVersionedStorage,
  resolveLocalStorage,
  type StorageLike,
} from './storage';

interface FakeStorageOptions {
  readonly failGet?: Error;
  readonly failSet?: Error;
}

function createFakeStorage(options: FakeStorageOptions = {}): StorageLike & {
  readonly data: Map<string, string>;
} {
  const data = new Map<string, string>();
  return {
    data,
    getItem(key) {
      if (options.failGet) throw options.failGet;
      return data.has(key) ? (data.get(key) as string) : null;
    },
    setItem(key, value) {
      if (options.failSet) throw options.failSet;
      data.set(key, value);
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

const design = {
  metadata: {
    id: 'july-garage',
    name: 'July Garage',
    createdAt: '2026-07-28T15:00:00.000Z',
    updatedAt: '2026-07-28T15:00:00.000Z',
  },
  garage: { widthInches: 230, lengthInches: 246 },
  layout: { cellSizeInches: 12, cellsById: {}, selectedProduct: null },
};

const validV1: PersistedAppState = {
  schemaVersion: PERSISTED_APP_STATE_SCHEMA_VERSION,
  settings: { wasteAllowancePercent: 8 },
  activeDraft: design,
  savedDesignsById: { 'july-garage': design },
  catalogOverrides: { priceOverridesById: {} },
};

describe('createVersionedStorage read', () => {
  it('returns null when nothing is stored', () => {
    const adapter = createAppStateStorage(createFakeStorage());
    const result = adapter.read();
    expect(result).toEqual({ ok: true, value: null });
  });

  it('round-trips a valid v1 payload', () => {
    const storage = createFakeStorage();
    const adapter = createAppStateStorage(storage);

    expect(adapter.write(validV1).ok).toBe(true);
    const result = adapter.read();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value?.savedDesignsById['july-garage']?.metadata.name).toBe('July Garage');
    }
  });

  it('reports malformed JSON as corrupt', () => {
    const storage = createFakeStorage();
    storage.data.set('garage-floor-design/app-state', '{not json');
    const adapter = createAppStateStorage(storage);

    const result = adapter.read();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('corrupt');
  });

  it('reports structurally invalid data as corrupt', () => {
    const storage = createFakeStorage();
    storage.data.set(
      'garage-floor-design/app-state',
      JSON.stringify({ schemaVersion: 1, settings: { wasteAllowancePercent: 500 } })
    );
    const adapter = createAppStateStorage(storage);

    const result = adapter.read();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('corrupt');
  });

  it('reports newer schema versions as unsupported', () => {
    const storage = createFakeStorage();
    storage.data.set('garage-floor-design/app-state', JSON.stringify({ schemaVersion: 99 }));
    const adapter = createAppStateStorage(storage);

    const result = adapter.read();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('unsupported-version');
  });

  it('migrates a v0 envelope on read', () => {
    const storage = createFakeStorage();
    storage.data.set(
      'garage-floor-design/app-state',
      JSON.stringify({ schemaVersion: 0, savedDesigns: [design] })
    );
    const adapter = createAppStateStorage(storage);

    const result = adapter.read();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value?.schemaVersion).toBe(PERSISTED_APP_STATE_SCHEMA_VERSION);
      expect(result.value?.savedDesignsById['july-garage']?.metadata.name).toBe('July Garage');
    }
  });

  it('still reads existing data when only the write probe hit quota', () => {
    // Simulate a full origin: the resolve probe throws quota, but reads succeed.
    const backing = createFakeStorage();
    backing.data.set('garage-floor-design/app-state', JSON.stringify(validV1));
    let probed = false;
    const flaky: StorageLike = {
      getItem: (key) => backing.getItem(key),
      setItem: (key, value) => {
        if (!probed) {
          probed = true;
          throw Object.assign(new Error('full'), { name: 'QuotaExceededError' });
        }
        backing.setItem(key, value);
      },
      removeItem: (key) => backing.removeItem(key),
    };

    const original = Reflect.get(globalThis, 'localStorage');
    Reflect.set(globalThis, 'localStorage', flaky);
    try {
      const resolved = resolveLocalStorage();
      expect(resolved).toBe(flaky);
      const adapter = createAppStateStorage(resolved);
      const result = adapter.read();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value?.savedDesignsById['july-garage']?.metadata.name).toBe('July Garage');
      }
    } finally {
      Reflect.set(globalThis, 'localStorage', original);
    }
  });

  it('reports storage access failures as unavailable', () => {
    const security = Object.assign(new Error('blocked'), { name: 'SecurityError' });
    const adapter = createAppStateStorage(createFakeStorage({ failGet: security }));

    const result = adapter.read();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('unavailable');
  });

  it('reports a missing backend as unavailable', () => {
    const adapter = createAppStateStorage(null);
    const result = adapter.read();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('unavailable');
  });
});

describe('createVersionedStorage write', () => {
  it('maps quota failures to an explicit quota-exceeded error', () => {
    const quota = Object.assign(new Error('full'), { name: 'QuotaExceededError' });
    const adapter = createAppStateStorage(createFakeStorage({ failSet: quota }));

    const result = adapter.write(validV1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('quota-exceeded');
      expect(result.error.cause).toBe(quota);
    }
  });

  it('maps a legacy Firefox quota code to quota-exceeded', () => {
    const quota = Object.assign(new Error('full'), { code: 1014 });
    const adapter = createAppStateStorage(createFakeStorage({ failSet: quota }));

    const result = adapter.write(validV1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('quota-exceeded');
  });

  it('maps a security failure on write to unavailable', () => {
    const security = Object.assign(new Error('blocked'), { name: 'SecurityError' });
    const adapter = createAppStateStorage(createFakeStorage({ failSet: security }));

    const result = adapter.write(validV1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('unavailable');
  });

  it('maps other write failures to write-failed', () => {
    const generic = new Error('disk gremlin');
    const adapter = createAppStateStorage(createFakeStorage({ failSet: generic }));

    const result = adapter.write(validV1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('write-failed');
  });
});

describe('createVersionedStorage generic parse', () => {
  it('surfaces parser throws as corrupt', () => {
    const storage = createFakeStorage();
    storage.data.set('custom', JSON.stringify({ value: 1 }));
    const adapter = createVersionedStorage<number>({
      key: 'custom',
      storage,
      parse: () => {
        throw new Error('bad');
      },
    });

    const result = adapter.read();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('corrupt');
  });
});

describe('resolveLocalStorage', () => {
  it('returns the jsdom localStorage when available', () => {
    expect(resolveLocalStorage()).toBe(globalThis.localStorage);
  });
});
