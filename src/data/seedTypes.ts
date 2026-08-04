import type {
  CatalogProduct,
  Manufacturer,
  ProductColor,
  ProductPrice,
  ProductRotationRule,
  SaleUnit,
} from '../domain/catalog';

/**
 * Date on which the first wave of seeded dimensions, color lists, and prices in `src/data` was
 * read from its source. It is still the catalog baseline: a record carries this date unless its
 * own seed says otherwise.
 */
export const CATALOG_CHECKED_DATE = '2026-07-28';

/**
 * Date the drainable open-surface tiles were read. They were researched a day after the original
 * catalog, so they carry their own date rather than borrowing the baseline one, which would claim
 * a re-check of the older records that never happened.
 */
export const DRAINABLE_CHECKED_DATE = '2026-07-29';
export const FLOORINGINC_CHECKED_DATE = '2026-07-30';
export const TRUELOCK_CHECKED_DATE = '2026-07-31';

/**
 * Every research date a seeded record may carry. Adding a date here is the deliberate edit that
 * lets a new research pass into the catalog, so a typo cannot silently backdate a fact.
 */
export const CATALOG_CHECKED_DATES: readonly string[] = [
  CATALOG_CHECKED_DATE,
  DRAINABLE_CHECKED_DATE,
  FLOORINGINC_CHECKED_DATE,
  TRUELOCK_CHECKED_DATE,
];

/** Most recent research date in the catalog, for "last checked" copy. */
export const CATALOG_LATEST_CHECKED_DATE = TRUELOCK_CHECKED_DATE;

export const CATALOG_CURRENCY = 'USD';

export const PRICING_DISCLAIMER =
  'Prices are estimates for planning only. They were read from the listed source on ' +
  `${CATALOG_CHECKED_DATE} and are not quotes, and records added in a later research pass carry ` +
  'their own checked date. Actual prices, promotions, taxes, and shipping vary by seller, ' +
  'quantity, and date. Confirm current pricing with the seller before buying.';

export const AFFILIATION_DISCLAIMER =
  'This project is independent and is not affiliated with, authorized by, sponsored by, or ' +
  'endorsed by any flooring manufacturer or retailer. Manufacturer and product names are the ' +
  'trademarks of their respective owners and are used here only to identify the products ' +
  'described.';

/**
 * Where a fact came from. Manufacturer sources are preferred for dimensions and color lists;
 * store and retailer sources are used for pricing.
 *
 * `retailer-listing` covers a reseller page that is the only place a brand publishes a fact. There
 * is deliberately no "authorized retailer" kind: that would assert a dealer relationship this
 * project cannot verify, and stating it would imply an affiliation that does not exist.
 */
export type SourceKind = 'manufacturer-official' | 'manufacturer-store' | 'retailer-listing';

export interface SourceReference {
  readonly url: string;
  readonly kind: SourceKind;
  readonly checkedDate: string;
  /** Verbatim wording from the source that supports the fact, when the source publishes one. */
  readonly quote?: string;
}

export interface SeedColor {
  readonly color: ProductColor;
  /**
   * No seeded brand publishes hex or RGB values for its color names, so every swatch in this
   * catalog is a hand-picked approximation for on-screen preview only.
   */
  readonly swatchIsApproximate: boolean;
  /** The color token exactly as the vendor's own page publishes it. */
  readonly vendorColorToken: string;
  /** Recorded caveat, for example a color the vendor spells two different ways. */
  readonly note?: string;
}

export interface SeedPrice {
  readonly price: ProductPrice;
  /** Always true: seeded prices are point-in-time observations, never quotes. */
  readonly isEstimate: boolean;
  /**
   * True only when this exact source is a verified single-tile listing. A pack never implies that
   * its tiles can be bought individually.
   */
  readonly canBuyIndividually: boolean;
  readonly currency: typeof CATALOG_CURRENCY;
  readonly sourceKind: SourceKind;
  /** Human-readable sale basis, for example "per tile". */
  readonly basisLabel: string;
  /** Who was selling at this price, exactly as the source page identifies the seller. */
  readonly seller: string;
  /** Product code or SKU published by the source, when one was verified. */
  readonly sourceProductCode?: string;
  /**
   * Tiles included in one sale unit, so a per-tile price can be derived later without re-reading
   * the sale basis. Undefined when the sale unit is square-foot, which covers no fixed tile count.
   */
  readonly tilesPerSaleUnit?: number;
  /** Coverage per sale unit exactly as the source publishes it, when it publishes one. */
  readonly publishedCoverageSquareFeet?: number;
  readonly note?: string;
}

/** Surface pattern as the vendor names it, kept verbatim so styles are never invented. */
export interface SeedSurfaceStyle {
  readonly label: string;
  readonly source: SourceReference;
}

/**
 * Whether the tile's *visible top surface* is open. `open-drainable` means the vendor publishes
 * perforations, an open profile, or a self-draining top; `closed` covers every solid, smooth,
 * coin, diamond, carpet, and wood-look top, including the ones whose only drainage claim is an
 * under-tile channel. Channels under a closed top do not let a wet car drain through the floor,
 * so they never qualify.
 */
export type SurfaceOpenness = 'open-drainable' | 'closed';

export interface SeedDrainage {
  /** True only for `surfaceOpenness === 'open-drainable'`; the planner filters on this. */
  readonly isDrainable: boolean;
  readonly surfaceOpenness: SurfaceOpenness;
  /** Verbatim vendor wording that decided the classification, in either direction. */
  readonly evidence: string;
  readonly source: SourceReference;
}

/**
 * The only rights basis this project uses for product photography: the image is referenced from
 * the seller's own host at display time, with visible attribution and a link back to the page it
 * came from. Nothing is downloaded, cached, bundled, or redistributed.
 */
export type ImageRightsBasis = 'remote-reference-with-attribution';

export const PRODUCT_IMAGE_RIGHTS_BASIS: ImageRightsBasis = 'remote-reference-with-attribution';

/**
 * How likely the exact image URL is to keep resolving. `high` is a purpose-built product CDN,
 * `medium` is a plain upload path on a site that has already moved URLs before, `unknown` is
 * anything else. Every value assumes the URL can break at any time, which is why
 * `ProductPhoto` always has a generated fallback.
 */
export type HotlinkStability = 'high' | 'medium' | 'unknown';

/**
 * A remote product photo the UI may display but must never download, bundle, or draw into an
 * export canvas. Mirrors {@link SourceReference}: a URL, who published it, and when it was read.
 */
export interface ProductImageRef {
  /** Absolute https URL of the image, on the seller's own host or its CDN. */
  readonly imageUrl: string;
  /** Page the image was read from; always shown as a link back next to the photo. */
  readonly sourcePageUrl: string;
  /** Attribution shown in visible text, never only in a tooltip. */
  readonly attributionText: string;
  /** Meaningful description of what the photo shows, for assistive technology. */
  readonly altText: string;
  readonly checkedDate: string;
  readonly rightsBasis: ImageRightsBasis;
  readonly hotlinkStability: HotlinkStability;
  /** Recorded risk, for example a CDN cache-busting token or a bot filter on the host. */
  readonly caveat?: string;
}

export const IMAGE_ATTRIBUTION_DISCLAIMER =
  'Product photos are loaded directly from the seller and remain the property of their owners. ' +
  'They are shown only to identify the product, are never copied into saved designs or exports, ' +
  'and each one links back to the page it came from.';

export interface SeedProduct {
  readonly product: CatalogProduct;
  /** Research date every source on this product carries. */
  readonly checkedDate: string;
  readonly dimensionsSource: SourceReference;
  readonly colorsSource: SourceReference;
  /** Why the product uses its rotation rule, since no seeded brand publishes one directly. */
  readonly rotationRuleRationale: string;
  readonly surfaceStyle?: SeedSurfaceStyle;
  readonly drainage: SeedDrainage;
  /** A product-specific limitation shown in planner product details. */
  readonly plannerCaveat?: string;
  readonly image?: ProductImageRef;
  readonly colors: readonly SeedColor[];
  readonly prices: readonly SeedPrice[];
}

export interface SeedManufacturer {
  readonly manufacturer: Manufacturer;
  /** Factual trademark attribution shown wherever the manufacturer's name appears. */
  readonly trademarkNotice: string;
  /** Hostnames every source for this brand must come from. */
  readonly sourceHostnames: readonly string[];
  /** Hostnames every product image for this brand must come from, CDNs included. */
  readonly imageHostnames: readonly string[];
  readonly products: readonly SeedProduct[];
}

export interface SeedCatalog {
  /** Baseline research date; individual products may carry a later one. */
  readonly checkedDate: string;
  /** Most recent research date across every seeded product. */
  readonly latestCheckedDate: string;
  readonly currency: typeof CATALOG_CURRENCY;
  readonly manufacturers: readonly SeedManufacturer[];
  readonly products: readonly SeedProduct[];
}

export interface RawPaletteEntry {
  readonly name: string;
  readonly vendorColorToken: string;
  readonly approximateSwatchHex: string;
  /** Recorded caveat, for example a color the vendor spells two different ways. */
  readonly note?: string;
}

export type RawPalette = Readonly<Record<string, RawPaletteEntry>>;

export interface RawPriceSeed {
  /** Suffix appended to the product id to build a stable price id. */
  readonly slug: string;
  readonly priceCents: number;
  readonly saleUnit: SaleUnit;
  readonly packQuantity?: number;
  /** Palette slug this price applies to, when the vendor prices each color separately. */
  readonly colorSlug?: string;
  readonly sourceUrl: string;
  readonly sourceKind: SourceKind;
  readonly seller: string;
  /** Product code or SKU published by the source, when one was verified. */
  readonly sourceProductCode?: string;
  /** Coverage per sale unit exactly as the source publishes it. */
  readonly publishedCoverageSquareFeet?: number;
  readonly note?: string;
}

export interface RawProductSeed {
  /** Stable kebab-case product id, unique across the whole catalog. */
  readonly id: string;
  readonly name: string;
  /** Research date for this product; defaults to {@link CATALOG_CHECKED_DATE}. */
  readonly checkedDate?: string;
  readonly dimensions: {
    readonly widthInches: number;
    readonly lengthInches: number;
    readonly thicknessInches: number;
  };
  readonly rotationRule: ProductRotationRule;
  readonly rotationRuleRationale: string;
  readonly dimensionsSource: SourceReference;
  readonly colorsSource: SourceReference;
  readonly surfaceStyle?: SeedSurfaceStyle;
  readonly drainage: SeedDrainage;
  /** A product-specific limitation shown in planner product details. */
  readonly plannerCaveat?: string;
  readonly image?: ProductImageRef;
  readonly colorSlugs: readonly string[];
  readonly prices: readonly RawPriceSeed[];
}

export interface RawManufacturerSeed {
  readonly id: string;
  readonly name: string;
  readonly trademarkNotice: string;
  /** Hostnames every source url for this brand must use. */
  readonly sourceHostnames: readonly string[];
  /** Hostnames every image url for this brand may use; defaults to `sourceHostnames`. */
  readonly imageHostnames?: readonly string[];
  readonly palette: RawPalette;
  readonly products: readonly RawProductSeed[];
}

export function describePriceBasis(price: ProductPrice): string {
  switch (price.saleUnit) {
    case 'tile':
      return 'per tile';
    case 'pack':
      return price.packQuantity === undefined
        ? 'per pack'
        : `per pack of ${String(price.packQuantity)} tiles`;
    case 'square-foot':
      return 'per square foot';
  }
}

/**
 * Tiles included in one sale unit. Square-foot pricing covers no fixed tile count, so it has no
 * answer rather than a made-up one.
 */
export function tilesPerSaleUnit(price: ProductPrice): number | undefined {
  switch (price.saleUnit) {
    case 'tile':
      return 1;
    case 'pack':
      return price.packQuantity;
    case 'square-foot':
      return undefined;
  }
}

/** Face area of one tile in square feet, used to sanity-check published pack coverage. */
export function tileAreaSquareFeet(dimensions: CatalogProduct['dimensions']): number {
  return (dimensions.widthInches * dimensions.lengthInches) / 144;
}
