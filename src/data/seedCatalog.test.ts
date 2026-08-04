import { describe, expect, it } from 'vitest';
import { isOrientationAllowed } from '../domain/catalog';
import { RACEDECK_SEED } from './manufacturers/racedeckSeed';
import {
  buildSeedCatalog,
  findSeedColor,
  findSeedProduct,
  listSeedPrices,
  listSeedProducts,
  SEED_CATALOG,
  SeedCatalogError,
} from './seedCatalog';
import {
  AFFILIATION_DISCLAIMER,
  CATALOG_CHECKED_DATE,
  CATALOG_CHECKED_DATES,
  describePriceBasis,
  DRAINABLE_CHECKED_DATE,
  TRUELOCK_CHECKED_DATE,
  PRICING_DISCLAIMER,
  tileAreaSquareFeet,
  tilesPerSaleUnit,
  type RawManufacturerSeed,
  type RawPriceSeed,
} from './seedTypes';
import { GREATMATS_SEED } from './manufacturers/greatmatsSeed';
import { FLOORINGINC_SEED } from './manufacturers/flooringIncSeed';
import { TRUELOCK_SEED } from './manufacturers/trueLockSeed';
import { MODUTILE_SEED } from './manufacturers/modutileSeed';
import { SWISSTRAX_SEED } from './manufacturers/swisstraxSeed';
import { TECHFLOOR_SEED } from './manufacturers/techfloorSeed';
import { VEVOR_SEED } from './manufacturers/vevorSeed';

const SHIPPED_SEEDS: readonly RawManufacturerSeed[] = [
  SWISSTRAX_SEED,
  RACEDECK_SEED,
  VEVOR_SEED,
  TECHFLOOR_SEED,
  MODUTILE_SEED,
  GREATMATS_SEED,
  FLOORINGINC_SEED,
  TRUELOCK_SEED,
];

/**
 * Products whose dimensions and color lists come from a page the brand itself owns. Everything
 * else has to declare a retailer listing explicitly, so a downgrade cannot happen silently.
 */
const MANUFACTURER_SOURCED_PRODUCTS: readonly string[] = [
  'swisstrax-ribtrax-pro',
  'swisstrax-ribtrax-smooth-pro',
  'swisstrax-diamondtrax-12-series',
  'swisstrax-ribtrax-smooth-12-series',
  'racedeck-diamond',
  'racedeck-free-flow',
  'racedeck-free-flow-xlc',
  'racedeck-garageflow',
  'racedeck-tuffshield',
  'racedeck-circletrac',
  'racedeck-xl',
  'vevor-interlocking-drainage-mat-12in',
  'vevor-garage-tiles-interlocking-12in',
  'vevor-garage-floor-tiles-interlocking-20in',
  'modutile-perforated-garage-tile',
  'flooringinc-nitro-vented-12in',
  'flooringinc-vented-grid-loc-12in',
  'truelock-hd-ribbed-flow-through-12in',
];

/** Products read from a reseller page because the brand publishes no reachable spec page. */
const RETAILER_SOURCED_PRODUCTS: Readonly<Record<string, string>> = {
  'techfloor-solid-raised-squares':
    'https://www.greatmats.com/garage-floor-tiles/techfloor-standard-solid-raised-squares.php',
  'greatmats-turbotile-perforated':
    'https://www.greatmats.com/garage-floor-tile/perforated-flow-drain-garage-tile.php',
};

/**
 * Pinned so that widening a brand's allowlist, which is what lets it cite a new site, has to be a
 * deliberate edit here rather than a side effect of editing the seed.
 */
const EXPECTED_SOURCE_HOSTNAMES: Readonly<Record<string, readonly string[]>> = {
  swisstrax: ['store.swisstrax.com'],
  racedeck: ['racedeck.com'],
  vevor: ['www.vevor.com'],
  techfloor: ['www.greatmats.com'],
  modutile: ['modutile.com'],
  greatmats: ['www.greatmats.com'],
  flooringinc: ['www.flooringinc.com'],
  truelock: ['www.garageflooringllc.com'],
};

/** Image hosts are pinned separately: a store's CDN is never a host a *fact* may be cited from. */
const EXPECTED_IMAGE_HOSTNAMES: Readonly<Record<string, readonly string[]>> = {
  swisstrax: ['cdn.shopify.com'],
  racedeck: ['racedeck.com'],
  vevor: ['www.vevor.com', 'img.vevorstatic.com'],
  techfloor: ['www.greatmats.com'],
  modutile: ['modutile.com'],
  greatmats: ['www.greatmats.com'],
  flooringinc: ['www.flooringinc.com'],
  truelock: ['www.garageflooringllc.com'],
};

const EXPECTED_COLOR_NAMES: Readonly<Record<string, readonly string[]>> = {
  'swisstrax-ribtrax-pro': [
    'Arctic White',
    'Boxwood Green',
    'Chocolate Brown',
    'Citrus Yellow',
    'Jet Black',
    'Mocha Java',
    'Pearl Grey',
    'Pearl Silver',
    'Racing Red',
    'Royal Blue',
    'Slate Grey',
    'Tropical Orange',
  ],
  'swisstrax-ribtrax-smooth-pro': [
    'Arctic White',
    'Boxwood Green',
    'Chocolate Brown',
    'Citrus Yellow',
    'Jet Black',
    'Mocha Java',
    'Pearl Silver',
    'Racing Red',
    'Royal Blue',
    'Slate Grey',
    'Tropical Orange',
  ],
  'swisstrax-diamondtrax-12-series': [
    'Arctic White',
    'Chocolate Brown',
    'Citrus Yellow',
    'Jet Black',
    'Mocha Java',
    'Pearl Silver',
    'Racing Red',
    'Royal Blue',
    'Slate Grey',
    'Tropical Orange',
  ],
  'swisstrax-ribtrax-smooth-12-series': [
    'Arctic White',
    'Chocolate Brown',
    'Citrus Yellow',
    'Jet Black',
    'Mocha Java',
    'Pearl Silver',
    'Racing Red',
    'Royal Blue',
    'Slate Grey',
    'Tropical Orange',
  ],
  'racedeck-diamond': [
    'Alloy',
    'Beige',
    'Black',
    'Chalk',
    'Cool Blue',
    'Espresso',
    'Graphite',
    'Green Light',
    'Neon Orange',
    'Neon Pink',
    'Neon Teal',
    'Orange',
    'Red',
    'Royal Blue',
    'Royal Purple',
    'Sublime',
    'White',
    'Yellow',
  ],
  'racedeck-free-flow': [
    'Alloy',
    'Beige',
    'Black',
    'Cool Blue',
    'Espresso',
    'Graphite',
    'Green Light',
    'Neon Orange',
    'Neon Pink',
    'Neon Teal',
    'Orange',
    'Red',
    'Royal Blue',
    'Royal Purple',
    'Sublime',
    'White',
    'Yellow',
  ],
  'racedeck-free-flow-xlc': [
    'Alloy',
    'Beige',
    'Black',
    'Chalk',
    'Cool Blue',
    'Espresso',
    'Graphite',
    'Green Light',
    'Orange',
    'Red',
    'Royal Blue',
    'Royal Purple',
    'Sublime',
    'White',
    'Yellow',
  ],
  'racedeck-garageflow': ['Black', 'Bright Blue', 'Gray', 'Red'],
  'racedeck-tuffshield': [
    'Alloy',
    'Beige',
    'Black',
    'Espresso',
    'Graphite',
    'Green Light',
    'Orange',
    'Red',
    'Royal Blue',
    'Royal Purple',
    'Sublime',
    'White',
    'Yellow',
  ],
  'racedeck-circletrac': [
    'Alloy',
    'Beige',
    'Black',
    'Chalk',
    'Espresso',
    'Graphite',
    'Green Light',
    'Orange',
    'Red',
    'Royal Blue',
    'Royal Purple',
    'Sublime',
    'White',
    'Yellow',
  ],
  'racedeck-xl': [
    'Alloy',
    'Beige',
    'Black',
    'Chalk',
    'Espresso',
    'Graphite',
    'Green Light',
    'Orange',
    'Red',
    'Royal Blue',
    'Royal Purple',
    'Sublime',
    'White',
    'Yellow',
  ],
  'vevor-garage-tiles-interlocking-12in': ['Graphite Gray', 'Silver', 'Red', 'Black', 'Blue'],
  'vevor-garage-floor-tiles-interlocking-20in': ['Black', 'Graphite Gray'],
  'vevor-interlocking-drainage-mat-12in': ['Light Gray', 'Black'],
  'techfloor-solid-raised-squares': ['Black', 'Blue', 'Dark Grey', 'Grey', 'Red', 'Tan', 'White'],
  'modutile-perforated-garage-tile': [
    'Gray',
    'Black',
    'White',
    'Beige',
    'Brown',
    'Blue',
    'Red',
    'Orange',
    'Green',
    'Purple',
    'Yellow',
  ],
  'greatmats-turbotile-perforated': ['Black', 'Gray', 'Red'],
  'flooringinc-nitro-vented-12in': [
    'Midnight Black',
    'Arctic White',
    'Graphite',
    'Gunmetal',
    'Harley Orange',
    'Sahara Sand',
    'Shelby Blue',
    'Victory Red',
  ],
  'flooringinc-vented-grid-loc-12in': [
    'Black',
    'Blue',
    'Brown',
    'Graphite',
    'Green',
    'Gunmetal',
    'Orange',
    'Purple',
    'Red',
    'Sand',
    'White',
    'Yellow',
  ],
  'truelock-hd-ribbed-flow-through-12in': [
    'Alloy Silver',
    'Beige',
    'Black',
    'Graphite Gray',
    'Orange',
    'Purple',
    'Red',
    'Royal Blue',
    'White',
    'Yellow',
  ],
};

function minimalSeed(overrides: Partial<RawManufacturerSeed> = {}): RawManufacturerSeed {
  return {
    id: 'testco',
    name: 'TestCo',
    trademarkNotice: 'TestCo is a trademark of its owner.',
    sourceHostnames: ['example.com'],
    palette: {
      black: { name: 'Black', vendorColorToken: 'black', approximateSwatchHex: '#111111' },
    },
    products: [
      {
        id: 'testco-tile',
        name: 'TestCo Tile',
        dimensions: { widthInches: 12, lengthInches: 12, thicknessInches: 0.5 },
        rotationRule: 'fixed',
        rotationRuleRationale: 'Fixed for the test fixture.',
        dimensionsSource: {
          url: 'https://example.com/tile',
          kind: 'manufacturer-official',
          checkedDate: CATALOG_CHECKED_DATE,
        },
        colorsSource: {
          url: 'https://example.com/tile',
          kind: 'manufacturer-official',
          checkedDate: CATALOG_CHECKED_DATE,
        },
        colorSlugs: ['black'],
        drainage: {
          isDrainable: false,
          surfaceOpenness: 'closed',
          evidence: 'Closed for the test fixture.',
          source: {
            url: 'https://example.com/tile',
            kind: 'manufacturer-official',
            checkedDate: CATALOG_CHECKED_DATE,
          },
        },
        prices: [
          {
            slug: 'tile',
            priceCents: 100,
            saleUnit: 'tile',
            sourceUrl: 'https://example.com/tile',
            sourceKind: 'manufacturer-store',
            seller: 'TestCo',
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('seed catalog shape', () => {
  it('seeds every researched brand and every verified product', () => {
    expect(SEED_CATALOG.manufacturers.map((entry) => entry.manufacturer.id)).toEqual([
      'swisstrax',
      'racedeck',
      'vevor',
      'techfloor',
      'modutile',
      'greatmats',
      'flooringinc',
      'truelock',
    ]);

    expect(listSeedProducts().map((entry) => entry.product.id)).toEqual([
      'swisstrax-ribtrax-pro',
      'swisstrax-ribtrax-smooth-pro',
      'swisstrax-diamondtrax-12-series',
      'swisstrax-ribtrax-smooth-12-series',
      'racedeck-diamond',
      'racedeck-free-flow',
      'racedeck-free-flow-xlc',
      'racedeck-garageflow',
      'racedeck-tuffshield',
      'racedeck-circletrac',
      'racedeck-xl',
      'vevor-interlocking-drainage-mat-12in',
      'vevor-garage-tiles-interlocking-12in',
      'vevor-garage-floor-tiles-interlocking-20in',
      'techfloor-solid-raised-squares',
      'modutile-perforated-garage-tile',
      'greatmats-turbotile-perforated',
      'flooringinc-nitro-vented-12in',
      'flooringinc-vented-grid-loc-12in',
      'truelock-hd-ribbed-flow-through-12in',
    ]);
  });

  it('stamps every product with a declared research date its own sources agree with', () => {
    expect(SEED_CATALOG.checkedDate).toBe('2026-07-28');
    expect(SEED_CATALOG.latestCheckedDate).toBe(TRUELOCK_CHECKED_DATE);
    expect(SEED_CATALOG.currency).toBe('USD');

    for (const product of listSeedProducts()) {
      expect(CATALOG_CHECKED_DATES).toContain(product.checkedDate);
      expect(product.dimensionsSource.checkedDate).toBe(product.checkedDate);
      expect(product.colorsSource.checkedDate).toBe(product.checkedDate);
      expect(product.drainage.source.checkedDate).toBe(product.checkedDate);

      for (const price of product.prices) {
        expect(price.price.checkedDate).toBe(product.checkedDate);
      }
    }
  });

  it('dates the drainable research pass a day after the original catalog', () => {
    expect(DRAINABLE_CHECKED_DATE).toBe('2026-07-29');
    expect(findSeedProduct('racedeck-free-flow-xlc')?.checkedDate).toBe(DRAINABLE_CHECKED_DATE);
    expect(findSeedProduct('racedeck-garageflow')?.checkedDate).toBe(DRAINABLE_CHECKED_DATE);
    expect(findSeedProduct('vevor-interlocking-drainage-mat-12in')?.checkedDate).toBe(
      DRAINABLE_CHECKED_DATE
    );
    expect(findSeedProduct('modutile-perforated-garage-tile')?.checkedDate).toBe(
      DRAINABLE_CHECKED_DATE
    );
    expect(findSeedProduct('greatmats-turbotile-perforated')?.checkedDate).toBe(
      DRAINABLE_CHECKED_DATE
    );
    expect(findSeedProduct('racedeck-diamond')?.checkedDate).toBe(CATALOG_CHECKED_DATE);
  });

  it('gives every product a unique id and every color a unique id within that product', () => {
    const productIds = listSeedProducts().map((entry) => entry.product.id);
    expect(new Set(productIds).size).toBe(productIds.length);

    for (const product of listSeedProducts()) {
      const colorIds = product.colors.map((entry) => entry.color.id);
      expect(new Set(colorIds).size).toBe(colorIds.length);

      for (const color of product.colors) {
        expect(color.color.productId).toBe(product.product.id);
        expect(color.color.id.startsWith(`${product.product.id}-`)).toBe(true);
      }
    }
  });
});

describe('seeded tile dimensions', () => {
  it.each([
    ['swisstrax-ribtrax-pro', 15.75, 15.75, 0.75],
    ['swisstrax-ribtrax-smooth-pro', 15.75, 15.75, 0.63],
    ['swisstrax-diamondtrax-12-series', 12, 12, 0.5],
    ['swisstrax-ribtrax-smooth-12-series', 12, 12, 0.5],
    ['racedeck-diamond', 12, 12, 0.5],
    ['racedeck-free-flow', 12, 12, 0.5],
    ['racedeck-free-flow-xlc', 18, 18, 0.625],
    ['racedeck-garageflow', 12, 12, 0.5],
    ['racedeck-tuffshield', 12, 12, 0.5],
    ['racedeck-circletrac', 12, 12, 0.5],
    ['racedeck-xl', 18, 18, 0.5],
    ['vevor-interlocking-drainage-mat-12in', 12, 12, 0.59],
    ['vevor-garage-tiles-interlocking-12in', 12, 12, 0.53],
    ['vevor-garage-floor-tiles-interlocking-20in', 20.2, 20.2, 0.2],
    ['techfloor-solid-raised-squares', 12, 12, 0.25],
    ['modutile-perforated-garage-tile', 12, 12, 0.5],
    ['greatmats-turbotile-perforated', 12.12, 12.12, 0.625],
  ])('matches the published spec for %s', (id, widthInches, lengthInches, thicknessInches) => {
    expect(findSeedProduct(id)?.product.dimensions).toEqual({
      widthInches,
      lengthInches,
      thicknessInches,
    });
  });

  it('pins the source hostname allowlist for every seeded brand', () => {
    for (const entry of SEED_CATALOG.manufacturers) {
      expect(entry.sourceHostnames).toEqual(EXPECTED_SOURCE_HOSTNAMES[entry.manufacturer.id]);
      expect(entry.imageHostnames).toEqual(EXPECTED_IMAGE_HOSTNAMES[entry.manufacturer.id]);
    }

    expect(SEED_CATALOG.manufacturers).toHaveLength(Object.keys(EXPECTED_SOURCE_HOSTNAMES).length);
  });

  it('cites a page on the brand-declared hostnames with a verbatim quote for every dimension', () => {
    for (const product of listSeedProducts()) {
      const { dimensionsSource } = product;
      const manufacturer = SEED_CATALOG.manufacturers.find(
        (entry) => entry.manufacturer.id === product.product.manufacturerId
      );

      expect(manufacturer).toBeDefined();
      expect(manufacturer?.sourceHostnames).toContain(new URL(dimensionsSource.url).hostname);
      expect(dimensionsSource.quote?.length).toBeGreaterThan(0);
    }
  });

  it('names every product whose dimensions and colors come from a brand-owned page', () => {
    for (const product of listSeedProducts()) {
      const isManufacturerSourced = MANUFACTURER_SOURCED_PRODUCTS.includes(product.product.id);
      const kinds = [product.dimensionsSource.kind, product.colorsSource.kind];

      for (const kind of kinds) {
        expect(kind === 'manufacturer-official' || kind === 'manufacturer-store').toBe(
          isManufacturerSourced
        );
      }
    }
  });

  it('reads every retailer-sourced product from the listing it declares', () => {
    for (const [id, url] of Object.entries(RETAILER_SOURCED_PRODUCTS)) {
      const product = findSeedProduct(id);

      expect(product?.dimensionsSource.kind).toBe('retailer-listing');
      expect(product?.colorsSource.kind).toBe('retailer-listing');
      expect(product?.dimensionsSource.url).toBe(url);
    }

    expect(Object.keys(RETAILER_SOURCED_PRODUCTS).sort()).toEqual(
      listSeedProducts()
        .filter((entry) => entry.dimensionsSource.kind === 'retailer-listing')
        .map((entry) => entry.product.id)
        .sort()
    );
  });

  it('keeps every seeded tile square, so grid fit does not depend on tile rotation', () => {
    for (const { product } of listSeedProducts()) {
      expect(product.dimensions.widthInches).toBe(product.dimensions.lengthInches);
    }
  });
});

describe('seeded colors', () => {
  it.each(Object.entries(EXPECTED_COLOR_NAMES))(
    'seeds the exact published color list for %s',
    (id, expectedNames) => {
      expect(findSeedProduct(id)?.colors.map((entry) => entry.color.name)).toEqual(expectedNames);
    }
  );

  it('covers every seeded product with an expected color list', () => {
    expect(Object.keys(EXPECTED_COLOR_NAMES).sort()).toEqual(
      listSeedProducts()
        .map((entry) => entry.product.id)
        .sort()
    );
  });

  it('marks every swatch as an approximation, because no seeded brand publishes hex', () => {
    for (const product of listSeedProducts()) {
      for (const color of product.colors) {
        expect(color.swatchIsApproximate).toBe(true);
        expect(color.color.swatchHex).toMatch(/^#[0-9A-F]{6}$/);
        expect(color.vendorColorToken.length).toBeGreaterThan(0);
      }
    }
  });

  it('cites a page on the brand-declared hostnames for every color list', () => {
    for (const product of listSeedProducts()) {
      const manufacturer = SEED_CATALOG.manufacturers.find(
        (entry) => entry.manufacturer.id === product.product.manufacturerId
      );

      expect(manufacturer?.sourceHostnames).toContain(new URL(product.colorsSource.url).hostname);
    }
  });

  it('resolves a color by product and color id', () => {
    expect(
      findSeedColor('swisstrax-ribtrax-pro', 'swisstrax-ribtrax-pro-racing-red')?.color
    ).toEqual({
      id: 'swisstrax-ribtrax-pro-racing-red',
      productId: 'swisstrax-ribtrax-pro',
      name: 'Racing Red',
      swatchHex: '#B4131C',
    });

    expect(findSeedColor('swisstrax-ribtrax-pro', 'racedeck-diamond-chalk')).toBeUndefined();
    expect(findSeedColor('no-such-product', 'no-such-color')).toBeUndefined();
  });

  it('does not seed Pearl Grey on Ribtrax Smooth PRO, which does not list it', () => {
    const smoothColors = findSeedProduct('swisstrax-ribtrax-smooth-pro')?.colors ?? [];
    const proColors = findSeedProduct('swisstrax-ribtrax-pro')?.colors ?? [];

    expect(proColors.map((entry) => entry.color.name)).toContain('Pearl Grey');
    expect(smoothColors.map((entry) => entry.color.name)).not.toContain('Pearl Grey');
  });

  it('does not seed Chalk on Free-Flow, which does not list it', () => {
    const freeFlowColors = findSeedProduct('racedeck-free-flow')?.colors ?? [];
    const diamondColors = findSeedProduct('racedeck-diamond')?.colors ?? [];

    expect(diamondColors.map((entry) => entry.color.name)).toContain('Chalk');
    expect(freeFlowColors.map((entry) => entry.color.name)).not.toContain('Chalk');
  });
});

describe('seeded prices', () => {
  it.each([
    ['swisstrax-ribtrax-pro', 858],
    ['swisstrax-ribtrax-smooth-pro', 858],
    ['swisstrax-diamondtrax-12-series', 399],
    ['swisstrax-ribtrax-smooth-12-series', 399],
    ['racedeck-diamond', 485],
    ['racedeck-free-flow', 399],
    ['racedeck-free-flow-xlc', 1123],
    ['racedeck-garageflow', 269],
    ['racedeck-tuffshield', 585],
    ['racedeck-circletrac', 485],
    ['racedeck-xl', 1091],
    ['modutile-perforated-garage-tile', 198],
    ['greatmats-turbotile-perforated', 415],
  ])('records %s at the observed per-tile price in whole cents', (id, priceCents) => {
    const prices = listSeedPrices(id);

    expect(prices).toHaveLength(1);
    expect(prices[0]?.price.priceCents).toBe(priceCents);
    expect(Number.isSafeInteger(prices[0]?.price.priceCents)).toBe(true);
  });

  it('labels every price as a USD estimate from a named seller with a live source url', () => {
    for (const product of listSeedProducts()) {
      for (const seedPrice of product.prices) {
        expect(seedPrice.isEstimate).toBe(true);
        expect(seedPrice.currency).toBe('USD');
        expect(seedPrice.seller.trim().length).toBeGreaterThan(0);
        expect(Number.isSafeInteger(seedPrice.price.priceCents)).toBe(true);
        expect(new URL(seedPrice.price.sourceUrl).protocol).toBe('https:');
        expect(seedPrice.price.checkedDate).toBe(product.checkedDate);
      }
    }
  });

  it('preserves the sale basis each seller published, per tile or per pack', () => {
    for (const product of listSeedProducts()) {
      for (const { price, basisLabel } of product.prices) {
        expect(basisLabel).toBe(describePriceBasis(price));

        if (price.saleUnit === 'tile') {
          expect(price.packQuantity).toBeUndefined();
          expect(basisLabel).toBe('per tile');
          expect(
            product.prices.find((entry) => entry.price.id === price.id)?.canBuyIndividually
          ).toBe(true);
        } else {
          expect(price.saleUnit).toBe('pack');
          expect(price.packQuantity).toBeGreaterThan(0);
          expect(basisLabel).toBe(`per pack of ${String(price.packQuantity)} tiles`);
          expect(
            product.prices.find((entry) => entry.price.id === price.id)?.canBuyIndividually
          ).toBe(false);
        }
      }
    }
  });

  it('exposes the tile count behind every price, so per-tile cost can be derived later', () => {
    for (const product of listSeedProducts()) {
      for (const seedPrice of product.prices) {
        expect(seedPrice.tilesPerSaleUnit).toBe(tilesPerSaleUnit(seedPrice.price));
        expect(seedPrice.tilesPerSaleUnit).toBeGreaterThan(0);
      }
    }
  });

  it('keeps published pack coverage consistent with tile area, so per-square-foot cost derives', () => {
    for (const product of listSeedProducts()) {
      const areaPerTile = tileAreaSquareFeet(product.product.dimensions);

      for (const seedPrice of product.prices) {
        const { publishedCoverageSquareFeet, tilesPerSaleUnit: tiles } = seedPrice;

        if (publishedCoverageSquareFeet === undefined || tiles === undefined) {
          continue;
        }

        expect(publishedCoverageSquareFeet).toBeCloseTo(tiles * areaPerTile, 0);
      }
    }
  });

  it('describes each sale basis unambiguously', () => {
    const base = {
      id: 'x',
      productId: 'y',
      sourceUrl: 'https://example.com',
      checkedDate: CATALOG_CHECKED_DATE,
    };

    expect(describePriceBasis({ ...base, priceCents: 100, saleUnit: 'tile' })).toBe('per tile');
    expect(
      describePriceBasis({ ...base, priceCents: 100, saleUnit: 'pack', packQuantity: 6 })
    ).toBe('per pack of 6 tiles');
    expect(describePriceBasis({ ...base, priceCents: 100, saleUnit: 'square-foot' })).toBe(
      'per square foot'
    );
    expect(describePriceBasis({ ...base, priceCents: 100, saleUnit: 'pack' })).toBe('per pack');
  });

  it('counts no tiles in a square-foot sale unit', () => {
    expect(
      tilesPerSaleUnit({
        id: 'x',
        productId: 'y',
        priceCents: 100,
        saleUnit: 'square-foot',
        sourceUrl: 'https://example.com',
        checkedDate: CATALOG_CHECKED_DATE,
      })
    ).toBeUndefined();
  });

  it('returns no prices for an unknown product', () => {
    expect(listSeedPrices('no-such-product')).toEqual([]);
  });
});

describe('rotation rules', () => {
  it('keeps every seeded product at a fixed orientation and explains why', () => {
    for (const product of listSeedProducts()) {
      expect(product.product.rotationRule).toBe('fixed');
      expect(product.rotationRuleRationale.length).toBeGreaterThan(0);
      expect(isOrientationAllowed(product.product.rotationRule, 0)).toBe(true);
      expect(isOrientationAllowed(product.product.rotationRule, 90)).toBe(false);
    }
  });
});

describe('trademark and pricing disclosure', () => {
  it('attributes trademarks and disclaims affiliation for every manufacturer', () => {
    for (const entry of SEED_CATALOG.manufacturers) {
      expect(entry.trademarkNotice).toContain('trademarks of their');
      expect(entry.trademarkNotice).toContain('not affiliated');
      expect(entry.trademarkNotice).not.toMatch(/\bauthori[sz]ed (?:dealer|reseller|retailer)\b/i);
      expect(entry.trademarkNotice).not.toMatch(/\bpartner(?:ship|ed)?\b/i);
    }
  });

  it('publishes a pricing estimate disclaimer carrying the research date', () => {
    expect(PRICING_DISCLAIMER).toContain('estimates');
    expect(PRICING_DISCLAIMER).toContain(CATALOG_CHECKED_DATE);
    expect(PRICING_DISCLAIMER).toContain('not quotes');
  });

  it('publishes a standalone affiliation disclaimer', () => {
    expect(AFFILIATION_DISCLAIMER).toContain('not affiliated');
    expect(AFFILIATION_DISCLAIMER).toContain('endorsed');
  });
});

describe('buildSeedCatalog validation', () => {
  it('builds the shipped seeds without error', () => {
    expect(buildSeedCatalog(SHIPPED_SEEDS).products).toHaveLength(20);
  });

  it('rejects a drainable claim that contradicts the surface classification', () => {
    const seed = minimalSeed();
    const broken: RawManufacturerSeed = {
      ...seed,
      products: [
        {
          ...seed.products[0],
          drainage: { ...seed.products[0].drainage, isDrainable: true },
        },
      ],
    };

    expect(() => buildSeedCatalog([broken])).toThrow(SeedCatalogError);
    expect(() => buildSeedCatalog([broken])).toThrow('against surface openness "closed"');
  });

  it('rejects a drainage classification with no vendor evidence behind it', () => {
    const seed = minimalSeed();
    const broken: RawManufacturerSeed = {
      ...seed,
      products: [
        { ...seed.products[0], drainage: { ...seed.products[0].drainage, evidence: '  ' } },
      ],
    };

    expect(() => buildSeedCatalog([broken])).toThrow('records no drainage evidence');
  });

  it('rejects an image hosted somewhere the brand never declared', () => {
    const seed = minimalSeed();
    const broken: RawManufacturerSeed = {
      ...seed,
      products: [
        {
          ...seed.products[0],
          image: {
            imageUrl: 'https://cdn.example.net/tile.jpg',
            sourcePageUrl: 'https://example.com/tile',
            attributionText: 'Photo (c) TestCo.',
            altText: 'A TestCo tile seen from above.',
            checkedDate: CATALOG_CHECKED_DATE,
            rightsBasis: 'remote-reference-with-attribution',
            hotlinkStability: 'unknown',
          },
        },
      ],
    };

    expect(() => buildSeedCatalog([broken])).toThrow(
      'host "cdn.example.net" is not a declared source hostname'
    );
  });

  it('rejects an image dated differently from the product it belongs to', () => {
    const seed = minimalSeed();
    const broken: RawManufacturerSeed = {
      ...seed,
      products: [
        {
          ...seed.products[0],
          image: {
            imageUrl: 'https://example.com/tile.jpg',
            sourcePageUrl: 'https://example.com/tile',
            attributionText: 'Photo (c) TestCo.',
            altText: 'A TestCo tile seen from above.',
            checkedDate: DRAINABLE_CHECKED_DATE,
            rightsBasis: 'remote-reference-with-attribution',
            hotlinkStability: 'unknown',
          },
        },
      ],
    };

    expect(() => buildSeedCatalog([broken])).toThrow(
      `image is dated "${DRAINABLE_CHECKED_DATE}", but the product is dated "${CATALOG_CHECKED_DATE}"`
    );
  });

  it('rejects alt text too short to describe the photo', () => {
    const seed = minimalSeed();
    const broken: RawManufacturerSeed = {
      ...seed,
      products: [
        {
          ...seed.products[0],
          image: {
            imageUrl: 'https://example.com/tile.jpg',
            sourcePageUrl: 'https://example.com/tile',
            attributionText: 'Photo (c) TestCo.',
            altText: 'Tile',
            checkedDate: CATALOG_CHECKED_DATE,
            rightsBasis: 'remote-reference-with-attribution',
            hotlinkStability: 'unknown',
          },
        },
      ],
    };

    expect(() => buildSeedCatalog([broken])).toThrow('must describe what the photo shows');
  });

  it('rejects a research date that is not one the catalog declares', () => {
    const seed = minimalSeed();
    const broken: RawManufacturerSeed = {
      ...seed,
      products: [{ ...seed.products[0], checkedDate: '2025-01-01' }],
    };

    expect(() => buildSeedCatalog([broken])).toThrow('is not one of the catalog research dates');
  });

  it('rejects a color slug that has no palette entry', () => {
    const seed = minimalSeed();
    const broken: RawManufacturerSeed = {
      ...seed,
      products: [{ ...seed.products[0], colorSlugs: ['aubergine'] }],
    };

    expect(() => buildSeedCatalog([broken])).toThrow(SeedCatalogError);
    expect(() => buildSeedCatalog([broken])).toThrow('aubergine');
  });

  it('rejects a color slug that only resolves through Object.prototype', () => {
    const seed = minimalSeed();
    const broken: RawManufacturerSeed = {
      ...seed,
      products: [{ ...seed.products[0], colorSlugs: ['constructor'] }],
    };

    expect(() => buildSeedCatalog([broken])).toThrow(SeedCatalogError);
    expect(() => buildSeedCatalog([broken])).toThrow('missing from the "testco" palette');
  });

  it('rejects a duplicate manufacturer id', () => {
    expect(() =>
      buildSeedCatalog([
        minimalSeed(),
        minimalSeed({ products: [{ ...minimalSeed().products[0], id: 'testco-other' }] }),
      ])
    ).toThrow('duplicate manufacturer id "testco"');
  });

  it('rejects a duplicate product id across manufacturers', () => {
    expect(() => buildSeedCatalog([minimalSeed(), minimalSeed({ id: 'othertestco' })])).toThrow(
      'duplicate product id "testco-tile"'
    );
  });

  it('rejects a repeated color slug within one product', () => {
    const seed = minimalSeed();
    const broken: RawManufacturerSeed = {
      ...seed,
      products: [{ ...seed.products[0], colorSlugs: ['black', 'black'] }],
    };

    expect(() => buildSeedCatalog([broken])).toThrow('repeats color slug "black"');
  });

  it('rejects a product with no colors or no prices', () => {
    const seed = minimalSeed();

    expect(() =>
      buildSeedCatalog([{ ...seed, products: [{ ...seed.products[0], colorSlugs: [] }] }])
    ).toThrow('seeds no colors');

    expect(() =>
      buildSeedCatalog([{ ...seed, products: [{ ...seed.products[0], prices: [] }] }])
    ).toThrow('seeds no prices');
  });

  it('rejects a manufacturer with no products', () => {
    expect(() => buildSeedCatalog([minimalSeed({ products: [] })])).toThrow('seeds no products');
  });

  it('rejects fractional cents through the domain price parser', () => {
    const seed = minimalSeed();
    const broken: RawManufacturerSeed = {
      ...seed,
      products: [
        {
          ...seed.products[0],
          prices: [{ ...seed.products[0].prices[0], priceCents: 8.58 }],
        },
      ],
    };

    expect(() => buildSeedCatalog([broken])).toThrow('productPrice.priceCents');
  });

  it('rejects a repeated price slug within one product', () => {
    const seed = minimalSeed();
    const price = seed.products[0].prices[0];
    const broken: RawManufacturerSeed = {
      ...seed,
      products: [{ ...seed.products[0], prices: [price, { ...price, priceCents: 200 }] }],
    };

    expect(() => buildSeedCatalog([broken])).toThrow('repeats price slug "tile"');
  });

  it('rejects a source reference that is not dated with the catalog research date', () => {
    const seed = minimalSeed();
    const product = seed.products[0];
    const broken: RawManufacturerSeed = {
      ...seed,
      products: [
        { ...product, colorsSource: { ...product.colorsSource, checkedDate: '2025-01-01' } },
      ],
    };

    expect(() => buildSeedCatalog([broken])).toThrow(SeedCatalogError);
    expect(() => buildSeedCatalog([broken])).toThrow('colorsSource is dated "2025-01-01"');
  });

  it('rejects a source reference that is not a usable http url', () => {
    const seed = minimalSeed();
    const product = seed.products[0];

    expect(() =>
      buildSeedCatalog([
        {
          ...seed,
          products: [
            { ...product, dimensionsSource: { ...product.dimensionsSource, url: 'nope' } },
          ],
        },
      ])
    ).toThrow('dimensionsSource url is not a valid URL');

    expect(() =>
      buildSeedCatalog([
        {
          ...seed,
          products: [
            {
              ...product,
              dimensionsSource: { ...product.dimensionsSource, url: 'ftp://example.com/tile' },
            },
          ],
        },
      ])
    ).toThrow('dimensionsSource url must use http or https');
  });

  it('rejects a source on a hostname the brand did not declare', () => {
    const seed = minimalSeed();
    const product = seed.products[0];

    expect(() =>
      buildSeedCatalog([
        {
          ...seed,
          products: [
            {
              ...product,
              colorsSource: { ...product.colorsSource, url: 'https://elsewhere.example/tile' },
            },
          ],
        },
      ])
    ).toThrow('colorsSource url host "elsewhere.example" is not a declared source hostname');

    expect(() =>
      buildSeedCatalog([
        {
          ...seed,
          products: [
            {
              ...product,
              prices: [{ ...product.prices[0], sourceUrl: 'https://elsewhere.example/tile' }],
            },
          ],
        },
      ])
    ).toThrow('price "tile" sourceUrl host "elsewhere.example" is not a declared source hostname');
  });

  it('rejects a brand that declares no usable source hostnames', () => {
    expect(() => buildSeedCatalog([minimalSeed({ sourceHostnames: [] })])).toThrow(
      'declares no source hostnames'
    );

    expect(() => buildSeedCatalog([minimalSeed({ sourceHostnames: ['Example.COM'] })])).toThrow(
      'declares an invalid source hostname "Example.COM"'
    );
  });

  it('rejects a price whose color slug the product does not seed', () => {
    const seed = minimalSeed();
    const product = seed.products[0];
    const broken: RawManufacturerSeed = {
      ...seed,
      products: [{ ...product, prices: [{ ...product.prices[0], colorSlug: 'aubergine' }] }],
    };

    expect(() => buildSeedCatalog([broken])).toThrow(SeedCatalogError);
    expect(() => buildSeedCatalog([broken])).toThrow(
      'references color slug "aubergine", which the product does not seed'
    );
  });

  it('rejects two prices that quote the same color, sale unit, and pack size', () => {
    const seed = minimalSeed();
    const product = seed.products[0];
    const pack = {
      slug: 'pack-10',
      priceCents: 900,
      saleUnit: 'pack',
      packQuantity: 10,
      colorSlug: 'black',
      sourceUrl: 'https://example.com/tile',
      sourceKind: 'manufacturer-store',
      seller: 'TestCo',
    } as const;

    expect(() =>
      buildSeedCatalog([
        {
          ...seed,
          products: [
            { ...product, prices: [pack, { ...pack, slug: 'pack-10-again', priceCents: 950 }] },
          ],
        },
      ])
    ).toThrow('repeats the offer "testco|pack|10|testco-tile-black" across price slugs');
  });

  it('rejects a palette-wide price that overlaps a per-color price on the same basis', () => {
    const seed = minimalSeed();
    const product = seed.products[0];
    const pack: RawPriceSeed = {
      slug: 'pack-10-black',
      priceCents: 900,
      saleUnit: 'pack',
      packQuantity: 10,
      colorSlug: 'black',
      sourceUrl: 'https://example.com/tile',
      sourceKind: 'manufacturer-store',
      seller: 'TestCo',
    };
    const anyColor: RawPriceSeed = { ...pack, slug: 'pack-10-any', colorSlug: undefined };

    expect(() =>
      buildSeedCatalog([{ ...seed, products: [{ ...product, prices: [pack, anyColor] }] }])
    ).toThrow('repeats the offer "testco|pack|10|*" across price slugs');

    expect(() =>
      buildSeedCatalog([{ ...seed, products: [{ ...product, prices: [anyColor, pack] }] }])
    ).toThrow('repeats the offer "testco|pack|10|testco-tile-black" across price slugs');
  });

  it('accepts the same pack from two different sellers, which is a different offer', () => {
    const seed = minimalSeed();
    const product = seed.products[0];
    const pack: RawPriceSeed = {
      slug: 'pack-10-brand',
      priceCents: 900,
      saleUnit: 'pack',
      packQuantity: 10,
      colorSlug: 'black',
      sourceUrl: 'https://example.com/tile',
      sourceKind: 'manufacturer-store',
      seller: 'TestCo',
    };
    const reseller: RawPriceSeed = {
      ...pack,
      slug: 'pack-10-reseller',
      priceCents: 1050,
      sourceKind: 'retailer-listing',
      seller: 'Example Retailer',
    };

    const built = buildSeedCatalog([
      { ...seed, products: [{ ...product, prices: [pack, reseller] }] },
    ]);

    expect(built.products[0].prices.map((entry) => entry.seller)).toEqual([
      'TestCo',
      'Example Retailer',
    ]);
  });

  it('accepts the same pack size in two colors, which is a different offer', () => {
    const seed = minimalSeed();
    const product = seed.products[0];
    const pack = {
      slug: 'pack-10-black',
      priceCents: 900,
      saleUnit: 'pack',
      packQuantity: 10,
      colorSlug: 'black',
      sourceUrl: 'https://example.com/tile',
      sourceKind: 'manufacturer-store',
      seller: 'TestCo',
    } as const;

    const catalog = buildSeedCatalog([
      {
        ...seed,
        palette: {
          ...seed.palette,
          white: { name: 'White', vendorColorToken: 'white', approximateSwatchHex: '#FFFFFF' },
        },
        products: [
          {
            ...product,
            colorSlugs: ['black', 'white'],
            prices: [pack, { ...pack, slug: 'pack-10-white', colorSlug: 'white', priceCents: 950 }],
          },
        ],
      },
    ]);

    expect(catalog.products[0].prices.map((entry) => entry.price.colorId)).toEqual([
      'testco-tile-black',
      'testco-tile-white',
    ]);
  });

  it('rejects a price that names no seller', () => {
    const seed = minimalSeed();
    const product = seed.products[0];

    expect(() =>
      buildSeedCatalog([
        { ...seed, products: [{ ...product, prices: [{ ...product.prices[0], seller: '  ' }] }] },
      ])
    ).toThrow('price "tile" names no seller');
  });

  it('rejects published coverage that contradicts pack quantity times tile area', () => {
    const seed = minimalSeed();
    const product = seed.products[0];
    const price = {
      slug: 'pack-10',
      priceCents: 900,
      saleUnit: 'pack',
      packQuantity: 10,
      sourceUrl: 'https://example.com/tile',
      sourceKind: 'manufacturer-store',
      seller: 'TestCo',
    } as const;

    expect(() =>
      buildSeedCatalog([
        {
          ...seed,
          products: [{ ...product, prices: [{ ...price, publishedCoverageSquareFeet: 40 }] }],
        },
      ])
    ).toThrow('publishes 40 sq ft of coverage, but 10 tiles cover about 10.00 sq ft');

    expect(() =>
      buildSeedCatalog([
        {
          ...seed,
          products: [{ ...product, prices: [{ ...price, publishedCoverageSquareFeet: 0 }] }],
        },
      ])
    ).toThrow('publishedCoverageSquareFeet must be greater than zero');
  });

  it('rejects published coverage on a sale basis with no tile count to check it against', () => {
    const seed = minimalSeed();
    const product = seed.products[0];
    const price: RawPriceSeed = {
      slug: 'sqft',
      priceCents: 900,
      saleUnit: 'square-foot',
      publishedCoverageSquareFeet: 10,
      sourceUrl: 'https://example.com/tile',
      sourceKind: 'manufacturer-store',
      seller: 'TestCo',
    };

    expect(() =>
      buildSeedCatalog([{ ...seed, products: [{ ...product, prices: [price] }] }])
    ).toThrow('publishes coverage, but its "square-foot" sale basis has no tile count');
  });

  it('rejects a pack quantity that is off by one tile inside the coverage tolerance', () => {
    const seed = minimalSeed();
    const product = seed.products[0];
    const price: RawPriceSeed = {
      slug: 'pack-51',
      priceCents: 9000,
      saleUnit: 'pack',
      packQuantity: 51,
      publishedCoverageSquareFeet: 50,
      sourceUrl: 'https://example.com/tile',
      sourceKind: 'manufacturer-store',
      seller: 'TestCo',
    };

    expect(() =>
      buildSeedCatalog([{ ...seed, products: [{ ...product, prices: [price] }] }])
    ).toThrow('publishes 50 sq ft of coverage, but 51 tiles cover about 51.00 sq ft');
  });

  it('rejects an empty surface style label', () => {
    const seed = minimalSeed();
    const product = seed.products[0];

    expect(() =>
      buildSeedCatalog([
        {
          ...seed,
          products: [
            { ...product, surfaceStyle: { label: '   ', source: product.dimensionsSource } },
          ],
        },
      ])
    ).toThrow('surfaceStyle label is empty');
  });
});
