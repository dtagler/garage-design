import { describe, expect, it } from 'vitest';
import type { DesignDocument, PersistedAppState } from '../domain/persistence';
import { err, ok, type PersistenceResult } from './result';
import {
  createDraftDocument,
  EMPTY_PERSISTED_APP_STATE,
  listSavedDesigns,
  SavedDesignService,
} from './savedDesignService';
import type { VersionedStorageAdapter } from './storage';

function draftContent() {
  return {
    garage: { widthInches: 230, lengthInches: 246 },
    layout: { cellSizeInches: 12, cellsById: {}, selectedProduct: null },
  } as const;
}

interface FakeAdapterOptions {
  readonly initial?: PersistedAppState | null;
  readonly failWriteWith?: PersistenceResult<void>;
  readonly failReadWith?: PersistenceResult<PersistedAppState | null>;
}

function createFakeAdapter(
  options: FakeAdapterOptions = {}
): VersionedStorageAdapter<PersistedAppState> & {
  stored: PersistedAppState | null;
} {
  const adapter = {
    key: 'fake',
    stored: options.initial ?? null,
    read(): PersistenceResult<PersistedAppState | null> {
      return options.failReadWith ?? ok(adapter.stored);
    },
    write(value: PersistedAppState): PersistenceResult<void> {
      if (options.failWriteWith) return options.failWriteWith;
      adapter.stored = value;
      return ok(undefined);
    },
    clear(): PersistenceResult<void> {
      adapter.stored = null;
      return ok(undefined);
    },
  };
  return adapter;
}

function fixedClock(iso = '2026-07-28T15:00:00.000Z') {
  return () => new Date(iso);
}

function loadService(options: FakeAdapterOptions = {}, iso?: string) {
  const adapter = createFakeAdapter(options);
  const loaded = SavedDesignService.load(adapter, { now: fixedClock(iso) });
  if (!loaded.ok) throw new Error('expected service to load');
  return { service: loaded.value, adapter };
}

function saveNamed(service: SavedDesignService, name: string): DesignDocument {
  const result = service.save({
    name,
    document: createDraftDocument('draft', draftContent(), { now: fixedClock() }),
  });
  if (!result.ok) throw new Error(`expected save to succeed: ${result.error.kind}`);
  return result.value;
}

describe('SavedDesignService.load', () => {
  it('starts from empty state when nothing is stored', () => {
    const { service } = loadService();
    expect(service.getState()).toEqual(EMPTY_PERSISTED_APP_STATE);
    expect(service.listSavedDesigns()).toEqual([]);
  });

  it('propagates a read failure as an explicit error', () => {
    const adapter = createFakeAdapter({ failReadWith: err('corrupt', 'broken') });
    const loaded = SavedDesignService.load(adapter);
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.error.kind).toBe('corrupt');
  });

  it('recovers a stored active draft on load', () => {
    const draft = createDraftDocument('recovered', draftContent(), { now: fixedClock() });
    const stored: PersistedAppState = { ...EMPTY_PERSISTED_APP_STATE, activeDraft: draft };
    const { service } = loadService({ initial: stored });
    expect(service.getActiveDraft()?.metadata.id).toBe('recovered');
  });
});

describe('SavedDesignService.save', () => {
  it('saves a new design with a stable kebab-case id and persists it', () => {
    const { service, adapter } = loadService();
    const design = saveNamed(service, 'July Garage');

    expect(design.metadata.id).toBe('july-garage');
    expect(design.metadata.createdAt).toBe('2026-07-28T15:00:00.000Z');
    expect(adapter.stored?.savedDesignsById['july-garage']?.metadata.name).toBe('July Garage');
    expect(service.getActiveDraft()?.metadata.id).toBe('july-garage');
  });

  it('rejects a blank name', () => {
    const { service } = loadService();
    const result = service.save({
      name: '   ',
      document: createDraftDocument('draft', draftContent()),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid-input');
  });

  it('rejects a case-insensitive duplicate name', () => {
    const { service } = loadService();
    saveNamed(service, 'July Garage');
    const result = service.save({
      name: 'july garage',
      document: createDraftDocument('draft', draftContent()),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('duplicate-name');
  });

  it('assigns suffixed ids when slugs collide', () => {
    const { service } = loadService();
    const first = saveNamed(service, 'Garage!');
    const second = saveNamed(service, 'Garage?');
    expect(first.metadata.id).toBe('garage');
    expect(second.metadata.id).toBe('garage-2');
  });

  it('updates an existing design in place when the document id already exists', () => {
    const { service } = loadService();
    const created = saveNamed(service, 'July Garage');

    const updated = service.save({
      name: 'July Garage',
      document: { ...created, garage: { widthInches: 300, lengthInches: 300 } },
    });

    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.value.metadata.id).toBe('july-garage');
      expect(updated.value.garage.widthInches).toBe(300);
    }
    expect(Object.keys(service.getState().savedDesignsById)).toHaveLength(1);
  });

  it('leaves in-memory state untouched when the write fails', () => {
    const { service } = loadService({ failWriteWith: err('quota-exceeded', 'full') });
    const result = service.save({
      name: 'July Garage',
      document: createDraftDocument('draft', draftContent()),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('quota-exceeded');
    expect(service.listSavedDesigns()).toEqual([]);
  });

  it('handles design names that collide with Object.prototype members', () => {
    const { service } = loadService();

    const saved = service.save({
      name: 'Constructor',
      document: createDraftDocument('draft', draftContent(), { now: fixedClock() }),
    });
    expect(saved.ok).toBe(true);
    if (saved.ok) expect(saved.value.metadata.id).toBe('constructor');

    // A second save must see the existing "constructor" entry, not Object itself.
    const again = service.save({
      name: 'toString',
      document: createDraftDocument('draft', draftContent(), { now: fixedClock() }),
    });
    expect(again.ok).toBe(true);

    expect(service.reopen('constructor').ok).toBe(true);
    const deleted = service.delete('constructor');
    expect(deleted.ok).toBe(true);
    expect(service.listSavedDesigns().map((d) => d.metadata.id)).toEqual(['tostring']);
  });
});

describe('SavedDesignService mutations', () => {
  it('renames a design and rejects collisions and unknown ids', () => {
    const { service } = loadService();
    saveNamed(service, 'Garage A');
    saveNamed(service, 'Garage B');

    const collision = service.rename('garage-a', 'Garage B');
    expect(collision.ok).toBe(false);
    if (!collision.ok) expect(collision.error.kind).toBe('duplicate-name');

    const missing = service.rename('nope', 'New');
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.kind).toBe('not-found');

    const renamed = service.rename('garage-a', 'Garage C');
    expect(renamed.ok).toBe(true);
    if (renamed.ok) expect(renamed.value.metadata.name).toBe('Garage C');
  });

  it('preserves active-draft edits when renaming the open design', () => {
    const { service } = loadService();
    const saved = saveNamed(service, 'Garage');

    // Simulate autosaved draft edits that are newer than the saved copy.
    const editedDraft = { ...saved, garage: { widthInches: 400, lengthInches: 400 } };
    service.setActiveDraft(editedDraft);

    const renamed = service.rename('garage', 'Renamed Garage');
    expect(renamed.ok).toBe(true);

    const active = service.getActiveDraft();
    expect(active?.metadata.name).toBe('Renamed Garage');
    expect(active?.garage.widthInches).toBe(400);
  });

  it('duplicates a design with a new id and unique name', () => {
    const { service } = loadService();
    saveNamed(service, 'Garage');

    const copy = service.duplicate('garage');
    expect(copy.ok).toBe(true);
    if (copy.ok) {
      expect(copy.value.metadata.id).not.toBe('garage');
      expect(copy.value.metadata.name).toBe('Garage (copy)');
    }

    const secondCopy = service.duplicate('garage');
    expect(secondCopy.ok).toBe(true);
    if (secondCopy.ok) expect(secondCopy.value.metadata.name).toBe('Garage (copy) 2');
  });

  it('reopens a saved design into the active draft without mutating it', () => {
    const { service } = loadService();
    saveNamed(service, 'Garage');
    service.setActiveDraft(null);

    const reopened = service.reopen('garage');
    expect(reopened.ok).toBe(true);
    expect(service.getActiveDraft()?.metadata.id).toBe('garage');
  });

  it('deletes a design and clears the active draft that referenced it', () => {
    const { service } = loadService();
    saveNamed(service, 'Garage');

    const deleted = service.delete('garage');
    expect(deleted.ok).toBe(true);
    expect(service.listSavedDesigns()).toEqual([]);
    expect(service.getActiveDraft()).toBeNull();

    const missing = service.delete('garage');
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.kind).toBe('not-found');
  });
});

describe('SavedDesignService settings and overrides', () => {
  it('validates the waste allowance range', () => {
    const { service } = loadService();
    const invalid = service.updateSettings({ wasteAllowancePercent: 250 });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.error.kind).toBe('invalid-input');

    const valid = service.updateSettings({ wasteAllowancePercent: 12 });
    expect(valid.ok).toBe(true);
    expect(service.getState().settings.wasteAllowancePercent).toBe(12);
  });

  it('adds, validates, and removes catalog price overrides', () => {
    const { service } = loadService();
    const override = {
      priceId: 'swisstrax-ribtrax-pro-graphite-pack',
      priceCents: 4699,
      saleUnit: 'pack' as const,
      packQuantity: 6,
      sourceUrl: 'https://example.com/ribtrax-pro',
      checkedDate: '2026-07-28',
    };

    expect(service.setPriceOverride(override).ok).toBe(true);
    expect(
      service.getState().catalogOverrides.priceOverridesById[override.priceId]?.priceCents
    ).toBe(4699);

    const invalid = service.setPriceOverride({ ...override, priceCents: -5 });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.error.kind).toBe('invalid-input');

    expect(service.removePriceOverride(override.priceId).ok).toBe(true);
    const missing = service.removePriceOverride(override.priceId);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.kind).toBe('not-found');
  });
});

describe('listSavedDesigns ordering', () => {
  it('orders by most recently updated with a stable id tie-breaker', () => {
    const older = createDraftDocument('alpha', draftContent(), {
      now: fixedClock('2026-07-27T10:00:00.000Z'),
    });
    const newerA = createDraftDocument('beta', draftContent(), {
      now: fixedClock('2026-07-28T10:00:00.000Z'),
    });
    const newerB = createDraftDocument('gamma', draftContent(), {
      now: fixedClock('2026-07-28T10:00:00.000Z'),
    });

    const state: PersistedAppState = {
      ...EMPTY_PERSISTED_APP_STATE,
      savedDesignsById: { alpha: older, gamma: newerB, beta: newerA },
    };

    expect(listSavedDesigns(state).map((design) => design.metadata.id)).toEqual([
      'beta',
      'gamma',
      'alpha',
    ]);
  });
});
