import { describe, expect, it } from 'vitest';
import {
  listDrainableCatalogEntries,
  listNonDrainableCatalogEntries,
} from '../components/catalog/catalogModel';
import { getRampUnavailableReason, listRampAccessoriesForProduct } from './accessories/rampSeed';
import {
  findSeedProduct,
  findSeedProductImage,
  isDrainableProduct,
  listDrainableSeedProducts,
  listNonDrainableSeedProducts,
  listSeedPrices,
  listSeedProducts,
  SEED_CATALOG,
} from './seedCatalog';
import {
  DRAINABLE_CHECKED_DATE,
  IMAGE_ATTRIBUTION_DISCLAIMER,
  PRODUCT_IMAGE_RIGHTS_BASIS,
} from './seedTypes';

/**
 * The exact planner catalog. This is the whole point of the drainable filter, so it is pinned by
 * value: adding or removing a product here has to be a deliberate edit, never a side effect.
 */
const DRAINABLE_PRODUCT_IDS: readonly string[] = [
  'swisstrax-ribtrax-pro',
  'racedeck-free-flow',
  'racedeck-free-flow-xlc',
  'racedeck-garageflow',
  'vevor-interlocking-drainage-mat-12in',
  'modutile-perforated-garage-tile',
  'greatmats-turbotile-perforated',
  'flooringinc-nitro-vented-12in',
  'flooringinc-vented-grid-loc-12in',
  'truelock-hd-ribbed-flow-through-12in',
];

/** Closed-surface products that stay seeded for comparison but must never reach the planner. */
const EXCLUDED_PRODUCT_IDS: readonly string[] = [
  'swisstrax-ribtrax-smooth-pro',
  'swisstrax-diamondtrax-12-series',
  'swisstrax-ribtrax-smooth-12-series',
  'racedeck-diamond',
  'racedeck-tuffshield',
  'racedeck-circletrac',
  'racedeck-xl',
  'vevor-garage-tiles-interlocking-12in',
  'vevor-garage-floor-tiles-interlocking-20in',
  'techfloor-solid-raised-squares',
];

describe('drainable product selection', () => {
  it('offers exactly the verified open-surface tiles, in catalog order', () => {
    expect(listDrainableSeedProducts().map((entry) => entry.product.id)).toEqual(
      DRAINABLE_PRODUCT_IDS
    );
  });

  it('keeps every solid, smooth, and closed-top product out of the planner', () => {
    expect(listNonDrainableSeedProducts().map((entry) => entry.product.id)).toEqual(
      EXCLUDED_PRODUCT_IDS
    );

    for (const productId of EXCLUDED_PRODUCT_IDS) {
      expect(isDrainableProduct(productId)).toBe(false);
      expect(findSeedProduct(productId)?.drainage.surfaceOpenness).toBe('closed');
    }
  });

  it('names the specific products that were investigated and rejected', () => {
    for (const productId of [
      'vevor-garage-tiles-interlocking-12in',
      'vevor-garage-floor-tiles-interlocking-20in',
      'techfloor-solid-raised-squares',
      'swisstrax-diamondtrax-12-series',
      'swisstrax-ribtrax-smooth-pro',
      'racedeck-diamond',
      'racedeck-tuffshield',
      'racedeck-circletrac',
      'racedeck-xl',
    ]) {
      expect(DRAINABLE_PRODUCT_IDS).not.toContain(productId);
    }
  });

  it('accounts for every seeded product exactly once', () => {
    expect([...DRAINABLE_PRODUCT_IDS, ...EXCLUDED_PRODUCT_IDS].sort()).toEqual(
      listSeedProducts()
        .map((entry) => entry.product.id)
        .sort()
    );
  });

  it('backs every classification with vendor wording from the brand-declared hostnames', () => {
    for (const product of listSeedProducts()) {
      const manufacturer = SEED_CATALOG.manufacturers.find(
        (entry) => entry.manufacturer.id === product.product.manufacturerId
      );

      expect(product.drainage.evidence.length).toBeGreaterThan(20);
      expect(product.drainage.isDrainable).toBe(
        product.drainage.surfaceOpenness === 'open-drainable'
      );
      expect(manufacturer?.sourceHostnames).toContain(
        new URL(product.drainage.source.url).hostname
      );
      expect(product.drainage.source.quote?.length).toBeGreaterThan(0);
    }
  });

  it('exposes the same filter through the catalog view model the planner reads', () => {
    expect(listDrainableCatalogEntries().map((entry) => entry.seedProduct.product.id)).toEqual(
      DRAINABLE_PRODUCT_IDS
    );
    expect(listNonDrainableCatalogEntries().map((entry) => entry.seedProduct.product.id)).toEqual(
      EXCLUDED_PRODUCT_IDS
    );
  });

  it('provides either verified compatible ramps or an explicit unavailable reason', () => {
    for (const productId of DRAINABLE_PRODUCT_IDS) {
      const ramps = listRampAccessoriesForProduct(productId);
      const unavailableReason = getRampUnavailableReason(productId);

      expect(ramps.length > 0 || unavailableReason !== undefined).toBe(true);
    }

    expect(
      listRampAccessoriesForProduct('vevor-interlocking-drainage-mat-12in').map(
        (accessory) => accessory.id
      )
    ).toContain('vevor-drainage-mat-straight-transition-edge-kit');
    expect(getRampUnavailableReason('vevor-interlocking-drainage-mat-12in')).toBeUndefined();
  });
});

describe('new drainable seed facts', () => {
  it('seeds RaceDeck Free-Flow XLC from its published spec block, conflict recorded', () => {
    const product = findSeedProduct('racedeck-free-flow-xlc');

    expect(product?.product.dimensions).toEqual({
      widthInches: 18,
      lengthInches: 18,
      thicknessInches: 0.625,
    });
    expect(product?.colors).toHaveLength(15);
    expect(product?.surfaceStyle?.label).toBe('Dual-Traction Tread');

    const [price] = listSeedPrices('racedeck-free-flow-xlc');

    expect(price?.price.priceCents).toBe(1123);
    expect(price?.basisLabel).toBe('per tile');
    expect(price?.canBuyIndividually).toBe(true);
    expect(price?.note).toContain('0.625');
    expect(price?.note).toContain('$4.99 sqft');
    expect(price?.note).toContain('clearance');
  });

  it('seeds RaceDeck GarageFlow with its clearance and light-duty caveats', () => {
    const product = findSeedProduct('racedeck-garageflow');

    expect(product?.product.dimensions).toEqual({
      widthInches: 12,
      lengthInches: 12,
      thicknessInches: 0.5,
    });
    expect(product?.colors.map((entry) => entry.color.name)).toEqual([
      'Black',
      'Bright Blue',
      'Gray',
      'Red',
    ]);

    const [price] = listSeedPrices('racedeck-garageflow');

    expect(price?.price.priceCents).toBe(269);
    expect(price?.canBuyIndividually).toBe(true);
    expect(price?.note).toContain('3.99');
    expect(price?.note).toContain('Clearance');
    expect(price?.note).toContain('light-duty');
  });

  it('seeds the ModuTile perforated tile at its sale price with the regular price recorded', () => {
    const product = findSeedProduct('modutile-perforated-garage-tile');

    expect(product?.surfaceStyle?.label).toBe('Mesh - Perforated w/ Anti-Slip Resistance');
    expect(product?.colors).toHaveLength(11);

    const [price] = listSeedPrices('modutile-perforated-garage-tile');

    expect(price?.price.priceCents).toBe(198);
    expect(price?.basisLabel).toBe('per tile');
    expect(price?.canBuyIndividually).toBe(true);
    expect(price?.publishedCoverageSquareFeet).toBe(1);
    expect(price?.note).toContain('2.59');
    expect(price?.note).toContain('per square foot');
  });

  it('seeds the Greatmats TurboTile price, sale basis, and three published colors', () => {
    const product = findSeedProduct('greatmats-turbotile-perforated');

    expect(product?.dimensionsSource.kind).toBe('retailer-listing');
    expect(product?.product.dimensions).toEqual({
      widthInches: 12.12,
      lengthInches: 12.12,
      thicknessInches: 0.625,
    });

    expect(product?.colors.map((entry) => entry.color.name)).toEqual(['Black', 'Gray', 'Red']);
    expect(product?.surfaceStyle?.label).toBe('Ribbed Drainage');

    const [price] = listSeedPrices('greatmats-turbotile-perforated');

    expect(price?.price.priceCents).toBe(415);
    expect(price?.basisLabel).toBe('per tile');
    expect(price?.canBuyIndividually).toBe(true);
    expect(price?.seller).toBe('Greatmats');
    expect(price?.note).toContain('5.45');
    expect(price?.note).toContain('4.07 per square foot');
    expect(price?.note).toContain('not UV-treated');
  });

  it('seeds both FlooringInc vented products with their color-specific and shared prices', () => {
    const nitro = findSeedProduct('flooringinc-nitro-vented-12in');
    const gridLoc = findSeedProduct('flooringinc-vented-grid-loc-12in');

    expect(nitro?.colors).toHaveLength(8);
    expect(nitro?.plannerCaveat).toMatch(/not car-jack approved/i);
    expect(
      listSeedPrices('flooringinc-nitro-vented-12in').map((price) => price.price.priceCents)
    ).toEqual([225, 249, 249, 249, 249, 199, 249, 249]);

    expect(gridLoc?.colors).toHaveLength(12);
    expect(gridLoc?.plannerCaveat).toMatch(/conflicting UV guidance/i);
    expect(listSeedPrices('flooringinc-vented-grid-loc-12in')).toMatchObject([
      {
        price: { priceCents: 449, saleUnit: 'tile' },
        seller: 'FlooringInc',
        publishedCoverageSquareFeet: 1,
      },
    ]);
  });

  it('seeds TrueLock as a private-label flow-through alternative with a verified edge', () => {
    const product = findSeedProduct('truelock-hd-ribbed-flow-through-12in');

    expect(product?.product.dimensions).toEqual({
      widthInches: 12,
      lengthInches: 12,
      thicknessInches: 0.5,
    });
    expect(product?.colors).toHaveLength(10);
    expect(product?.drainage.source.quote).toMatch(/vented on top/i);
    expect(product?.plannerCaveat).toMatch(/private-label/i);
    expect(listSeedPrices('truelock-hd-ribbed-flow-through-12in')).toMatchObject([
      {
        price: { priceCents: 349, saleUnit: 'tile' },
        seller: 'Garage Flooring LLC',
      },
    ]);
    expect(
      listRampAccessoriesForProduct('truelock-hd-ribbed-flow-through-12in').map(
        (accessory) => accessory.id
      )
    ).toEqual(['truelock-hd-hdxt-female-edge']);
  });

  it('seeds the VEVOR open-grid drainage mat with its evidence and limitations', () => {
    const product = findSeedProduct('vevor-interlocking-drainage-mat-12in');

    expect(product?.product.dimensions).toEqual({
      widthInches: 12,
      lengthInches: 12,
      thicknessInches: 0.59,
    });
    expect(product?.surfaceStyle?.label).toBe('Open Grid (PP)');
    expect(product?.drainage.evidence).toMatch(/water passes through the holes/i);
    expect(product?.plannerCaveat).toMatch(/no numeric load rating/i);
    expect(product?.plannerCaveat).toMatch(/11\.81 in/i);
    expect(
      listSeedPrices('vevor-interlocking-drainage-mat-12in').every(
        (price) =>
          price.canBuyIndividually === false && price.publishedCoverageSquareFeet === undefined
      )
    ).toBe(true);
  });

  it('re-reads Free-Flow against its current page rather than the retired URL', () => {
    const product = findSeedProduct('racedeck-free-flow');

    expect(product?.dimensionsSource.url).toBe(
      'https://racedeck.com/racedeck-garage-floors-and-tiles/free-flow/'
    );
    expect(product?.dimensionsSource.url).not.toContain('racedeck-free-flow');
    expect(listSeedPrices('racedeck-free-flow')[0]?.note).toContain('2026-07-29');
    expect(listSeedPrices('racedeck-free-flow')[0]?.note).toContain('Bright Blue');
  });

  it('ties each new drainable tile to the ramp its vendor publishes for it', () => {
    expect(
      listRampAccessoriesForProduct('racedeck-free-flow-xlc').map((entry) => entry.id)
    ).toEqual(['racedeck-female-edge-18']);
    expect(listRampAccessoriesForProduct('racedeck-garageflow').map((entry) => entry.id)).toEqual([
      'racedeck-female-edge-12',
    ]);
    expect(
      listRampAccessoriesForProduct('modutile-perforated-garage-tile').map((entry) => entry.id)
    ).toEqual(['modutile-ramp-edge-with-loops-12']);
    expect(
      listRampAccessoriesForProduct('greatmats-turbotile-perforated').map((entry) => entry.id)
    ).toEqual(['greatmats-click-tile-border-ramp-female']);
  });
});

describe('product image metadata', () => {
  it('carries a complete, attributed image record for every drainable product', () => {
    for (const productId of DRAINABLE_PRODUCT_IDS) {
      const image = findSeedProductImage(productId);
      const product = findSeedProduct(productId);

      expect(image).toBeDefined();
      expect(image?.rightsBasis).toBe(PRODUCT_IMAGE_RIGHTS_BASIS);
      expect(image?.checkedDate).toBe(product?.checkedDate);
      expect(image?.attributionText).toMatch(/Not affiliated\.$/);
      expect(image?.attributionText).toContain('(c)');
      expect(image?.altText.length).toBeGreaterThan(30);
      expect(image?.altText).not.toBe(product?.product.name);
      expect(['high', 'medium', 'unknown']).toContain(image?.hotlinkStability);
    }
  });

  it('records the drainable research date on the images read in that pass', () => {
    for (const productId of [
      'racedeck-free-flow-xlc',
      'racedeck-garageflow',
      'modutile-perforated-garage-tile',
      'greatmats-turbotile-perforated',
      'vevor-interlocking-drainage-mat-12in',
    ]) {
      expect(findSeedProductImage(productId)?.checkedDate).toBe(DRAINABLE_CHECKED_DATE);
    }
  });

  it('loads every image over https from a hostname the brand declares for images', () => {
    for (const manufacturer of SEED_CATALOG.manufacturers) {
      for (const product of manufacturer.products) {
        if (product.image === undefined) {
          continue;
        }

        const imageUrl = new URL(product.image.imageUrl);
        const pageUrl = new URL(product.image.sourcePageUrl);

        expect(imageUrl.protocol).toBe('https:');
        expect(manufacturer.imageHostnames).toContain(imageUrl.hostname);
        expect(manufacturer.sourceHostnames).toContain(pageUrl.hostname);
      }
    }
  });

  it('records a caveat wherever the image URL is less than fully stable', () => {
    for (const product of listSeedProducts()) {
      if (product.image === undefined || product.image.hotlinkStability === 'high') {
        continue;
      }

      expect(product.image.caveat?.length).toBeGreaterThan(0);
    }

    expect(findSeedProductImage('greatmats-turbotile-perforated')?.caveat).toContain('406');
    expect(findSeedProductImage('vevor-interlocking-drainage-mat-12in')).toMatchObject({
      hotlinkStability: 'medium',
    });
    expect(findSeedProductImage('vevor-interlocking-drainage-mat-12in')?.caveat).toMatch(
      /timestamp and path version/i
    );
    expect(findSeedProductImage('swisstrax-ribtrax-pro')?.hotlinkStability).toBe('high');
    expect(findSeedProductImage('swisstrax-ribtrax-pro')?.caveat).toContain('?v=');
  });

  it('never attaches a photo to a product the planner does not offer', () => {
    for (const productId of EXCLUDED_PRODUCT_IDS) {
      expect(findSeedProductImage(productId)).toBeUndefined();
    }
  });

  it('states in the shipped disclaimer that photos are remote and never exported', () => {
    expect(IMAGE_ATTRIBUTION_DISCLAIMER).toContain('loaded directly from the seller');
    expect(IMAGE_ATTRIBUTION_DISCLAIMER).toContain('never copied into saved designs or exports');
    expect(IMAGE_ATTRIBUTION_DISCLAIMER).toContain('links back');
  });
});
