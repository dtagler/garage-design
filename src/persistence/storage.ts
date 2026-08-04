/**
 * Versioned browser localStorage adapters.
 *
 * A {@link VersionedStorageAdapter} wraps a `Storage`-like backend and translates
 * every failure mode (missing API, `SecurityError`, `QuotaExceededError`, malformed
 * JSON, and unsupported schema versions) into an explicit {@link PersistenceResult}.
 * The schema version lives inside the serialized payload itself, so a `parse`
 * function is responsible for validating and migrating older envelopes.
 */

import { DomainValidationError } from '../domain/catalog';
import {
  PERSISTED_APP_STATE_SCHEMA_VERSION,
  PersistenceVersionError,
  parsePersistedAppState,
  type PersistedAppState,
} from '../domain/persistence';
import { err, ok, type PersistenceResult } from './result';

/** Minimal subset of the Web Storage API this module relies on. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface VersionedStorageAdapter<T> {
  /** The storage key this adapter reads and writes. */
  readonly key: string;
  /** Reads and validates the payload. Returns `null` when nothing is stored. */
  read(): PersistenceResult<T | null>;
  /** Serializes and writes the payload. */
  write(value: T): PersistenceResult<void>;
  /** Removes the payload. Absence is treated as success. */
  clear(): PersistenceResult<void>;
}

export interface VersionedStorageOptions<T> {
  readonly key: string;
  /** Backend to use, or `null` when storage is unavailable. */
  readonly storage: StorageLike | null;
  /**
   * Validates and (if needed) migrates a parsed JSON value into `T`. Should throw
   * {@link PersistenceVersionError} for unsupported versions and any other error
   * for structurally invalid data.
   */
  readonly parse: (raw: unknown) => T;
}

const PROBE_KEY = '__garage-floor-design_probe__';

/**
 * Resolves the ambient `localStorage`, returning `null` when it is missing or
 * blocked (for example, private browsing or a sandboxed document that raises a
 * `SecurityError` on access). A write probe guards against backends that exist
 * but reject every operation. A quota failure during the probe is deliberately
 * treated as "usable": the backend can still be read, and the write path
 * classifies quota errors explicitly so callers can react (for example, delete a
 * design to free space) instead of being told storage is unavailable.
 */
export function resolveLocalStorage(): StorageLike | null {
  let candidate: StorageLike | null | undefined;
  try {
    candidate = (globalThis as { localStorage?: StorageLike | null }).localStorage;
    if (!candidate) {
      return null;
    }

    candidate.setItem(PROBE_KEY, '1');
    candidate.removeItem(PROBE_KEY);
    return candidate;
  } catch (error) {
    if (candidate && isQuotaExceededError(error)) {
      return candidate;
    }
    return null;
  }
}

export function createVersionedStorage<T>(
  options: VersionedStorageOptions<T>
): VersionedStorageAdapter<T> {
  const { key, storage, parse } = options;

  return {
    key,

    read(): PersistenceResult<T | null> {
      if (!storage) {
        return err('unavailable', 'Browser storage is unavailable, so saved data cannot be read.');
      }

      let raw: string | null;
      try {
        raw = storage.getItem(key);
      } catch (cause) {
        return err('unavailable', 'Browser storage could not be accessed.', cause);
      }

      if (raw === null) {
        return ok(null);
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(raw);
      } catch (cause) {
        return err('corrupt', 'Saved data is corrupted and could not be read.', cause);
      }

      try {
        return ok(parse(parsedJson));
      } catch (cause) {
        if (cause instanceof PersistenceVersionError) {
          return err(
            'unsupported-version',
            'Saved data was created by a different, unsupported version of this app.',
            cause
          );
        }

        if (cause instanceof DomainValidationError) {
          return err('corrupt', 'Saved data is invalid and could not be read.', cause);
        }

        return err('corrupt', 'Saved data could not be read.', cause);
      }
    },

    write(value: T): PersistenceResult<void> {
      if (!storage) {
        return err('unavailable', 'Browser storage is unavailable, so changes cannot be saved.');
      }

      let serialized: string | undefined;
      try {
        serialized = JSON.stringify(value);
      } catch (cause) {
        return err('write-failed', 'Data could not be prepared for saving.', cause);
      }

      // `JSON.stringify` returns `undefined` (not a string) for values it cannot
      // represent, which would otherwise be stored as the literal "undefined".
      if (typeof serialized !== 'string') {
        return err('write-failed', 'Data could not be prepared for saving.');
      }

      try {
        storage.setItem(key, serialized);
        return ok(undefined);
      } catch (cause) {
        if (isQuotaExceededError(cause)) {
          return err(
            'quota-exceeded',
            'Browser storage is full. Delete a saved design and try again.',
            cause
          );
        }

        if (isSecurityError(cause)) {
          return err(
            'unavailable',
            'Browser storage is blocked, so changes cannot be saved.',
            cause
          );
        }

        return err('write-failed', 'Changes could not be saved.', cause);
      }
    },

    clear(): PersistenceResult<void> {
      if (!storage) {
        return err('unavailable', 'Browser storage is unavailable.');
      }

      try {
        storage.removeItem(key);
        return ok(undefined);
      } catch (cause) {
        if (isSecurityError(cause)) {
          return err('unavailable', 'Browser storage is blocked.', cause);
        }
        return err('write-failed', 'Saved data could not be cleared.', cause);
      }
    },
  };
}

/** Storage key for the full persisted application state envelope. */
export const PERSISTED_APP_STATE_STORAGE_KEY = 'garage-floor-design/app-state';

/**
 * Builds the versioned adapter for the whole application state. `parsePersistedAppState`
 * validates the current schema and transparently migrates older (v0) envelopes.
 */
export function createAppStateStorage(
  storage: StorageLike | null = resolveLocalStorage()
): VersionedStorageAdapter<PersistedAppState> {
  return createVersionedStorage<PersistedAppState>({
    key: PERSISTED_APP_STATE_STORAGE_KEY,
    storage,
    parse: parsePersistedAppState,
  });
}

export { PERSISTED_APP_STATE_SCHEMA_VERSION };

function errorName(value: unknown): string {
  if (value && typeof value === 'object' && 'name' in value) {
    return String(value.name);
  }
  return '';
}

function errorCode(value: unknown): number | undefined {
  if (value && typeof value === 'object' && 'code' in value) {
    const { code } = value;
    return typeof code === 'number' ? code : undefined;
  }
  return undefined;
}

/** Detects a quota failure across browsers, including the legacy Firefox variant. */
function isQuotaExceededError(value: unknown): boolean {
  const name = errorName(value);
  const code = errorCode(value);
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    code === 22 ||
    code === 1014
  );
}

/** Detects storage access blocked by document security policy. */
function isSecurityError(value: unknown): boolean {
  return errorName(value) === 'SecurityError' || errorCode(value) === 18;
}
