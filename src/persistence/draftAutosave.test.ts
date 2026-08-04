import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesignDocument } from '../domain/persistence';
import { createDraftAutosaver } from './draftAutosave';
import { err, ok, type PersistenceError, type PersistenceResult } from './result';

function draft(id: string): DesignDocument {
  return {
    metadata: {
      id,
      name: id,
      createdAt: '2026-07-28T15:00:00.000Z',
      updatedAt: '2026-07-28T15:00:00.000Z',
    },
    garage: { widthInches: 230, lengthInches: 246 },
    layout: { cellSizeInches: 12, cellsById: {}, selectedProduct: null },
  };
}

describe('createDraftAutosaver', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces rapid schedules into a single write with the latest draft', () => {
    const writes: (DesignDocument | null)[] = [];
    const autosaver = createDraftAutosaver(
      (value) => {
        writes.push(value);
        return ok(undefined);
      },
      { delayMs: 500 }
    );

    autosaver.schedule(draft('a'));
    vi.advanceTimersByTime(300);
    autosaver.schedule(draft('b'));
    expect(autosaver.pending).toBe(true);
    expect(writes).toHaveLength(0);

    vi.advanceTimersByTime(500);

    expect(writes).toEqual([draft('b')]);
    expect(autosaver.pending).toBe(false);
  });

  it('flush writes the pending draft immediately and cancels the timer', () => {
    const writes: (DesignDocument | null)[] = [];
    const onSaved = vi.fn();
    const autosaver = createDraftAutosaver(
      (value) => {
        writes.push(value);
        return ok(undefined);
      },
      { delayMs: 500, onSaved }
    );

    autosaver.schedule(draft('a'));
    const result = autosaver.flush();

    expect(result).toEqual({ ok: true, value: undefined });
    expect(writes).toEqual([draft('a')]);
    expect(onSaved).toHaveBeenCalledWith(draft('a'));

    vi.advanceTimersByTime(1000);
    expect(writes).toHaveLength(1);
  });

  it('flush returns null when nothing is pending', () => {
    const write = vi.fn((): PersistenceResult<void> => ok(undefined));
    const autosaver = createDraftAutosaver(write);
    expect(autosaver.flush()).toBeNull();
    expect(write).not.toHaveBeenCalled();
  });

  it('cancel discards the pending draft without writing', () => {
    const write = vi.fn((): PersistenceResult<void> => ok(undefined));
    const autosaver = createDraftAutosaver(write, { delayMs: 500 });

    autosaver.schedule(draft('a'));
    autosaver.cancel();
    expect(autosaver.pending).toBe(false);

    vi.advanceTimersByTime(1000);
    expect(write).not.toHaveBeenCalled();
    expect(autosaver.flush()).toBeNull();
  });

  it('reports write failures through onError', () => {
    const onError = vi.fn<(error: PersistenceError) => void>();
    const autosaver = createDraftAutosaver(() => err('quota-exceeded', 'full'), {
      delayMs: 500,
      onError,
    });

    autosaver.schedule(draft('a'));
    vi.advanceTimersByTime(500);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].kind).toBe('quota-exceeded');
  });
});
