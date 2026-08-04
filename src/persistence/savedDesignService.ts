/**
 * Saved-design service built on the persistence domain models.
 *
 * The pure functions in this module transform an immutable {@link PersistedAppState}
 * and return an explicit {@link PersistenceResult}. The {@link SavedDesignService}
 * wraps them with a {@link VersionedStorageAdapter}: it loads once, keeps the state
 * in memory, and persists after every successful mutation. When a write fails
 * (for example a quota error) the in-memory state is left untouched so it always
 * matches what is on disk.
 */

import { parseEditablePriceOverride, type EditablePriceOverride } from '../domain/catalog';
import {
  DEFAULT_APPLICATION_SETTINGS,
  DEFAULT_CATALOG_OVERRIDES,
  PERSISTED_APP_STATE_SCHEMA_VERSION,
  type ApplicationSettings,
  type DesignDocument,
  type DesignId,
  type FloorLayout,
  type GarageDimensions,
  type PersistedAppState,
  type ReferenceRoleColors,
  type ReferenceTemplateId,
} from '../domain/persistence';
import { normalizeName, uniqueDesignId, uniqueName } from './ids';
import { err, ok, type PersistenceResult } from './result';
import type { VersionedStorageAdapter } from './storage';

/** Empty, valid state used when nothing has been persisted yet. */
export const EMPTY_PERSISTED_APP_STATE: PersistedAppState = {
  schemaVersion: PERSISTED_APP_STATE_SCHEMA_VERSION,
  settings: DEFAULT_APPLICATION_SETTINGS,
  activeDraft: null,
  savedDesignsById: emptyMap(),
  catalogOverrides: DEFAULT_CATALOG_OVERRIDES,
};

/**
 * Design ids and price ids are arbitrary user-derived strings, so id-keyed maps
 * must not inherit from `Object.prototype`; otherwise keys like `"constructor"`
 * or `"toString"` would collide with prototype members (a truthy lookup for a
 * missing key, or a `delete` that silently does nothing). The domain parsers
 * already build these maps with a null prototype; these helpers keep every map
 * this module constructs consistent, and all membership checks use
 * `Object.hasOwn`.
 */
function emptyMap<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>;
}

function getOwn<T>(map: Record<string, T>, key: string): T | undefined {
  return Object.hasOwn(map, key) ? map[key] : undefined;
}

function mapWith<T>(map: Record<string, T>, key: string, value: T): Record<string, T> {
  const next = Object.assign(emptyMap<T>(), map);
  next[key] = value;
  return next;
}

function mapWithout<T>(map: Record<string, T>, key: string): Record<string, T> {
  const next = Object.assign(emptyMap<T>(), map);
  delete next[key];
  return next;
}

/** Injectable clock so timestamps are deterministic in tests. */
export type Clock = () => Date;

const defaultClock: Clock = () => new Date();

/** Editable content of a design, without the persistence-managed metadata. */
export interface DraftContent {
  readonly garage: GarageDimensions;
  readonly layout: FloorLayout;
  readonly referenceTemplateId?: ReferenceTemplateId;
  readonly referenceRoleColors?: ReferenceRoleColors;
}

export interface SaveDesignInput {
  readonly name: string;
  readonly document: DesignDocument;
}

interface TransformOptions {
  readonly now: Clock;
}

function withReferenceDesign(
  referenceTemplateId: ReferenceTemplateId | undefined,
  referenceRoleColors: ReferenceRoleColors | undefined
): {
  referenceTemplateId?: ReferenceTemplateId;
  referenceRoleColors?: ReferenceRoleColors;
} {
  return referenceTemplateId === undefined
    ? {}
    : {
        referenceTemplateId,
        ...(referenceRoleColors === undefined ? {} : { referenceRoleColors }),
      };
}

/**
 * Builds a fresh {@link DesignDocument} for a new draft. Callers own the id so
 * that a draft can be reproducibly recreated; timestamps come from the clock.
 */
export function createDraftDocument(
  id: DesignId,
  content: DraftContent,
  options: { readonly name?: string; readonly now?: Clock } = {}
): DesignDocument {
  const timestamp = (options.now ?? defaultClock)().toISOString();
  return {
    metadata: {
      id,
      name: options.name ?? 'Untitled design',
      createdAt: timestamp,
      updatedAt: timestamp,
      ...withReferenceDesign(content.referenceTemplateId, content.referenceRoleColors),
    },
    garage: content.garage,
    layout: content.layout,
  };
}

/**
 * Returns saved designs in deterministic order: most recently updated first,
 * with the stable id as a tie-breaker so equal timestamps never reorder.
 */
export function listSavedDesigns(state: PersistedAppState): readonly DesignDocument[] {
  return Object.values(state.savedDesignsById).sort((a, b) => {
    if (a.metadata.updatedAt !== b.metadata.updatedAt) {
      return a.metadata.updatedAt < b.metadata.updatedAt ? 1 : -1;
    }
    return a.metadata.id < b.metadata.id ? -1 : 1;
  });
}

function findDuplicateName(
  state: PersistedAppState,
  name: string,
  exceptId: DesignId | null
): boolean {
  const normalized = normalizeName(name);
  return Object.values(state.savedDesignsById).some(
    (design) =>
      design.metadata.id !== exceptId && normalizeName(design.metadata.name) === normalized
  );
}

function replaceSavedDesign(state: PersistedAppState, design: DesignDocument): PersistedAppState {
  return {
    ...state,
    savedDesignsById: mapWith(state.savedDesignsById, design.metadata.id, design),
  };
}

export interface SaveDesignOutcome {
  readonly state: PersistedAppState;
  readonly design: DesignDocument;
}

/**
 * Saves the supplied document under `name`. When the document's id already exists
 * it updates that design in place (preserving `createdAt`); otherwise it creates a
 * new saved design with a fresh stable id. On success the saved document becomes
 * the active draft. Rejects blank names and case-insensitive name collisions.
 */
export function saveDesign(
  state: PersistedAppState,
  input: SaveDesignInput,
  options: TransformOptions = { now: defaultClock }
): PersistenceResult<SaveDesignOutcome> {
  const name = input.name.trim();
  if (name.length === 0) {
    return err('invalid-input', 'A design name is required.');
  }

  const existing = getOwn(state.savedDesignsById, input.document.metadata.id);
  const existingId = existing?.metadata.id ?? null;

  if (findDuplicateName(state, name, existingId)) {
    return err('duplicate-name', `A design named "${name}" already exists.`);
  }

  const timestamp = options.now().toISOString();
  let design: DesignDocument;

  if (existing) {
    design = {
      metadata: {
        id: existing.metadata.id,
        name,
        createdAt: existing.metadata.createdAt,
        updatedAt: timestamp,
        ...withReferenceDesign(
          input.document.metadata.referenceTemplateId,
          input.document.metadata.referenceRoleColors
        ),
      },
      garage: input.document.garage,
      layout: input.document.layout,
    };
  } else {
    const id = uniqueDesignId(name, new Set(Object.keys(state.savedDesignsById)));
    design = {
      metadata: {
        id,
        name,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...withReferenceDesign(
          input.document.metadata.referenceTemplateId,
          input.document.metadata.referenceRoleColors
        ),
      },
      garage: input.document.garage,
      layout: input.document.layout,
    };
  }

  const nextState = { ...replaceSavedDesign(state, design), activeDraft: design };
  return ok({ state: nextState, design });
}

/** Renames a saved design. Rejects unknown ids, blank names, and name collisions. */
export function renameDesign(
  state: PersistedAppState,
  id: DesignId,
  name: string,
  options: TransformOptions = { now: defaultClock }
): PersistenceResult<SaveDesignOutcome> {
  const existing = getOwn(state.savedDesignsById, id);
  if (!existing) {
    return err('not-found', 'That design no longer exists.');
  }

  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return err('invalid-input', 'A design name is required.');
  }

  if (findDuplicateName(state, trimmed, id)) {
    return err('duplicate-name', `A design named "${trimmed}" already exists.`);
  }

  const updatedAt = options.now().toISOString();
  const design: DesignDocument = {
    ...existing,
    metadata: { ...existing.metadata, name: trimmed, updatedAt },
  };

  let nextState = replaceSavedDesign(state, design);
  // Rename only touches the name: preserve any newer active-draft content instead
  // of overwriting it with the (possibly stale) saved copy.
  if (state.activeDraft && state.activeDraft.metadata.id === id) {
    nextState = {
      ...nextState,
      activeDraft: {
        ...state.activeDraft,
        metadata: { ...state.activeDraft.metadata, name: trimmed, updatedAt },
      },
    };
  }
  return ok({ state: nextState, design });
}

/**
 * Duplicates a saved design under a new stable id and a unique "(copy)" name.
 * The copy's timestamps are set to now.
 */
export function duplicateDesign(
  state: PersistedAppState,
  id: DesignId,
  options: TransformOptions = { now: defaultClock }
): PersistenceResult<SaveDesignOutcome> {
  const existing = getOwn(state.savedDesignsById, id);
  if (!existing) {
    return err('not-found', 'That design no longer exists.');
  }

  const takenNames = new Set(
    Object.values(state.savedDesignsById).map((design) => design.metadata.name)
  );
  const name = uniqueName(`${existing.metadata.name} (copy)`, takenNames);
  const newId = uniqueDesignId(name, new Set(Object.keys(state.savedDesignsById)));
  const timestamp = options.now().toISOString();

  const design: DesignDocument = {
    ...existing,
    metadata: {
      ...existing.metadata,
      id: newId,
      name,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  };

  return ok({ state: replaceSavedDesign(state, design), design });
}

/** Loads a saved design into the active draft without altering the saved copy. */
export function reopenDesign(
  state: PersistedAppState,
  id: DesignId
): PersistenceResult<SaveDesignOutcome> {
  const existing = getOwn(state.savedDesignsById, id);
  if (!existing) {
    return err('not-found', 'That design no longer exists.');
  }

  return ok({ state: { ...state, activeDraft: existing }, design: existing });
}

/** Deletes a saved design, clearing the active draft if it referenced that design. */
export function deleteDesign(
  state: PersistedAppState,
  id: DesignId
): PersistenceResult<PersistedAppState> {
  if (!getOwn(state.savedDesignsById, id)) {
    return err('not-found', 'That design no longer exists.');
  }

  const savedDesignsById = mapWithout(state.savedDesignsById, id);
  const activeDraft = state.activeDraft?.metadata.id === id ? null : state.activeDraft;
  return ok({ ...state, savedDesignsById, activeDraft });
}

/** Replaces the active draft (used by autosave and when starting a new design). */
export function setActiveDraft(
  state: PersistedAppState,
  draft: DesignDocument | null
): PersistedAppState {
  return { ...state, activeDraft: draft };
}

/** Updates application settings, validating the waste allowance range. */
export function updateSettings(
  state: PersistedAppState,
  settings: ApplicationSettings
): PersistenceResult<PersistedAppState> {
  const { wasteAllowancePercent } = settings;
  if (
    typeof wasteAllowancePercent !== 'number' ||
    !Number.isFinite(wasteAllowancePercent) ||
    wasteAllowancePercent < 0 ||
    wasteAllowancePercent > 100
  ) {
    return err('invalid-input', 'Waste allowance must be between 0 and 100 percent.');
  }

  return ok({ ...state, settings: { wasteAllowancePercent } });
}

/** Adds or replaces a catalog price override, validating it against the domain rules. */
export function setPriceOverride(
  state: PersistedAppState,
  override: EditablePriceOverride
): PersistenceResult<PersistedAppState> {
  let parsed: EditablePriceOverride;
  try {
    parsed = parseEditablePriceOverride(override);
  } catch (cause) {
    return err('invalid-input', 'That price override is invalid.', cause);
  }

  return ok({
    ...state,
    catalogOverrides: {
      priceOverridesById: mapWith(
        state.catalogOverrides.priceOverridesById,
        parsed.priceId,
        parsed
      ),
    },
  });
}

/** Removes a catalog price override. Absence is treated as a not-found error. */
export function removePriceOverride(
  state: PersistedAppState,
  priceId: string
): PersistenceResult<PersistedAppState> {
  if (!getOwn(state.catalogOverrides.priceOverridesById, priceId)) {
    return err('not-found', 'That price override no longer exists.');
  }

  const priceOverridesById = mapWithout(state.catalogOverrides.priceOverridesById, priceId);
  return ok({ ...state, catalogOverrides: { priceOverridesById } });
}

export interface SavedDesignServiceOptions {
  readonly now?: Clock;
}

/**
 * Stateful facade over the pure transforms and a storage adapter. It loads the
 * persisted state once, mutates an in-memory copy, and writes through on success.
 */
export class SavedDesignService {
  private readonly adapter: VersionedStorageAdapter<PersistedAppState>;
  private readonly now: Clock;
  private state: PersistedAppState;

  private constructor(
    adapter: VersionedStorageAdapter<PersistedAppState>,
    initialState: PersistedAppState,
    now: Clock
  ) {
    this.adapter = adapter;
    this.now = now;
    this.state = initialState;
  }

  /** Reads persisted state (or the empty default) and builds a service instance. */
  static load(
    adapter: VersionedStorageAdapter<PersistedAppState>,
    options: SavedDesignServiceOptions = {}
  ): PersistenceResult<SavedDesignService> {
    const read = adapter.read();
    if (!read.ok) {
      return read;
    }

    const state = read.value ?? EMPTY_PERSISTED_APP_STATE;
    return ok(new SavedDesignService(adapter, state, options.now ?? defaultClock));
  }

  getState(): PersistedAppState {
    return this.state;
  }

  listSavedDesigns(): readonly DesignDocument[] {
    return listSavedDesigns(this.state);
  }

  getActiveDraft(): DesignDocument | null {
    return this.state.activeDraft;
  }

  save(input: SaveDesignInput): PersistenceResult<DesignDocument> {
    return this.applyOutcome(saveDesign(this.state, input, { now: this.now }));
  }

  rename(id: DesignId, name: string): PersistenceResult<DesignDocument> {
    return this.applyOutcome(renameDesign(this.state, id, name, { now: this.now }));
  }

  duplicate(id: DesignId): PersistenceResult<DesignDocument> {
    return this.applyOutcome(duplicateDesign(this.state, id, { now: this.now }));
  }

  reopen(id: DesignId): PersistenceResult<DesignDocument> {
    return this.applyOutcome(reopenDesign(this.state, id));
  }

  delete(id: DesignId): PersistenceResult<void> {
    return this.applyState(deleteDesign(this.state, id));
  }

  setActiveDraft(draft: DesignDocument | null): PersistenceResult<void> {
    return this.commit(setActiveDraft(this.state, draft));
  }

  updateSettings(settings: ApplicationSettings): PersistenceResult<void> {
    return this.applyState(updateSettings(this.state, settings));
  }

  setPriceOverride(override: EditablePriceOverride): PersistenceResult<void> {
    return this.applyState(setPriceOverride(this.state, override));
  }

  removePriceOverride(priceId: string): PersistenceResult<void> {
    return this.applyState(removePriceOverride(this.state, priceId));
  }

  private applyOutcome(
    result: PersistenceResult<SaveDesignOutcome>
  ): PersistenceResult<DesignDocument> {
    if (!result.ok) {
      return result;
    }
    const write = this.commit(result.value.state);
    return write.ok ? ok(result.value.design) : write;
  }

  private applyState(result: PersistenceResult<PersistedAppState>): PersistenceResult<void> {
    if (!result.ok) {
      return result;
    }
    return this.commit(result.value);
  }

  private commit(nextState: PersistedAppState): PersistenceResult<void> {
    const write = this.adapter.write(nextState);
    if (!write.ok) {
      return write;
    }
    this.state = nextState;
    return ok(undefined);
  }
}
