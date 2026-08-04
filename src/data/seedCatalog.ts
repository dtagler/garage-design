import {
  parseCatalogProduct,
  parseManufacturer,
  parseProductColor,
  parseProductPrice,
  type CatalogProduct,
  type ManufacturerId,
  type ProductColorId,
  type ProductId,
  type ProductPrice,
  type SaleUnit,
} from '../domain/catalog';
import { GREATMATS_SEED } from './manufacturers/greatmatsSeed';
import { FLOORINGINC_SEED } from './manufacturers/flooringIncSeed';
import { TRUELOCK_SEED } from './manufacturers/trueLockSeed';
import { MODUTILE_SEED } from './manufacturers/modutileSeed';
import { RACEDECK_SEED } from './manufacturers/racedeckSeed';
import {
  CATALOG_CHECKED_DATE,
  CATALOG_CHECKED_DATES,
  CATALOG_CURRENCY,
  describePriceBasis,
  PRODUCT_IMAGE_RIGHTS_BASIS,
  tileAreaSquareFeet,
  tilesPerSaleUnit,
  type ProductImageRef,
  type RawManufacturerSeed,
  type RawProductSeed,
  type SeedCatalog,
  type SeedColor,
  type SeedDrainage,
  type SeedManufacturer,
  type SeedPrice,
  type SeedProduct,
  type SourceReference,
} from './seedTypes';
import { SWISSTRAX_SEED } from './manufacturers/swisstraxSeed';
import { TECHFLOOR_SEED } from './manufacturers/techfloorSeed';
import { VEVOR_SEED } from './manufacturers/vevorSeed';

/**
 * Published pack coverage and tile-face area never agree to the last decimal, because vendors round
 * metric conversions. Two percent absorbs that rounding, and the check also floors the allowance at
 * half a tile so a large pack cannot hide an off-by-one pack quantity inside the percentage.
 */
const COVERAGE_TOLERANCE = 0.02;

/**
 * Raised when the committed seed data is internally inconsistent, for example a duplicate product
 * id or a color slug with no palette entry. Field-level problems raise `DomainValidationError`
 * from the domain parsers instead.
 */
export class SeedCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SeedCatalogError';
  }
}

export function buildSeedCatalog(seeds: readonly RawManufacturerSeed[]): SeedCatalog {
  const seenManufacturerIds = new Set<ManufacturerId>();
  const seenProductIds = new Set<ProductId>();
  const manufacturers = seeds.map((seed) =>
    buildSeedManufacturer(seed, seenManufacturerIds, seenProductIds)
  );
  const products = manufacturers.flatMap((manufacturer) => manufacturer.products);

  return {
    checkedDate: CATALOG_CHECKED_DATE,
    latestCheckedDate: products.reduce(
      (latest, product) => (product.checkedDate > latest ? product.checkedDate : latest),
      CATALOG_CHECKED_DATE
    ),
    currency: CATALOG_CURRENCY,
    manufacturers,
    products,
  };
}

/**
 * The committed catalog, built and validated when this module is first evaluated. Bundlers do not
 * run module code, so a malformed seed surfaces in the unit tests or on the first import at
 * runtime rather than during `vite build`; `seedCatalog.test.ts` builds it explicitly for that
 * reason.
 */
export const SEED_CATALOG: SeedCatalog = buildSeedCatalog([
  SWISSTRAX_SEED,
  RACEDECK_SEED,
  VEVOR_SEED,
  TECHFLOOR_SEED,
  MODUTILE_SEED,
  GREATMATS_SEED,
  FLOORINGINC_SEED,
  TRUELOCK_SEED,
]);

const PRODUCTS_BY_ID: ReadonlyMap<ProductId, SeedProduct> = new Map(
  SEED_CATALOG.products.map((product) => [product.product.id, product])
);

export function listSeedProducts(): readonly SeedProduct[] {
  return SEED_CATALOG.products;
}

/**
 * The only products the planner may offer.
 *
 * This project plans garages that get wet, so a tile qualifies only when the vendor publishes an
 * open, perforated, or self-draining *top* surface. Everything else stays in the catalog with its
 * `closed` classification intact - the historical seeds are still what the comparison and
 * reference-design code is tested against - but it is never a planner choice.
 */
export function listDrainableSeedProducts(): readonly SeedProduct[] {
  return SEED_CATALOG.products.filter((product) => product.drainage.isDrainable);
}

/** Products deliberately kept out of the planner, in catalog order, with the reason recorded. */
export function listNonDrainableSeedProducts(): readonly SeedProduct[] {
  return SEED_CATALOG.products.filter((product) => !product.drainage.isDrainable);
}

export function isDrainableProduct(productId: ProductId): boolean {
  return findSeedProduct(productId)?.drainage.isDrainable ?? false;
}

export function findSeedProduct(productId: ProductId): SeedProduct | undefined {
  return PRODUCTS_BY_ID.get(productId);
}

/** The remote photo for a product, when one was verified. Display only; never exported. */
export function findSeedProductImage(productId: ProductId): ProductImageRef | undefined {
  return findSeedProduct(productId)?.image;
}

export function findSeedColor(
  productId: ProductId,
  colorId: ProductColorId
): SeedColor | undefined {
  return findSeedProduct(productId)?.colors.find((color) => color.color.id === colorId);
}

/** Every seeded price that applies to a product, in the order the seed file lists them. */
export function listSeedPrices(productId: ProductId): readonly SeedPrice[] {
  return findSeedProduct(productId)?.prices ?? [];
}

function buildSeedManufacturer(
  seed: RawManufacturerSeed,
  seenManufacturerIds: Set<ManufacturerId>,
  seenProductIds: Set<ProductId>
): SeedManufacturer {
  const manufacturer = parseManufacturer({ id: seed.id, name: seed.name });

  if (seenManufacturerIds.has(manufacturer.id)) {
    throw new SeedCatalogError(`duplicate manufacturer id "${manufacturer.id}"`);
  }
  seenManufacturerIds.add(manufacturer.id);

  if (seed.products.length === 0) {
    throw new SeedCatalogError(`manufacturer "${seed.id}" seeds no products`);
  }

  const sourceHostnames = checkSourceHostnames(seed);
  const imageHostnames = checkImageHostnames(seed, sourceHostnames);

  return {
    manufacturer,
    trademarkNotice: seed.trademarkNotice,
    sourceHostnames,
    imageHostnames,
    products: seed.products.map((product) =>
      buildSeedProduct(seed, sourceHostnames, imageHostnames, product, seenProductIds)
    ),
  };
}

/**
 * A brand's sources have to be pinned to the hostnames its facts may be cited from, so a seed can
 * never quietly start citing an unrelated site. For a brand that only publishes through a reseller
 * that hostname is the reseller's, which is why the list lives on the seed rather than being
 * derived from the brand name.
 */
function checkSourceHostnames(seed: RawManufacturerSeed): readonly string[] {
  if (seed.sourceHostnames.length === 0) {
    throw new SeedCatalogError(`manufacturer "${seed.id}" declares no source hostnames`);
  }

  for (const hostname of seed.sourceHostnames) {
    if (hostname !== hostname.toLowerCase() || !/^[a-z0-9.-]+$/.test(hostname)) {
      throw new SeedCatalogError(
        `manufacturer "${seed.id}" declares an invalid source hostname "${hostname}"`
      );
    }
  }

  return seed.sourceHostnames;
}

/**
 * Images are pinned separately because a store's photos usually live on a CDN the facts never
 * come from - Swisstrax publishes specs on `store.swisstrax.com` and images on `cdn.shopify.com`.
 * Widening the image allowlist must not widen the allowlist a *fact* may be cited from.
 */
function checkImageHostnames(
  seed: RawManufacturerSeed,
  sourceHostnames: readonly string[]
): readonly string[] {
  const hostnames = seed.imageHostnames ?? sourceHostnames;

  for (const hostname of hostnames) {
    if (hostname !== hostname.toLowerCase() || !/^[a-z0-9.-]+$/.test(hostname)) {
      throw new SeedCatalogError(
        `manufacturer "${seed.id}" declares an invalid image hostname "${hostname}"`
      );
    }
  }

  return hostnames;
}

function buildSeedProduct(
  manufacturerSeed: RawManufacturerSeed,
  sourceHostnames: readonly string[],
  imageHostnames: readonly string[],
  seed: RawProductSeed,
  seenProductIds: Set<ProductId>
): SeedProduct {
  const product = parseCatalogProduct({
    id: seed.id,
    manufacturerId: manufacturerSeed.id,
    name: seed.name,
    dimensions: seed.dimensions,
    rotationRule: seed.rotationRule,
  });

  if (seenProductIds.has(product.id)) {
    throw new SeedCatalogError(`duplicate product id "${product.id}"`);
  }
  seenProductIds.add(product.id);

  const checkedDate = checkCheckedDate(
    seed.checkedDate ?? CATALOG_CHECKED_DATE,
    product.id,
    'checkedDate'
  );
  const colors = buildSeedColors(manufacturerSeed, seed, product);

  return {
    product,
    checkedDate,
    dimensionsSource: checkSourceReference(
      seed.dimensionsSource,
      product.id,
      'dimensionsSource',
      sourceHostnames,
      checkedDate
    ),
    colorsSource: checkSourceReference(
      seed.colorsSource,
      product.id,
      'colorsSource',
      sourceHostnames,
      checkedDate
    ),
    rotationRuleRationale: seed.rotationRuleRationale,
    ...(seed.surfaceStyle === undefined
      ? {}
      : {
          surfaceStyle: {
            label: checkSurfaceStyleLabel(seed.surfaceStyle.label, product.id),
            source: checkSourceReference(
              seed.surfaceStyle.source,
              product.id,
              'surfaceStyle.source',
              sourceHostnames,
              checkedDate
            ),
          },
        }),
    drainage: checkDrainage(seed.drainage, product.id, sourceHostnames, checkedDate),
    ...(seed.plannerCaveat === undefined
      ? {}
      : { plannerCaveat: checkPlannerCaveat(seed.plannerCaveat, product.id) }),
    ...(seed.image === undefined
      ? {}
      : {
          image: checkProductImage(
            seed.image,
            product.id,
            sourceHostnames,
            imageHostnames,
            checkedDate
          ),
        }),
    colors,
    prices: buildSeedPrices(seed, product, colors, sourceHostnames, checkedDate),
  };
}

function checkPlannerCaveat(caveat: string, productId: ProductId): string {
  if (caveat.trim().length === 0) {
    throw new SeedCatalogError(`product "${productId}" plannerCaveat is empty`);
  }

  return caveat;
}

function checkSurfaceStyleLabel(label: string, productId: ProductId): string {
  if (label.trim().length === 0) {
    throw new SeedCatalogError(`product "${productId}" surfaceStyle label is empty`);
  }

  return label;
}

/**
 * Drainability decides whether a product reaches the planner at all, so it may never be an
 * unsupported opinion: the classification and the vendor wording behind it are validated
 * together, and `isDrainable` has to agree with `surfaceOpenness`.
 */
function checkDrainage(
  drainage: SeedDrainage,
  productId: ProductId,
  sourceHostnames: readonly string[],
  checkedDate: string
): SeedDrainage {
  if (drainage.isDrainable !== (drainage.surfaceOpenness === 'open-drainable')) {
    throw new SeedCatalogError(
      `product "${productId}" marks isDrainable ${String(drainage.isDrainable)} against surface ` +
        `openness "${drainage.surfaceOpenness}"`
    );
  }

  if (drainage.evidence.trim().length === 0) {
    throw new SeedCatalogError(`product "${productId}" records no drainage evidence`);
  }

  return {
    ...drainage,
    source: checkSourceReference(
      drainage.source,
      productId,
      'drainage.source',
      sourceHostnames,
      checkedDate
    ),
  };
}

/**
 * An image record is a promise about someone else's property, so every part of it is checked: the
 * bytes stay on the seller's host, the attribution and the link back to the seller's page are
 * present, and the alt text is a real description rather than a repeat of the product name.
 */
function checkProductImage(
  image: ProductImageRef,
  productId: ProductId,
  sourceHostnames: readonly string[],
  imageHostnames: readonly string[],
  checkedDate: string
): ProductImageRef {
  checkSourceUrl(image.imageUrl, productId, 'image.imageUrl', imageHostnames);
  checkSourceUrl(image.sourcePageUrl, productId, 'image.sourcePageUrl', sourceHostnames);

  if (new URL(image.imageUrl).protocol !== 'https:') {
    throw new SeedCatalogError(`product "${productId}" image.imageUrl must use https`);
  }

  const rightsBasis: string = image.rightsBasis;
  if (rightsBasis !== PRODUCT_IMAGE_RIGHTS_BASIS) {
    throw new SeedCatalogError(
      `product "${productId}" image declares rights basis "${rightsBasis}"; the only basis this ` +
        `project uses is "${PRODUCT_IMAGE_RIGHTS_BASIS}"`
    );
  }

  if (image.attributionText.trim().length === 0) {
    throw new SeedCatalogError(`product "${productId}" image carries no attribution text`);
  }

  if (image.altText.trim().length < 12) {
    throw new SeedCatalogError(
      `product "${productId}" image alt text must describe what the photo shows`
    );
  }

  checkCheckedDate(image.checkedDate, productId, 'image.checkedDate');

  if (image.checkedDate !== checkedDate) {
    throw new SeedCatalogError(
      `product "${productId}" image is dated "${image.checkedDate}", but the product is dated ` +
        `"${checkedDate}"`
    );
  }

  return image;
}

function checkCheckedDate(checkedDate: string, productId: ProductId, field: string): string {
  if (!CATALOG_CHECKED_DATES.includes(checkedDate)) {
    throw new SeedCatalogError(
      `product "${productId}" ${field} is dated "${checkedDate}", which is not one of the ` +
        `catalog research dates ${CATALOG_CHECKED_DATES.join(', ')}`
    );
  }

  return checkedDate;
}

/**
 * Source references are metadata rather than domain records, so the domain parsers never see them.
 * They still have to be a well-formed link on one of the brand's declared source hostnames, stamped
 * with the research date its own product carries.
 */
function checkSourceReference(
  source: SourceReference,
  productId: ProductId,
  field: string,
  sourceHostnames: readonly string[],
  checkedDate: string
): SourceReference {
  checkSourceUrl(source.url, productId, `${field} url`, sourceHostnames);

  if (source.checkedDate !== checkedDate) {
    throw new SeedCatalogError(
      `product "${productId}" ${field} is dated "${source.checkedDate}", but the product is ` +
        `dated "${checkedDate}"`
    );
  }

  return source;
}

function checkSourceUrl(
  rawUrl: string,
  productId: ProductId,
  field: string,
  sourceHostnames: readonly string[]
): void {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new SeedCatalogError(`product "${productId}" ${field} is not a valid URL`);
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new SeedCatalogError(`product "${productId}" ${field} must use http or https`);
  }

  if (!sourceHostnames.includes(url.hostname)) {
    throw new SeedCatalogError(
      `product "${productId}" ${field} host "${url.hostname}" is not a declared source hostname`
    );
  }
}

function buildSeedColors(
  manufacturerSeed: RawManufacturerSeed,
  seed: RawProductSeed,
  product: CatalogProduct
): readonly SeedColor[] {
  if (seed.colorSlugs.length === 0) {
    throw new SeedCatalogError(`product "${product.id}" seeds no colors`);
  }

  const seenSlugs = new Set<string>();

  return seed.colorSlugs.map((slug) => {
    if (seenSlugs.has(slug)) {
      throw new SeedCatalogError(`product "${product.id}" repeats color slug "${slug}"`);
    }
    seenSlugs.add(slug);

    const entry = manufacturerSeed.palette[slug];
    if (!Object.hasOwn(manufacturerSeed.palette, slug) || entry === undefined) {
      throw new SeedCatalogError(
        `product "${product.id}" references color slug "${slug}", which is missing from the ` +
          `"${manufacturerSeed.id}" palette`
      );
    }

    return {
      color: parseProductColor({
        id: `${product.id}-${slug}`,
        productId: product.id,
        name: entry.name,
        swatchHex: entry.approximateSwatchHex,
      }),
      swatchIsApproximate: true,
      vendorColorToken: entry.vendorColorToken,
      ...(entry.note === undefined ? {} : { note: entry.note }),
    };
  });
}

function buildSeedPrices(
  seed: RawProductSeed,
  product: CatalogProduct,
  colors: readonly SeedColor[],
  sourceHostnames: readonly string[],
  checkedDate: string
): readonly SeedPrice[] {
  if (seed.prices.length === 0) {
    throw new SeedCatalogError(`product "${product.id}" seeds no prices`);
  }

  const colorIds = new Set(colors.map((color) => color.color.id));
  const seenSlugs = new Set<string>();
  const seenOffers = new Map<string, Set<string>>();

  return seed.prices.map((rawPrice) => {
    if (seenSlugs.has(rawPrice.slug)) {
      throw new SeedCatalogError(`product "${product.id}" repeats price slug "${rawPrice.slug}"`);
    }
    seenSlugs.add(rawPrice.slug);

    if (rawPrice.seller.trim().length === 0) {
      throw new SeedCatalogError(
        `product "${product.id}" price "${rawPrice.slug}" names no seller`
      );
    }

    const colorId = resolvePriceColorId(rawPrice.colorSlug, colorIds, product, rawPrice.slug);

    checkSourceUrl(
      rawPrice.sourceUrl,
      product.id,
      `price "${rawPrice.slug}" sourceUrl`,
      sourceHostnames
    );

    const price = parseProductPrice({
      id: `${product.id}-${rawPrice.slug}`,
      productId: product.id,
      ...(colorId === undefined ? {} : { colorId }),
      priceCents: rawPrice.priceCents,
      saleUnit: rawPrice.saleUnit,
      ...(rawPrice.packQuantity === undefined ? {} : { packQuantity: rawPrice.packQuantity }),
      sourceUrl: rawPrice.sourceUrl,
      checkedDate,
    });

    checkOfferIsNew(seenOffers, price, colorId, rawPrice.seller, product);

    const tileCount = tilesPerSaleUnit(price);
    checkPublishedCoverage(
      rawPrice.publishedCoverageSquareFeet,
      tileCount,
      price.saleUnit,
      product,
      rawPrice.slug
    );

    return {
      price,
      isEstimate: true,
      canBuyIndividually: price.saleUnit === 'tile',
      currency: CATALOG_CURRENCY,
      sourceKind: rawPrice.sourceKind,
      basisLabel: describePriceBasis(price),
      seller: rawPrice.seller,
      ...(rawPrice.sourceProductCode === undefined
        ? {}
        : { sourceProductCode: rawPrice.sourceProductCode }),
      ...(tileCount === undefined ? {} : { tilesPerSaleUnit: tileCount }),
      ...(rawPrice.publishedCoverageSquareFeet === undefined
        ? {}
        : { publishedCoverageSquareFeet: rawPrice.publishedCoverageSquareFeet }),
      ...(rawPrice.note === undefined ? {} : { note: rawPrice.note }),
    };
  });
}

/**
 * Two prices describe the same offer when the same seller lists the same colour on the same sale
 * basis. A price with no colour covers the whole palette, so it also collides with any per-colour
 * price on that basis; allowing both would double count the product in any rollup. Different
 * sellers may legitimately quote the same pack, so the seller is part of the identity.
 */
function checkOfferIsNew(
  seenOffers: Map<string, Set<string>>,
  price: ProductPrice,
  colorId: ProductColorId | undefined,
  seller: string,
  product: CatalogProduct
): void {
  const basisKey = [
    seller.trim().toLowerCase(),
    price.saleUnit,
    price.packQuantity === undefined ? '*' : String(price.packQuantity),
  ].join('|');
  const colorKey = colorId ?? '*';

  const seenColorKeys = seenOffers.get(basisKey) ?? new Set<string>();
  const collides =
    seenColorKeys.has(colorKey) ||
    seenColorKeys.has('*') ||
    (colorKey === '*' && seenColorKeys.size > 0);
  if (collides) {
    throw new SeedCatalogError(
      `product "${product.id}" repeats the offer "${basisKey}|${colorKey}" across price slugs`
    );
  }

  seenColorKeys.add(colorKey);
  seenOffers.set(basisKey, seenColorKeys);
}

function resolvePriceColorId(
  colorSlug: string | undefined,
  colorIds: ReadonlySet<ProductColorId>,
  product: CatalogProduct,
  priceSlug: string
): ProductColorId | undefined {
  if (colorSlug === undefined) {
    return undefined;
  }

  const colorId = `${product.id}-${colorSlug}`;
  if (!colorIds.has(colorId)) {
    throw new SeedCatalogError(
      `product "${product.id}" price "${priceSlug}" references color slug "${colorSlug}", which ` +
        'the product does not seed'
    );
  }

  return colorId;
}

/**
 * A published coverage figure is an independent statement of the same fact as pack quantity times
 * tile area, so disagreeing by more than metric rounding means one of the two was misread.
 */
function checkPublishedCoverage(
  publishedCoverageSquareFeet: number | undefined,
  tileCount: number | undefined,
  saleUnit: SaleUnit,
  product: CatalogProduct,
  priceSlug: string
): void {
  if (publishedCoverageSquareFeet === undefined) {
    return;
  }

  if (!Number.isFinite(publishedCoverageSquareFeet) || publishedCoverageSquareFeet <= 0) {
    throw new SeedCatalogError(
      `product "${product.id}" price "${priceSlug}" publishedCoverageSquareFeet must be greater ` +
        'than zero'
    );
  }

  if (tileCount === undefined) {
    throw new SeedCatalogError(
      `product "${product.id}" price "${priceSlug}" publishes coverage, but its "${saleUnit}" ` +
        'sale basis has no tile count to check it against'
    );
  }

  const tileArea = tileAreaSquareFeet(product.dimensions);
  const expected = tileCount * tileArea;
  const tolerance = Math.min(expected * COVERAGE_TOLERANCE, tileArea / 2);
  if (Math.abs(expected - publishedCoverageSquareFeet) > tolerance) {
    throw new SeedCatalogError(
      `product "${product.id}" price "${priceSlug}" publishes ` +
        `${String(publishedCoverageSquareFeet)} sq ft of coverage, but ${String(tileCount)} ` +
        `tiles cover about ${expected.toFixed(2)} sq ft`
    );
  }
}
