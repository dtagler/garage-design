/**
 * React hooks that expose the saved-design service and draft autosave to the UI
 * without requiring changes to the application shell.
 *
 * {@link usePersistedDesigns} owns a {@link SavedDesignService} instance, mirrors
 * its state into React state, and reports the last user-facing error. It never
 * throws for expected persistence failures: callers read `loadError`/`lastError`.
 * {@link useActiveDraftAutosave} wires a {@link DraftAutosaver} to the service and
 * flushes any pending draft when the component unmounts.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EditablePriceOverride } from '../domain/catalog';
import type {
  ApplicationSettings,
  DesignDocument,
  DesignId,
  PersistedAppState,
} from '../domain/persistence';
import {
  createDraftAutosaver,
  type DraftAutosaver,
  type DraftAutosaverOptions,
} from './draftAutosave';
import { err, type PersistenceError, type PersistenceResult } from './result';
import {
  listSavedDesigns,
  SavedDesignService,
  type Clock,
  type SaveDesignInput,
} from './savedDesignService';
import { createAppStateStorage, type StorageLike, type VersionedStorageAdapter } from './storage';

export interface UsePersistedDesignsOptions {
  /** Adapter override (mainly for tests). Defaults to the localStorage adapter. */
  readonly adapter?: VersionedStorageAdapter<PersistedAppState>;
  /** Storage backend used to build the default adapter when `adapter` is omitted. */
  readonly storage?: StorageLike | null;
  /** Clock override for deterministic timestamps in tests. */
  readonly now?: Clock;
}

export interface UsePersistedDesignsResult {
  /** True once the service loaded successfully and is ready for mutations. */
  readonly ready: boolean;
  /** Error captured while loading persisted state, if any. */
  readonly loadError: PersistenceError | null;
  /** Most recent error from a mutation, or `null` after a successful one. */
  readonly lastError: PersistenceError | null;
  readonly state: PersistedAppState | null;
  readonly savedDesigns: readonly DesignDocument[];
  readonly activeDraft: DesignDocument | null;
  readonly save: (input: SaveDesignInput) => PersistenceResult<DesignDocument>;
  readonly rename: (id: DesignId, name: string) => PersistenceResult<DesignDocument>;
  readonly duplicate: (id: DesignId) => PersistenceResult<DesignDocument>;
  readonly reopen: (id: DesignId) => PersistenceResult<DesignDocument>;
  readonly remove: (id: DesignId) => PersistenceResult<void>;
  readonly setActiveDraft: (draft: DesignDocument | null) => PersistenceResult<void>;
  readonly updateSettings: (settings: ApplicationSettings) => PersistenceResult<void>;
  readonly setPriceOverride: (override: EditablePriceOverride) => PersistenceResult<void>;
  readonly removePriceOverride: (priceId: string) => PersistenceResult<void>;
  /** Clears `lastError`. */
  readonly clearError: () => void;
  /** The underlying service, or `null` if loading failed. */
  readonly service: SavedDesignService | null;
}

const SERVICE_UNAVAILABLE: PersistenceError = {
  kind: 'unavailable',
  message: 'Saved designs are unavailable because storage could not be loaded.',
};

export function usePersistedDesigns(
  options: UsePersistedDesignsOptions = {}
): UsePersistedDesignsResult {
  const { adapter, storage, now } = options;

  const [load] = useState(() => {
    // `storage: null` is an explicit "unavailable" signal and must be forwarded
    // as-is; only an omitted option should fall back to the ambient localStorage.
    const resolved =
      adapter ?? (storage === undefined ? createAppStateStorage() : createAppStateStorage(storage));
    return SavedDesignService.load(resolved, now ? { now } : {});
  });

  const service = load.ok ? load.value : null;
  const loadError = load.ok ? null : load.error;

  const [state, setState] = useState<PersistedAppState | null>(
    load.ok ? load.value.getState() : null
  );
  const [lastError, setLastError] = useState<PersistenceError | null>(null);

  const run = useCallback(
    <T>(operation: (service: SavedDesignService) => PersistenceResult<T>): PersistenceResult<T> => {
      if (!service) {
        setLastError(SERVICE_UNAVAILABLE);
        return err<T>(SERVICE_UNAVAILABLE.kind, SERVICE_UNAVAILABLE.message);
      }

      const result = operation(service);
      if (result.ok) {
        setState(service.getState());
        setLastError(null);
      } else {
        setLastError(result.error);
      }
      return result;
    },
    [service]
  );

  const save = useCallback(
    (input: SaveDesignInput) => run((service) => service.save(input)),
    [run]
  );
  const rename = useCallback(
    (id: DesignId, name: string) => run((service) => service.rename(id, name)),
    [run]
  );
  const duplicate = useCallback((id: DesignId) => run((service) => service.duplicate(id)), [run]);
  const reopen = useCallback((id: DesignId) => run((service) => service.reopen(id)), [run]);
  const remove = useCallback((id: DesignId) => run((service) => service.delete(id)), [run]);
  const setActiveDraft = useCallback(
    (draft: DesignDocument | null) => run((service) => service.setActiveDraft(draft)),
    [run]
  );
  const updateSettings = useCallback(
    (settings: ApplicationSettings) => run((service) => service.updateSettings(settings)),
    [run]
  );
  const setPriceOverride = useCallback(
    (override: EditablePriceOverride) => run((service) => service.setPriceOverride(override)),
    [run]
  );
  const removePriceOverride = useCallback(
    (priceId: string) => run((service) => service.removePriceOverride(priceId)),
    [run]
  );
  const clearError = useCallback(() => setLastError(null), []);

  return {
    ready: service !== null,
    loadError,
    lastError,
    state,
    savedDesigns: state ? listSavedDesigns(state) : [],
    activeDraft: state?.activeDraft ?? null,
    save,
    rename,
    duplicate,
    reopen,
    remove,
    setActiveDraft,
    updateSettings,
    setPriceOverride,
    removePriceOverride,
    clearError,
    service,
  };
}

export interface UseActiveDraftAutosaveResult {
  readonly schedule: (draft: DesignDocument | null) => void;
  readonly flush: () => PersistenceResult<void> | null;
  readonly cancel: () => void;
}

/**
 * Wires a {@link DraftAutosaver} to a service (or any write callback). Rapid
 * `schedule` calls coalesce into a single debounced write; the pending draft is
 * flushed on unmount so nothing is lost.
 *
 * When integrating with {@link usePersistedDesigns}, prefer passing its
 * `setActiveDraft` action as the target so autosaves refresh React state. Passing
 * a raw {@link SavedDesignService} persists the draft but does not update the
 * hook's mirrored state.
 */
export function useActiveDraftAutosave(
  target: SavedDesignService | ((draft: DesignDocument | null) => PersistenceResult<void>) | null,
  options: DraftAutosaverOptions = {}
): UseActiveDraftAutosaveResult {
  const targetRef = useRef(target);
  const optionsRef = useRef(options);
  const autosaverRef = useRef<DraftAutosaver | null>(null);

  // Keep the latest target and options accessible to the (stable) autosaver
  // without recreating it. Syncing happens in an effect so nothing touches a ref
  // during render.
  useEffect(() => {
    targetRef.current = target;
    optionsRef.current = options;
  });

  // Create the autosaver once on mount and flush any pending draft on unmount.
  useEffect(() => {
    const autosaver = createDraftAutosaver(
      (draft): PersistenceResult<void> => {
        const current = targetRef.current;
        if (!current) {
          return err('unavailable', 'The active draft could not be saved.');
        }
        return typeof current === 'function' ? current(draft) : current.setActiveDraft(draft);
      },
      {
        delayMs: optionsRef.current.delayMs,
        setTimer: optionsRef.current.setTimer,
        clearTimer: optionsRef.current.clearTimer,
        onSaved: (draft) => optionsRef.current.onSaved?.(draft),
        onError: (error) => optionsRef.current.onError?.(error),
      }
    );
    autosaverRef.current = autosaver;

    return () => {
      autosaver.flush();
      autosaverRef.current = null;
    };
  }, []);

  const schedule = useCallback((draft: DesignDocument | null) => {
    autosaverRef.current?.schedule(draft);
  }, []);
  const flush = useCallback(() => autosaverRef.current?.flush() ?? null, []);
  const cancel = useCallback(() => {
    autosaverRef.current?.cancel();
  }, []);

  return { schedule, flush, cancel };
}
