import { describe, expect, it } from 'vitest';
import { DomainValidationError } from './catalog';
import {
  DEFAULT_APPLICATION_SETTINGS,
  DEFAULT_GARAGE_DIMENSIONS,
  PersistenceVersionError,
  parsePersistedAppState,
} from './persistence';

const design = {
  metadata: {
    id: 'design-july-2026',
    name: 'July Garage',
    createdAt: '2026-07-28T15:00:00.000Z',
    updatedAt: '2026-07-28T15:00:00.000Z',
    referenceTemplateId: 'two-car-standard',
    referenceRoleColors: {
      base: 'Pearl Silver',
      border: 'Jet Black',
      accent: 'Racing Red',
      secondary: 'Royal Blue',
    },
  },
  garage: { widthInches: 230, lengthInches: 246 },
  layout: {
    cellSizeInches: 12,
    cellsById: {
      'cell-0-0': {
        id: 'cell-0-0',
        column: 0,
        row: 0,
        productId: 'swisstrax-ribtrax-pro',
        colorId: 'swisstrax-ribtrax-pro-graphite',
        orientation: 90,
      },
    },
    selectedProduct: {
      productId: 'swisstrax-ribtrax-pro',
      colorId: 'swisstrax-ribtrax-pro-graphite',
      orientation: 0,
    },
  },
};

describe('parsePersistedAppState', () => {
  it('accepts a complete v1 persisted state without derived material totals', () => {
    const parsed = parsePersistedAppState({
      schemaVersion: 1,
      settings: { wasteAllowancePercent: 8 },
      activeDraft: design,
      savedDesignsById: { 'design-july-2026': design },
      catalogOverrides: {
        priceOverridesById: {
          'swisstrax-ribtrax-pro-graphite-pack': {
            priceId: 'swisstrax-ribtrax-pro-graphite-pack',
            priceCents: 4699,
            saleUnit: 'pack',
            packQuantity: 6,
            sourceUrl: 'https://example.com/ribtrax-pro',
            checkedDate: '2026-07-28',
          },
        },
      },
    });

    expect(parsed.savedDesignsById['design-july-2026']?.metadata.name).toBe('July Garage');
    expect(parsed.activeDraft?.metadata.referenceRoleColors?.accent).toBe('Racing Red');
    expect(parsed.activeDraft?.layout.cellsById['cell-0-0']?.orientation).toBe(90);
    expect(parsed.settings.wasteAllowancePercent).toBe(8);
  });

  it('normalizes blank unused reference roles so a saved design remains recoverable', () => {
    const parsed = parsePersistedAppState({
      schemaVersion: 1,
      settings: DEFAULT_APPLICATION_SETTINGS,
      activeDraft: {
        ...design,
        metadata: {
          ...design.metadata,
          referenceRoleColors: { base: 'Jet Black', border: '', accent: '', secondary: '' },
        },
      },
      savedDesignsById: {},
      catalogOverrides: { priceOverridesById: {} },
    });

    expect(parsed.activeDraft?.metadata.referenceRoleColors).toEqual({ base: 'Jet Black' });
  });

  it('rejects persisted records with inconsistent map keys', () => {
    expect(() =>
      parsePersistedAppState({
        schemaVersion: 1,
        settings: { wasteAllowancePercent: 8 },
        activeDraft: null,
        savedDesignsById: { 'different-design': design },
        catalogOverrides: { priceOverridesById: {} },
      })
    ).toThrow(DomainValidationError);
  });

  it('migrates the v0 saved design array into the v1 stable id map', () => {
    const parsed = parsePersistedAppState({
      schemaVersion: 0,
      activeDraft: design,
      savedDesigns: [design],
    });

    expect(parsed).toMatchObject({
      schemaVersion: 1,
      settings: DEFAULT_APPLICATION_SETTINGS,
      activeDraft: design,
      savedDesignsById: { 'design-july-2026': design },
      catalogOverrides: { priceOverridesById: {} },
    });
    expect(DEFAULT_GARAGE_DIMENSIONS).toEqual({ widthInches: 230, lengthInches: 246 });
  });

  it('migrates a v0 design whose stable id shadows an object prototype property', () => {
    const parsed = parsePersistedAppState({
      schemaVersion: 0,
      savedDesigns: [{ ...design, metadata: { ...design.metadata, id: 'constructor' } }],
    });

    expect(Object.hasOwn(parsed.savedDesignsById, 'constructor')).toBe(true);
    expect(Object.values(parsed.savedDesignsById)[0]?.metadata.id).toBe('constructor');
  });

  it('reports future schema versions explicitly', () => {
    expect(() => parsePersistedAppState({ schemaVersion: 2 })).toThrow(PersistenceVersionError);
  });
});
