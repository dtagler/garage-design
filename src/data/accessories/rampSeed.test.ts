import { describe, expect, it } from 'vitest';
import {
  assertRampAccessory,
  assertRampSeedsValid,
  findRampAccessory,
  getRampCompatibility,
  getRampUnavailableReason,
  listRampAccessoriesForProduct,
  PRODUCTS_WITHOUT_VERIFIED_RAMP,
  RAMP_ACCESSORY_SEEDS,
  RAMP_CHECKED_DATE,
} from './rampSeed';
import { listSeedProducts } from '../seedCatalog';

const SEEDED_PRODUCT_IDS = listSeedProducts().map((seed) => seed.product.id);

describe('ramp accessory seeds', () => {
  it('only references catalog products that exist', () => {
    expect(() => {
      assertRampSeedsValid(SEEDED_PRODUCT_IDS);
    }).not.toThrow();
  });

  it('records a checked date on every source and the latest research date', () => {
    expect(
      RAMP_ACCESSORY_SEEDS.every((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry.source.checkedDate))
    ).toBe(true);
    expect(RAMP_CHECKED_DATE).toBe('2026-07-30');
  });

  it('publishes a source url, seller, and integer price for every accessory', () => {
    for (const accessory of RAMP_ACCESSORY_SEEDS) {
      expect(accessory.source.url).toMatch(/^https:\/\//);
      expect(accessory.seller.length).toBeGreaterThan(0);
      expect(Number.isSafeInteger(accessory.priceCents)).toBe(true);
      expect(accessory.isEstimate).toBe(true);
      expect(accessory.caveats.length).toBeGreaterThan(0);
    }
  });

  it('never claims a family both has and lacks a compatible ramp', () => {
    for (const productId of Object.keys(PRODUCTS_WITHOUT_VERIFIED_RAMP)) {
      expect(listRampAccessoriesForProduct(productId)).toHaveLength(0);
    }
  });

  it('counts only straight pieces from a kit that also contains corners', () => {
    const kit = findRampAccessory('vevor-male-transition-edge-kit-20in');

    expect(kit?.piecesPerSaleUnit).toBe(16);
    expect(kit?.straightSegmentsPerSaleUnit).toBe(12);
    expect(kit?.saleUnit).toBe('kit');
  });

  it('includes VEVOR drainage-mat edging with published compatibility', () => {
    const [best] = listRampAccessoriesForProduct('vevor-interlocking-drainage-mat-12in');

    expect(best?.id).toBe('vevor-drainage-mat-straight-transition-edge-kit');
    expect(best?.piecesPerSaleUnit).toBe(11);
    expect(best?.straightSegmentsPerSaleUnit).toBe(11);
    expect(best?.segmentLengthInches).toBe(12.2);
    expect(best?.priceCents).toBe(1390);
    expect(getRampCompatibility(best, 'vevor-interlocking-drainage-mat-12in')?.basis).toBe(
      'published'
    );
    expect(getRampUnavailableReason('vevor-interlocking-drainage-mat-12in')).toBeUndefined();
  });

  it('prefers the vendor-recommended female edge for a RaceDeck floor', () => {
    const [best] = listRampAccessoriesForProduct('racedeck-diamond');

    expect(best?.id).toBe('racedeck-female-edge-12');
    expect(best?.garageDoorGuidance).toBe('RaceDeck recommends female edges for garage doors.');
    expect(best?.segmentLengthInches).toBe(12);
  });

  it('offers the 18 inch edge for the XL family and not the 12 inch one', () => {
    expect(listRampAccessoriesForProduct('racedeck-xl').map((entry) => entry.id)).toEqual([
      'racedeck-female-edge-18',
    ]);
  });

  it('records inferred compatibility separately from published compatibility', () => {
    const [best] = listRampAccessoriesForProduct('swisstrax-ribtrax-smooth-12-series');

    expect(best).toBeDefined();
    expect(getRampCompatibility(best, 'swisstrax-ribtrax-smooth-12-series')?.basis).toBe(
      'inferred'
    );
    expect(getRampCompatibility(best, 'swisstrax-diamondtrax-12-series')?.basis).toBe('published');
  });

  it('explains why a family has no verified ramp instead of inventing one', () => {
    expect(getRampUnavailableReason('vevor-garage-tiles-interlocking-12in')).toMatch(
      /Upgraded 6-Lock/
    );
    expect(getRampUnavailableReason('techfloor-solid-raised-squares')).toMatch(
      /no accessory listing/
    );
    expect(getRampUnavailableReason('racedeck-diamond')).toBeUndefined();
  });

  it('does not mistake an inherited object property for a reason', () => {
    expect(getRampUnavailableReason('constructor')).toBeUndefined();
    expect(getRampUnavailableReason('toString')).toBeUndefined();
  });

  it('rejects an accessory with an impossible sale unit', () => {
    const [valid] = RAMP_ACCESSORY_SEEDS;

    expect(() => {
      assertRampAccessory({ ...valid, straightSegmentsPerSaleUnit: 0 });
    }).toThrow(/at least one straight piece/);
    expect(() => {
      assertRampAccessory({ ...valid, priceCents: 0 });
    }).toThrow(/positive integer price/);
  });

  it('rejects an accessory pointing at a product the catalog does not have', () => {
    expect(() => {
      assertRampSeedsValid(['racedeck-diamond']);
    }).toThrow(/unknown product/);
  });
});
