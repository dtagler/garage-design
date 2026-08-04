import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PersistedAppState } from '../domain/persistence';
import { err, ok, type PersistenceResult } from './result';
import { createDraftDocument } from './savedDesignService';
import { usePersistedDesigns, useActiveDraftAutosave } from './hooks';
import type { VersionedStorageAdapter } from './storage';

function createFakeAdapter(
  failWriteWith?: PersistenceResult<void>
): VersionedStorageAdapter<PersistedAppState> {
  let stored: PersistedAppState | null = null;
  return {
    key: 'fake',
    read: () => ok(stored),
    write: (value) => {
      if (failWriteWith) return failWriteWith;
      stored = value;
      return ok(undefined);
    },
    clear: () => {
      stored = null;
      return ok(undefined);
    },
  };
}

const now = () => new Date('2026-07-28T15:00:00.000Z');

function content() {
  return {
    garage: { widthInches: 230, lengthInches: 246 },
    layout: { cellSizeInches: 12, cellsById: {}, selectedProduct: null },
  } as const;
}

describe('usePersistedDesigns', () => {
  it('saves a design and reflects it in state', () => {
    const adapter = createFakeAdapter();
    const { result } = renderHook(() => usePersistedDesigns({ adapter, now }));

    expect(result.current.ready).toBe(true);
    expect(result.current.savedDesigns).toEqual([]);

    act(() => {
      result.current.save({
        name: 'July Garage',
        document: createDraftDocument('draft', content(), { now }),
      });
    });

    expect(result.current.savedDesigns.map((design) => design.metadata.id)).toEqual([
      'july-garage',
    ]);
    expect(result.current.lastError).toBeNull();
  });

  it('surfaces duplicate-name errors without changing state', () => {
    const adapter = createFakeAdapter();
    const { result } = renderHook(() => usePersistedDesigns({ adapter, now }));

    act(() => {
      result.current.save({
        name: 'Garage',
        document: createDraftDocument('draft', content(), { now }),
      });
    });
    act(() => {
      result.current.save({
        name: 'garage',
        document: createDraftDocument('draft', content(), { now }),
      });
    });

    expect(result.current.lastError?.kind).toBe('duplicate-name');
    expect(result.current.savedDesigns).toHaveLength(1);
  });

  it('reports a load failure through loadError', () => {
    const adapter: VersionedStorageAdapter<PersistedAppState> = {
      key: 'fake',
      read: () => err('corrupt', 'broken'),
      write: () => ok(undefined),
      clear: () => ok(undefined),
    };
    const { result } = renderHook(() => usePersistedDesigns({ adapter }));

    expect(result.current.ready).toBe(false);
    expect(result.current.loadError?.kind).toBe('corrupt');
  });
});

describe('useActiveDraftAutosave', () => {
  it('debounces and flushes pending drafts', () => {
    vi.useFakeTimers();
    try {
      const write = vi.fn((): PersistenceResult<void> => ok(undefined));
      const { result } = renderHook(() => useActiveDraftAutosave(write, { delayMs: 400 }));

      act(() => {
        result.current.schedule(createDraftDocument('draft', content(), { now }));
      });
      expect(write).not.toHaveBeenCalled();

      act(() => {
        result.current.flush();
      });
      expect(write).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
