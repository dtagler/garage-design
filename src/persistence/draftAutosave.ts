/**
 * Debounced active-draft autosave.
 *
 * The editor changes the active draft on every brush stroke, which is far too
 * frequent to persist directly. {@link createDraftAutosaver} coalesces rapid
 * `schedule` calls into a single debounced write, and exposes `flush` (persist the
 * pending draft immediately) and `cancel` (discard the pending draft without
 * writing). Failures are surfaced through `onError` so nothing is lost silently.
 */

import type { DesignDocument } from '../domain/persistence';
import type { PersistenceError, PersistenceResult } from './result';

type TimerHandle = ReturnType<typeof setTimeout>;

export interface DraftAutosaver {
  /** Records the latest draft and (re)starts the debounce timer. */
  schedule(draft: DesignDocument | null): void;
  /**
   * Writes the pending draft immediately, cancelling the debounce timer. Returns
   * the write result, or `null` when nothing was pending.
   */
  flush(): PersistenceResult<void> | null;
  /** Discards any pending draft and cancels the debounce timer without writing. */
  cancel(): void;
  /** Whether a scheduled write is currently pending. */
  readonly pending: boolean;
}

export interface DraftAutosaverOptions {
  /** Debounce window in milliseconds. Defaults to 500ms. */
  readonly delayMs?: number;
  /** Injectable timer, defaulting to the ambient `setTimeout`. */
  readonly setTimer?: (callback: () => void, ms: number) => TimerHandle;
  /** Injectable timer clear, defaulting to the ambient `clearTimeout`. */
  readonly clearTimer?: (handle: TimerHandle) => void;
  /** Invoked with the persisted draft after a successful write. */
  readonly onSaved?: (draft: DesignDocument | null) => void;
  /** Invoked with an explicit error when a write fails. */
  readonly onError?: (error: PersistenceError) => void;
}

const DEFAULT_DELAY_MS = 500;

export function createDraftAutosaver(
  write: (draft: DesignDocument | null) => PersistenceResult<void>,
  options: DraftAutosaverOptions = {}
): DraftAutosaver {
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
  const setTimer = options.setTimer ?? ((callback, ms) => globalThis.setTimeout(callback, ms));
  const clearTimer = options.clearTimer ?? ((handle) => globalThis.clearTimeout(handle));

  let handle: TimerHandle | null = null;
  let hasPending = false;
  let pendingDraft: DesignDocument | null = null;

  function clearTimerIfSet(): void {
    if (handle !== null) {
      clearTimer(handle);
      handle = null;
    }
  }

  function performWrite(): PersistenceResult<void> {
    clearTimerIfSet();
    const draft = pendingDraft;
    hasPending = false;
    pendingDraft = null;

    const result = write(draft);
    if (result.ok) {
      options.onSaved?.(draft);
    } else {
      options.onError?.(result.error);
    }
    return result;
  }

  return {
    schedule(draft: DesignDocument | null): void {
      pendingDraft = draft;
      hasPending = true;
      clearTimerIfSet();
      handle = setTimer(() => {
        handle = null;
        performWrite();
      }, delayMs);
    },

    flush(): PersistenceResult<void> | null {
      if (!hasPending) {
        return null;
      }
      return performWrite();
    },

    cancel(): void {
      clearTimerIfSet();
      hasPending = false;
      pendingDraft = null;
    },

    get pending(): boolean {
      return hasPending;
    },
  };
}
