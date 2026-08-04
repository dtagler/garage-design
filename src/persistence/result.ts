/**
 * Explicit, user-facing result and error types for local persistence.
 *
 * Persistence never falls back silently. Every operation returns a discriminated
 * {@link PersistenceResult} so callers (hooks, UI) can surface an actionable
 * message instead of pretending a write or read succeeded.
 */

export type PersistenceErrorKind =
  | 'unavailable'
  | 'quota-exceeded'
  | 'corrupt'
  | 'unsupported-version'
  | 'not-found'
  | 'duplicate-name'
  | 'invalid-input'
  | 'write-failed';

export interface PersistenceError {
  readonly kind: PersistenceErrorKind;
  /** Short message safe to show directly to a user. */
  readonly message: string;
  /** Original thrown value, retained for logging and debugging. */
  readonly cause?: unknown;
}

export type PersistenceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: PersistenceError };

export function ok<T>(value: T): PersistenceResult<T> {
  return { ok: true, value };
}

export function err<T = never>(
  kind: PersistenceErrorKind,
  message: string,
  cause?: unknown
): PersistenceResult<T> {
  return { ok: false, error: { kind, message, ...(cause === undefined ? {} : { cause }) } };
}

export function isOk<T>(
  result: PersistenceResult<T>
): result is { readonly ok: true; readonly value: T } {
  return result.ok;
}
