import { describe, expect, it } from 'vitest';
import {
  findSeedColor,
  findSeedProduct,
  listSeedPrices,
  listSeedProducts,
  SEED_CATALOG,
} from './seedCatalog';
import {
  CATALOG_CHECKED_DATE,
  DRAINABLE_CHECKED_DATE,
  tileAreaSquareFeet,
  type SeedPrice,
  type SeedProduct,
} from './seedTypes';
import { TECHFLOOR_SEED } from './manufacturers/techfloorSeed';
import { VEVOR_SEED } from './manufacturers/vevorSeed';

const VEVOR_12IN = 'vevor-garage-tiles-interlocking-12in';
const VEVOR_20IN = 'vevor-garage-floor-tiles-interlocking-20in';
const VEVOR_DRAINAGE_MAT = 'vevor-interlocking-drainage-mat-12in';
const TECHFLOOR_SOLID = 'techfloor-solid-raised-squares';

const VEVOR_BASE = 'https://www.vevor.com/garage-flooring-mat-c_11210/';

const VEVOR_12IN_URLS: Readonly<Record<string, string>> = {
  'pack-50-silver':
    `${VEVOR_BASE}vevor-garage-tiles-interlocking-12-x-12-x-0-53-inch-50-pack-garage-floor-` +
    'covering-tiles-non-slip-double-sided-texture-garage-flooring-tiles-for-garages-basements-' +
    'repair-shops-silver-p_010925341767',
  'pack-50-black':
    `${VEVOR_BASE}vevor-garage-tiles-interlocking-12-x-12-x-0-53-inch-50-pack-garage-floor-` +
    'covering-tiles-non-slip-double-sided-texture-garage-flooring-tiles-for-garages-basements-' +
    'repair-shops-black-p_010335944085',
  'pack-50-graphite-gray':
    `${VEVOR_BASE}vevor-garage-tiles-interlocking-12-x-12-x-0-53-inch-50-pack-garage-floor-` +
    'covering-tiles-non-slip-double-sided-texture-garage-flooring-tiles-for-garages-basements-' +
    'repair-shops-graphite-gray-p_010219078818',
  'pack-50-red':
    `${VEVOR_BASE}vevor-garage-tiles-interlocking-12-x-12-x-0-53-inch-50-pack-garage-floor-` +
    'covering-tiles-non-slip-double-sided-texture-garage-flooring-tiles-for-garages-basements-' +
    'repair-shops-red-p_010363750580',
  'pack-50-blue':
    `${VEVOR_BASE}vevor-garage-tiles-interlocking-12-x-12-x-0-53-inch-50-pack-garage-floor-` +
    'covering-tiles-non-slip-double-sided-texture-garage-flooring-tiles-for-garages-basements-' +
    'repair-shops-blue-p_010110062898',
  'pack-25-silver':
    `${VEVOR_BASE}vevor-garage-tiles-interlocking-12-x-12-x-0-53-inch-25-pack-garage-floor-` +
    'covering-tiles-non-slip-double-sided-texture-garage-flooring-tiles-for-garages-basements-' +
    'repair-shops-silver-p_010648194619',
  'pack-25-black':
    `${VEVOR_BASE}vevor-garage-tiles-interlocking-12-x-12-x-0-53-inch-25-pack-garage-floor-` +
    'covering-tiles-non-slip-double-sided-texture-garage-flooring-tiles-for-garages-basements-' +
    'repair-shops-black-p_010844551383',
  'pack-25-graphite-gray':
    `${VEVOR_BASE}vevor-garage-tiles-interlocking-12-x-12-x-0-53-inch-25-pack-garage-floor-` +
    'covering-tiles-non-slip-double-sided-texture-garage-flooring-tiles-for-garages-basements-' +
    'repair-shops-graphite-gray-p_010906864976',
  'pack-25-red':
    `${VEVOR_BASE}vevor-garage-tiles-interlocking-12-x-12-x-0-53-inch-25-pack-garage-floor-` +
    'covering-tiles-non-slip-double-sided-texture-garage-flooring-tiles-for-garages-basements-' +
    'repair-shops-red-p_010301887785',
  'pack-25-blue':
    `${VEVOR_BASE}vevor-garage-tiles-interlocking-12-x-12-x-0-53-inch-25-pack-garage-floor-` +
    'covering-tiles-non-slip-double-sided-texture-garage-flooring-tiles-for-garages-basements-' +
    'repair-shops-blue-p_010206380134',
};

const VEVOR_20IN_URLS: Readonly<Record<string, string>> = {
  'pack-16-black':
    `${VEVOR_BASE}vevor-garage-floor-tiles-interlocking-16-pack-20-2-x-20-2-x-0-2-in-` +
    'interlocking-modular-garage-flooring-tiles-diamond-plate-slip-resistant-pvc-mats-for-' +
    'workshop-warehouse-tool-room-black-p_010711653870',
  'pack-16-graphite-gray':
    `${VEVOR_BASE}vevor-garage-floor-tiles-interlocking-16-pack-20-2-x-20-2-x-0-2-in-` +
    'interlocking-modular-garage-flooring-tiles-diamond-plate-slip-resistant-pvc-mats-for-' +
    'workshop-warehouse-tool-room-graphite-gray-p_010781918137',
  'pack-8-black':
    `${VEVOR_BASE}vevor-garage-floor-tiles-interlocking-8-pack-20-2-x-20-2-x-0-2-in-interlocking-` +
    'modular-garage-flooring-tiles-diamond-plate-slip-resistant-pvc-mats-for-workshop-warehouse-' +
    'tool-room-black-p_010322292639',
  'pack-8-graphite-gray':
    `${VEVOR_BASE}vevor-garage-floor-tiles-interlocking-8-pack-20-2-x-20-2-x-0-2-in-interlocking-` +
    'modular-garage-flooring-tiles-diamond-plate-slip-resistant-pvc-mats-for-workshop-warehouse-' +
    'tool-room-graphite-gray-p_010674995402',
};

const TECHFLOOR_URL =
  'https://www.greatmats.com/garage-floor-tiles/techfloor-standard-solid-raised-squares.php';

describe('lower-cost third-party brands', () => {
  it('adds VEVOR and TechFloor alongside the premium brands, in catalog order', () => {
    expect(SEED_CATALOG.manufacturers.map((entry) => entry.manufacturer.name)).toEqual([
      'Swisstrax',
      'RaceDeck',
      'VEVOR',
      'TechFloor',
      'ModuTile',
      'Greatmats',
      'FlooringInc',
      'TrueLock',
    ]);
  });

  it('pins each brand to the hostnames it publishes on', () => {
    expect(VEVOR_SEED.sourceHostnames).toEqual(['www.vevor.com']);
    expect(TECHFLOOR_SEED.sourceHostnames).toEqual(['www.greatmats.com']);
  });

  it('disclaims affiliation without implying any dealer or partner relationship', () => {
    for (const seed of [VEVOR_SEED, TECHFLOOR_SEED]) {
      expect(seed.trademarkNotice).toContain('trademarks of their respective owners');
      expect(seed.trademarkNotice).toContain('not affiliated with');
      expect(seed.trademarkNotice).toContain('endorsed by');
      expect(seed.trademarkNotice).not.toMatch(/\bauthori[sz]ed (?:dealer|reseller|retailer)\b/i);
    }
  });
});

describe('VEVOR Garage Tiles Interlocking (12 in)', () => {
  it('keeps the published tile size, style, and material-free naming', () => {
    const product = findSeedProduct(VEVOR_12IN);

    expect(product?.product.name).toBe('Garage Tiles Interlocking (12 in)');
    expect(product?.product.dimensions).toEqual({
      widthInches: 12,
      lengthInches: 12,
      thicknessInches: 0.53,
    });
    expect(product?.surfaceStyle?.label).toBe('Non-Slip Double-Sided Texture');
    expect(product?.dimensionsSource.quote).toBe(
      'Sizes 12 x 12 x 0.53 inch / 305 x 305 x 13.4 mm; Thickness 0.53 inch / 13.4 mm'
    );
  });

  it('seeds exactly the five colors the listing offers, in listing order', () => {
    expect(findSeedProduct(VEVOR_12IN)?.colors.map((entry) => entry.color.name)).toEqual([
      'Graphite Gray',
      'Silver',
      'Red',
      'Black',
      'Blue',
    ]);
  });

  it('records the Graphite Gray spelling caveat rather than picking a name silently', () => {
    const color = findSeedColor(VEVOR_12IN, `${VEVOR_12IN}-graphite-gray`);

    expect(color?.color.name).toBe('Graphite Gray');
    expect(color?.vendorColorToken).toBe('Graphite Gray');
    expect(color?.note).toContain('Graphite Grey');
  });

  it.each([
    ['pack-50-silver', 8590, 50, 'silver', 50],
    ['pack-50-black', 8990, 50, 'black', 50],
    ['pack-50-graphite-gray', 8790, 50, 'graphite-gray', 50],
    ['pack-50-red', 8790, 50, 'red', 50],
    ['pack-50-blue', 8790, 50, 'blue', 50],
    ['pack-25-silver', 5090, 25, 'silver', 25],
    ['pack-25-black', 5190, 25, 'black', 25],
    ['pack-25-graphite-gray', 5190, 25, 'graphite-gray', 25],
    ['pack-25-red', 4790, 25, 'red', 25],
    ['pack-25-blue', 4690, 25, 'blue', 25],
  ])(
    'prices %s in whole cents against its own colour and pack listing',
    (slug, priceCents, packQuantity, colorSlug, coverage) => {
      const seedPrice = listSeedPrices(VEVOR_12IN).find(
        (entry) => entry.price.id === `${VEVOR_12IN}-${slug}`
      );

      expect(seedPrice?.price.priceCents).toBe(priceCents);
      expect(seedPrice?.price.saleUnit).toBe('pack');
      expect(seedPrice?.canBuyIndividually).toBe(false);
      expect(seedPrice?.price.packQuantity).toBe(packQuantity);
      expect(seedPrice?.tilesPerSaleUnit).toBe(packQuantity);
      expect(seedPrice?.price.colorId).toBe(`${VEVOR_12IN}-${colorSlug}`);
      expect(seedPrice?.publishedCoverageSquareFeet).toBe(coverage);
      expect(seedPrice?.seller).toBe('Vevor');
      expect(seedPrice?.sourceKind).toBe('manufacturer-store');
      expect(seedPrice?.basisLabel).toBe(`per pack of ${String(packQuantity)} tiles`);
      expect(seedPrice?.price.sourceUrl).toBe(VEVOR_12IN_URLS[slug]);
      expect(seedPrice?.price.checkedDate).toBe(CATALOG_CHECKED_DATE);
    }
  );

  it('prices every color at both pack sizes and nothing else', () => {
    expect(listSeedPrices(VEVOR_12IN).map((entry) => entry.price.id)).toEqual(
      Object.keys(VEVOR_12IN_URLS).map((slug) => `${VEVOR_12IN}-${slug}`)
    );
  });

  it('keeps the sale price the listing showed and notes the struck-through figure', () => {
    const silver = listSeedPrices(VEVOR_12IN).find(
      (entry) => entry.price.id === `${VEVOR_12IN}-pack-50-silver`
    );

    expect(silver?.isEstimate).toBe(true);
    expect(silver?.note).toContain('85.90');
    expect(silver?.note).toContain('105.99');
  });
});

describe('VEVOR Garage Floor Tiles Interlocking Diamond Plate (20.2 in)', () => {
  it('keeps the published tile size and diamond-plate style', () => {
    const product = findSeedProduct(VEVOR_20IN);

    expect(product?.product.dimensions).toEqual({
      widthInches: 20.2,
      lengthInches: 20.2,
      thicknessInches: 0.2,
    });
    expect(product?.surfaceStyle?.label).toBe('Diamond Plate');
    expect(product?.dimensionsSource.quote).toBe(
      'Item Dimensions 20.2 x 20.2 x 0.2 in / 513 x 513 x 5 mm'
    );
  });
});

describe('VEVOR Interlocking Drainage Mat (nominal 12 x 12 in)', () => {
  it('keeps the nominal dimensions, 15 mm thickness, PP open-grid style, and caveats', () => {
    const product = findSeedProduct(VEVOR_DRAINAGE_MAT);

    expect(product?.product.name).toBe('Interlocking Drainage Mat (nominal 12 x 12 in)');
    expect(product?.product.dimensions).toEqual({
      widthInches: 12,
      lengthInches: 12,
      thicknessInches: 0.59,
    });
    expect(product?.surfaceStyle?.label).toBe('Open Grid (PP)');
    expect(product?.surfaceStyle?.source.quote).toContain('PP material');
    expect(product?.dimensionsSource.quote).toContain('15 mm');
    expect(product?.plannerCaveat).toContain('11.81 in');
    expect(product?.plannerCaveat).toContain('daily vehicle support');
    expect(product?.plannerCaveat).toContain('no numeric load rating');
    expect(product?.drainage.evidence).toContain('water passes through the holes');
  });

  it('seeds only the two VEVOR-direct colors and their exact pack listings', () => {
    expect(findSeedProduct(VEVOR_DRAINAGE_MAT)?.colors.map((entry) => entry.color.name)).toEqual([
      'Light Gray',
      'Black',
    ]);

    expect(
      listSeedPrices(VEVOR_DRAINAGE_MAT).map((entry) => [
        entry.price.id,
        entry.price.priceCents,
        entry.price.packQuantity,
        entry.price.colorId,
        entry.sourceProductCode,
        entry.price.sourceUrl,
      ])
    ).toEqual([
      [
        `${VEVOR_DRAINAGE_MAT}-pack-12-light-gray`,
        2490,
        12,
        `${VEVOR_DRAINAGE_MAT}-light-gray`,
        'CKPSD12X12YC7FR5ZV0',
        'https://www.vevor.com/interlocking-rubber-tiles-c_11196/drainage-mat-modular-interlocking-cushion-12-x-12-drainage-floor-mat-p_010889415077',
      ],
      [
        `${VEVOR_DRAINAGE_MAT}-pack-24-black`,
        4190,
        24,
        `${VEVOR_DRAINAGE_MAT}-black`,
        'CKPSD12X12INM0OD3V0',
        'https://www.vevor.com/interlocking-rubber-tiles-c_11196/drainage-mat-modular-interlocking-mat-12-x-12-drainage-floor-tile-p_010263593576',
      ],
      [
        `${VEVOR_DRAINAGE_MAT}-pack-24-light-gray`,
        4390,
        24,
        `${VEVOR_DRAINAGE_MAT}-light-gray`,
        'CKPSD12X12IN7YEXHV0',
        'https://www.vevor.com/interlocking-rubber-tiles-c_11196/drainage-mat-drainage-floor-tile-12-x-12-modular-interlocking-cushion-p_010818413264',
      ],
      [
        `${VEVOR_DRAINAGE_MAT}-pack-40-black`,
        6290,
        40,
        `${VEVOR_DRAINAGE_MAT}-black`,
        'CKPSD12X12IN0TICAV0',
        'https://www.vevor.com/interlocking-rubber-tiles-c_11196/drainage-mat-drainage-floor-tile-12-x-12-modular-interlocking-mat-p_010465991958',
      ],
      [
        `${VEVOR_DRAINAGE_MAT}-pack-50-black`,
        7590,
        50,
        `${VEVOR_DRAINAGE_MAT}-black`,
        'CKPSD12X12INH8T9BV0',
        'https://www.vevor.com/interlocking-rubber-tiles-c_11196/drainage-mat-modular-floor-tile-12-x-12-interlocking-drainage-cushion-p_010585105882',
      ],
      [
        `${VEVOR_DRAINAGE_MAT}-pack-50-light-gray`,
        7690,
        50,
        `${VEVOR_DRAINAGE_MAT}-light-gray`,
        'CKPSD12X12INHIBDXV0',
        'https://www.vevor.com/interlocking-rubber-tiles-c_11196/drainage-mat-interlocking-drainage-cushion-12-x-12-modular-floor-tile-p_010236218415',
      ],
      [
        `${VEVOR_DRAINAGE_MAT}-pack-55-light-gray`,
        8190,
        55,
        `${VEVOR_DRAINAGE_MAT}-light-gray`,
        'CKPSD12X12IN4FGUZV0',
        'https://www.vevor.com/interlocking-rubber-tiles-c_11196/modular-drainage-mat-interlocking-floor-tile-12-x-12-drainage-cushion-p_010787249151',
      ],
      [
        `${VEVOR_DRAINAGE_MAT}-pack-55-black`,
        8290,
        55,
        `${VEVOR_DRAINAGE_MAT}-black`,
        'CKPSD12X12INHT62XV0',
        'https://www.vevor.com/interlocking-rubber-tiles-c_11196/interlocking-drainage-mat-modular-floor-tile-12-x-12-drainage-cushion-p_010434219578',
      ],
    ]);

    for (const price of listSeedPrices(VEVOR_DRAINAGE_MAT)) {
      expect(price.canBuyIndividually).toBe(false);
      expect(price.publishedCoverageSquareFeet).toBeUndefined();
      expect(price.price.checkedDate).toBe(DRAINABLE_CHECKED_DATE);
    }
  });
});

describe('VEVOR Garage Floor Tiles Interlocking Diamond Plate (20.2 in)', () => {
  it('omits the third color option, which the listing names two different ways', () => {
    const names = findSeedProduct(VEVOR_20IN)?.colors.map((entry) => entry.color.name);

    expect(names).toEqual(['Black', 'Graphite Gray']);
    expect(names).not.toContain('Silver');
    expect(names).not.toContain('Light Gray');
    expect(findSeedColor(VEVOR_20IN, `${VEVOR_20IN}-silver`)).toBeUndefined();
  });

  it('records no price from either page of the excluded color', () => {
    for (const seedPrice of listSeedPrices(VEVOR_20IN)) {
      expect(seedPrice.price.colorId).not.toBe(`${VEVOR_20IN}-silver`);
      expect(seedPrice.price.sourceUrl).not.toContain('light-gray');
      expect(seedPrice.price.sourceUrl).not.toContain('room-silver');
    }
  });

  it.each([
    ['pack-16-black', 9990, 16, 'black', 45.32],
    ['pack-16-graphite-gray', 9990, 16, 'graphite-gray', 45.32],
    ['pack-8-black', 5190, 8, 'black', 22.7],
    ['pack-8-graphite-gray', 5390, 8, 'graphite-gray', 22.7],
  ])(
    'prices %s in whole cents against its own colour and pack listing',
    (slug, priceCents, packQuantity, colorSlug, coverage) => {
      const seedPrice = listSeedPrices(VEVOR_20IN).find(
        (entry) => entry.price.id === `${VEVOR_20IN}-${slug}`
      );

      expect(seedPrice?.price.priceCents).toBe(priceCents);
      expect(seedPrice?.price.saleUnit).toBe('pack');
      expect(seedPrice?.canBuyIndividually).toBe(false);
      expect(seedPrice?.price.packQuantity).toBe(packQuantity);
      expect(seedPrice?.tilesPerSaleUnit).toBe(packQuantity);
      expect(seedPrice?.price.colorId).toBe(`${VEVOR_20IN}-${colorSlug}`);
      expect(seedPrice?.publishedCoverageSquareFeet).toBe(coverage);
      expect(seedPrice?.seller).toBe('Vevor');
      expect(seedPrice?.price.sourceUrl).toBe(VEVOR_20IN_URLS[slug]);
    }
  );

  it('prices both colors at both pack sizes and nothing else', () => {
    expect(listSeedPrices(VEVOR_20IN).map((entry) => entry.price.id)).toEqual(
      Object.keys(VEVOR_20IN_URLS).map((slug) => `${VEVOR_20IN}-${slug}`)
    );
  });
});

describe('TechFloor Solid Garage Tile with Raised Squares', () => {
  it('keeps the published tile size and raised-square style', () => {
    const product = findSeedProduct(TECHFLOOR_SOLID);

    expect(product?.product.name).toBe('Solid Garage Tile with Raised Squares');
    expect(product?.product.dimensions).toEqual({
      widthInches: 12,
      lengthInches: 12,
      thicknessInches: 0.25,
    });
    expect(product?.surfaceStyle?.label).toBe('Raised squares');
    expect(product?.surfaceStyle?.source.quote).toBe('Surface Finish Raised squares');
    expect(product?.dimensionsSource.quote).toBe(
      'Thickness 1/4 inch Width 1.00 feet Length 1.00 feet'
    );
  });

  it('seeds exactly the seven colors the listing publishes, spelling included', () => {
    expect(findSeedProduct(TECHFLOOR_SOLID)?.colors.map((entry) => entry.color.name)).toEqual([
      'Black',
      'Blue',
      'Dark Grey',
      'Grey',
      'Red',
      'Tan',
      'White',
    ]);
  });

  it('prices one carton of ten at the observed sale price, for every color', () => {
    const prices = listSeedPrices(TECHFLOOR_SOLID);

    expect(prices).toHaveLength(1);
    expect(prices[0]?.price.priceCents).toBe(2736);
    expect(prices[0]?.price.saleUnit).toBe('pack');
    expect(prices[0]?.canBuyIndividually).toBe(false);
    expect(prices[0]?.price.packQuantity).toBe(10);
    expect(prices[0]?.tilesPerSaleUnit).toBe(10);
    expect(prices[0]?.publishedCoverageSquareFeet).toBe(10);
    expect(prices[0]?.price.colorId).toBeUndefined();
    expect(prices[0]?.seller).toBe('Greatmats');
    expect(prices[0]?.sourceKind).toBe('retailer-listing');
    expect(prices[0]?.basisLabel).toBe('per pack of 10 tiles');
    expect(prices[0]?.price.sourceUrl).toBe(TECHFLOOR_URL);
  });

  it('records that the carton price was a discounted price', () => {
    expect(listSeedPrices(TECHFLOOR_SOLID)[0]?.note).toContain('34.20');
  });
});

describe('third-party seed hygiene', () => {
  const THIRD_PARTY_IDS = [VEVOR_12IN, VEVOR_20IN, VEVOR_DRAINAGE_MAT, TECHFLOOR_SOLID];

  it('gives every third-party price a distinct id and a distinct source url per offer', () => {
    for (const productId of THIRD_PARTY_IDS) {
      const prices = listSeedPrices(productId);
      const ids = prices.map((entry) => entry.price.id);
      const urls = prices.map((entry) => entry.price.sourceUrl);

      expect(new Set(ids).size).toBe(ids.length);
      expect(new Set(urls).size).toBe(urls.length);
    }
  });

  it('never repeats a color name inside one third-party product', () => {
    for (const productId of THIRD_PARTY_IDS) {
      const names = findSeedProduct(productId)?.colors.map((entry) => entry.color.name) ?? [];

      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('stamps every third-party source with its product research date', () => {
    for (const productId of THIRD_PARTY_IDS) {
      const product = findSeedProduct(productId);

      expect(product?.dimensionsSource.checkedDate).toBe(product?.checkedDate);
      expect(product?.colorsSource.checkedDate).toBe(product?.checkedDate);
      expect(product?.surfaceStyle?.source.checkedDate).toBe(product?.checkedDate);
    }
  });

  it('undercuts the cheapest full-price premium listing on every third-party offer', () => {
    const thirdPartyBrands = new Set([
      'vevor',
      'techfloor',
      'modutile',
      'greatmats',
      'flooringinc',
      'truelock',
    ]);
    // RaceDeck GarageFlow is sold from RaceDeck's Clearance category at 33% off MSRP and is
    // labelled light-duty residential. Holding a full carton of TechFloor against a clearance
    // run-out of a light-duty tile is not a like-for-like comparison, so it is not the baseline.
    const clearancePriceIds = new Set(['racedeck-garageflow-tile']);
    const premiumRates = listSeedProducts()
      .filter((product) => !thirdPartyBrands.has(product.product.manufacturerId))
      .flatMap((product) =>
        product.prices
          .filter((seedPrice) => !clearancePriceIds.has(seedPrice.price.id))
          .map((seedPrice) => perSquareFootCents(seedPrice, product))
      );
    const cheapestPremiumPerSquareFootCents = Math.min(...premiumRates);

    expect(cheapestPremiumPerSquareFootCents).toBeGreaterThan(0);
    expect(Number.isFinite(cheapestPremiumPerSquareFootCents)).toBe(true);

    for (const productId of THIRD_PARTY_IDS) {
      const product = findSeedProduct(productId);

      if (product === undefined) {
        throw new Error(`missing seeded product "${productId}"`);
      }

      for (const seedPrice of product.prices) {
        expect(perSquareFootCents(seedPrice, product)).toBeLessThan(
          cheapestPremiumPerSquareFootCents
        );
      }
    }
  });
});

/**
 * The seeded metadata has to be enough to reach a comparable rate for every sale basis, which is
 * the whole point of carrying `tilesPerSaleUnit` alongside the raw price.
 */
function perSquareFootCents(seedPrice: SeedPrice, product: SeedProduct): number {
  if (seedPrice.price.saleUnit === 'square-foot') {
    return seedPrice.price.priceCents;
  }

  const tiles = seedPrice.tilesPerSaleUnit;

  if (tiles === undefined) {
    throw new Error(`price "${seedPrice.price.id}" carries no tile count to normalize against`);
  }

  return seedPrice.price.priceCents / (tiles * tileAreaSquareFeet(product.product.dimensions));
}
