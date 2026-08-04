/**
 * Front transition ("ramp") edge accessories, seeded from vendor listings.
 *
 * Every field here was read from the listed source URL on {@link RAMP_CHECKED_DATE}. Nothing is
 * inferred from a tile's own page unless `compatibility[].basis` says `inferred`, and a product
 * family with no verifiable ramp is recorded in {@link PRODUCTS_WITHOUT_VERIFIED_RAMP} rather
 * than given a plausible-looking invented accessory.
 *
 * Only straight edge pieces are seeded. Corner pieces exist for several of these systems, but a
 * corner does not run across a door opening, so including one would inflate ramp math.
 */

import type { SourceReference } from '../seedTypes';

/** Date of the latest ramp-accessory research pass. */
export const RAMP_CHECKED_DATE = '2026-07-30';
const EARLIER_RAMP_CHECKED_DATE = '2026-07-29';
const TRUELOCK_RAMP_CHECKED_DATE = '2026-07-31';
export const RAMP_CURRENCY = 'USD';

export const RAMP_PRICING_DISCLAIMER =
  'Ramp accessory prices are point-in-time estimates for planning only. Check the date shown with ' +
  'each listed source; prices are not quotes. Confirm current price, stock, and compatibility ' +
  'with the seller before buying.';

export type RampCuttability = 'cuttable' | 'not-cuttable' | 'unknown';

/**
 * `published` means the source page names the tile family. `inferred` means the match rests on
 * something weaker (matching published dimensions, or a family-level phrase such as "12-SERIES"),
 * and the reason is always recorded in `evidence`.
 */
export type RampCompatibilityBasis = 'published' | 'inferred';

export type RampEdgeGender = 'female' | 'male' | 'unspecified';

export type RampSaleUnit = 'piece' | 'kit';

export interface RampCompatibility {
  /** Catalog product id from `src/data` this accessory works with. */
  readonly productId: string;
  readonly basis: RampCompatibilityBasis;
  /** Verbatim source wording where possible, otherwise why the match was inferred. */
  readonly evidence: string;
}

export interface RampAccessorySeed {
  readonly id: string;
  /** Accessory name exactly as the source publishes it. */
  readonly name: string;
  readonly manufacturerId: string;
  readonly edgeGender: RampEdgeGender;
  /** Run one straight piece covers along a door opening. */
  readonly segmentLengthInches: number;
  /** How far the piece projects out from the tile field. Null when the source omits it. */
  readonly segmentDepthInches: number | null;
  /** Colors exactly as the source lists them. Empty when the source lists none. */
  readonly colors: readonly string[];
  readonly saleUnit: RampSaleUnit;
  /** Total pieces in one sale unit, including any corners. */
  readonly piecesPerSaleUnit: number;
  /** Straight pieces in one sale unit; corners cannot run across an opening. */
  readonly straightSegmentsPerSaleUnit: number;
  readonly priceCents: number;
  readonly currency: typeof RAMP_CURRENCY;
  /** Always true: these are observed listing prices, never quotes. */
  readonly isEstimate: true;
  readonly seller: string;
  readonly source: SourceReference;
  readonly cuttability: RampCuttability;
  readonly compatibility: readonly RampCompatibility[];
  /** Published guidance about using this piece at a garage door, when the source gives any. */
  readonly garageDoorGuidance?: string;
  readonly caveats: readonly string[];
}

const ESTIMATE_CAVEAT = `Price read from the source listing on ${EARLIER_RAMP_CHECKED_DATE}; it is an estimate, not a quote.`;
const CUTTING_CAVEAT =
  'The source publishes no cutting or trim-to-length guidance, so each opening is rounded up to ' +
  'whole pieces.';

function source(
  url: string,
  quote?: string,
  checkedDate = EARLIER_RAMP_CHECKED_DATE
): SourceReference {
  return {
    url,
    kind: 'manufacturer-store',
    checkedDate,
    ...(quote === undefined ? {} : { quote }),
  };
}

/** Same record, but for an accessory whose only published page is a reseller listing. */
function retailerSource(url: string, quote?: string): SourceReference {
  return {
    url,
    kind: 'retailer-listing',
    checkedDate: EARLIER_RAMP_CHECKED_DATE,
    ...(quote === undefined ? {} : { quote }),
  };
}

const SWISSTRAX_PRO_COLORS: readonly string[] = Object.freeze([
  'Racing Red',
  'Jet Black',
  'Pearl Grey',
  'Slate Grey',
  'Pearl Silver',
  'Arctic White',
  'Royal Blue',
  'Tropical Orange',
  'Citrus Yellow',
  'Chocolate Brown',
  'Mocha Java',
]);

const SWISSTRAX_12_SERIES_COLORS: readonly string[] = Object.freeze([
  'Racing Red',
  'Jet Black',
  'Pearl Silver',
  'Slate Grey',
  'Arctic White',
  'Royal Blue',
  'Tropical Orange',
  'Citrus Yellow',
  'Chocolate Brown',
  'Mocha Java',
]);

const RACEDECK_12_COLORS: readonly string[] = Object.freeze([
  'Alloy',
  'Beige',
  'Black',
  'Graphite',
  'Red',
  'Royal Blue',
  'Yellow',
]);

const SWISSTRAX_PRO_COMPATIBILITY: readonly RampCompatibility[] = Object.freeze([
  Object.freeze({
    productId: 'swisstrax-ribtrax-pro',
    basis: 'published' as const,
    evidence:
      'Listing states the edge is "fully compatible with Swisstrax Ribtrax PRO, Ribtrax Smooth ' +
      'PRO, Rubbertrax PRO, Diamondtrax PRO and Vinyltrax PRO garage flooring tiles."',
  }),
  Object.freeze({
    productId: 'swisstrax-ribtrax-smooth-pro',
    basis: 'published' as const,
    evidence: 'Listing names "Ribtrax Smooth PRO" in its compatibility list.',
  }),
]);

const SWISSTRAX_12_SERIES_COMPATIBILITY: readonly RampCompatibility[] = Object.freeze([
  Object.freeze({
    productId: 'swisstrax-diamondtrax-12-series',
    basis: 'published' as const,
    evidence:
      'Listing states the edge is "fully compatible with Swisstrax Diamondtrax 12-SERIES tiles."',
  }),
  Object.freeze({
    productId: 'swisstrax-ribtrax-smooth-12-series',
    basis: 'inferred' as const,
    evidence:
      'The listing names Diamondtrax 12-SERIES explicitly and otherwise says only "Made specially ' +
      'for Swisstrax 12-SERIES 12 in. tiles". Ribtrax Smooth 12-SERIES is covered by that ' +
      'family-level wording but is not named. Confirm with Swisstrax before buying.',
  }),
]);

const RACEDECK_12_COMPATIBILITY: readonly RampCompatibility[] = Object.freeze(
  (
    [
      'racedeck-diamond',
      'racedeck-free-flow',
      'racedeck-garageflow',
      'racedeck-tuffshield',
      'racedeck-circletrac',
    ] as const
  ).map((productId) =>
    Object.freeze({
      productId,
      basis: 'published' as const,
      evidence:
        'Listing states 12" edges fit "Diamond, TuffShield, Free-Flow, CircleTrac, MAX, ' +
        'Snap-Carpet, and GarageFlow".',
    })
  )
);

const RACEDECK_18_COMPATIBILITY: readonly RampCompatibility[] = Object.freeze(
  (['racedeck-free-flow-xlc', 'racedeck-xl'] as const).map((productId) =>
    Object.freeze({
      productId,
      basis: 'published' as const,
      evidence:
        'Listing states the 18" edges fit "Free-Flow XLC, XL, Smoked Oak, and Charred Oak".',
    })
  )
);

const MODUTILE_12_COMPATIBILITY: readonly RampCompatibility[] = Object.freeze([
  Object.freeze({
    productId: 'modutile-perforated-garage-tile',
    basis: 'published' as const,
    evidence:
      'The accessory is listed as "Ramp Edges for 12-inch Interlocking Tiles" at 12 x 2-3/8 x ' +
      '1/2 in with the same loop-to-peg interlocking system and the same 12 in ModuTile tile ' +
      "size, and the page's own selection guidance is written for a garage floor installation.",
  }),
]);

const GREATMATS_TURBOTILE_COMPATIBILITY: readonly RampCompatibility[] = Object.freeze([
  Object.freeze({
    productId: 'greatmats-turbotile-perforated',
    basis: 'published' as const,
    evidence:
      'Listing states "This border will only fit on the Court Floor Tile Flat Top, TurboTile ' +
      'Diamond Garage Floor Tile, TurboTile Perforated Garage Floor Tile, and Carpet Tiles ' +
      'Modular Squares".',
  }),
]);

export const RAMP_ACCESSORY_SEEDS: readonly RampAccessorySeed[] = Object.freeze([
  Object.freeze({
    id: 'truelock-hd-hdxt-female-edge',
    name: 'TrueLock HD/HDXT Edges - Female (Use At Garage Door)',
    manufacturerId: 'truelock',
    edgeGender: 'female',
    segmentLengthInches: 12,
    segmentDepthInches: 1.75,
    colors: Object.freeze(['Alloy Silver', 'Beige', 'Black', 'Graphite Gray', 'Red', 'Royal Blue']),
    saleUnit: 'piece',
    piecesPerSaleUnit: 1,
    straightSegmentsPerSaleUnit: 1,
    priceCents: 225,
    currency: RAMP_CURRENCY,
    isEstimate: true,
    seller: 'Garage Flooring LLC',
    source: source(
      'https://www.garageflooringllc.com/product/truelock-hd-hdxt-edges/',
      'Edge Dimensions: 12" x 1.75" x 0.5"; Female (Use At Garage Door).',
      TRUELOCK_RAMP_CHECKED_DATE
    ),
    cuttability: 'unknown',
    compatibility: Object.freeze([
      Object.freeze({
        productId: 'truelock-hd-ribbed-flow-through-12in',
        basis: 'published' as const,
        evidence:
          'The listing states TrueLock HD/HDXT edges are compatible with TrueLock HD and HDXT tiles.',
      }),
    ]),
    garageDoorGuidance: 'Order one female edge for each foot of garage door, then order two extra.',
    caveats: Object.freeze([
      `Price read from the source listing on ${TRUELOCK_RAMP_CHECKED_DATE}; it is an estimate, not a quote.`,
      CUTTING_CAVEAT,
      'The seller recommends two extra pieces beyond one female edge per foot of garage door. ' +
        'GarageDesign calculates each opening separately and does not add those unspecified spares.',
    ]),
  }),
  Object.freeze({
    id: 'swisstrax-pro-looped-female-edge',
    name: 'PRO - Looped Female Edge',
    manufacturerId: 'swisstrax',
    edgeGender: 'female',
    segmentLengthInches: 15.75,
    segmentDepthInches: 2.5,
    colors: SWISSTRAX_PRO_COLORS,
    saleUnit: 'piece',
    piecesPerSaleUnit: 1,
    straightSegmentsPerSaleUnit: 1,
    priceCents: 339,
    currency: RAMP_CURRENCY,
    isEstimate: true,
    seller: 'Swisstrax',
    source: source(
      'https://store.swisstrax.com/products/female-edge',
      'Edge size: 2.5 in. W x 15.75 in. L x 0.75 in. H (tapered).'
    ),
    cuttability: 'unknown',
    compatibility: SWISSTRAX_PRO_COMPATIBILITY,
    caveats: Object.freeze([
      ESTIMATE_CAVEAT,
      CUTTING_CAVEAT,
      'Corner pieces are sold separately and are not counted in ramp length.',
    ]),
  }),
  Object.freeze({
    id: 'swisstrax-pro-pegged-male-edge',
    name: 'PRO - Pegged Male Edge',
    manufacturerId: 'swisstrax',
    edgeGender: 'male',
    segmentLengthInches: 15.75,
    segmentDepthInches: 2.5,
    colors: SWISSTRAX_PRO_COLORS,
    saleUnit: 'piece',
    piecesPerSaleUnit: 1,
    straightSegmentsPerSaleUnit: 1,
    priceCents: 339,
    currency: RAMP_CURRENCY,
    isEstimate: true,
    seller: 'Swisstrax',
    source: source(
      'https://store.swisstrax.com/products/beveled-edge',
      'Edge size: 2.5 in. W x 15.75 in. L x 0.75 in. H (tapered).'
    ),
    cuttability: 'unknown',
    compatibility: SWISSTRAX_PRO_COMPATIBILITY,
    caveats: Object.freeze([
      ESTIMATE_CAVEAT,
      CUTTING_CAVEAT,
      'Male and female edges mate with opposite tile edges. Which one a given door opening needs ' +
        'depends on how the field is laid out.',
    ]),
  }),
  Object.freeze({
    id: 'swisstrax-12-series-looped-female-edge',
    name: '12-Series - Looped Female Edge',
    manufacturerId: 'swisstrax',
    edgeGender: 'female',
    segmentLengthInches: 12,
    segmentDepthInches: 2.75,
    colors: SWISSTRAX_12_SERIES_COLORS,
    saleUnit: 'piece',
    piecesPerSaleUnit: 1,
    straightSegmentsPerSaleUnit: 1,
    priceCents: 296,
    currency: RAMP_CURRENCY,
    isEstimate: true,
    seller: 'Swisstrax',
    source: source(
      'https://store.swisstrax.com/products/looped-edge',
      'Edge size: 2.75 in. W x 12 in. L x 0.50 in. H (tapered).'
    ),
    cuttability: 'unknown',
    compatibility: SWISSTRAX_12_SERIES_COMPATIBILITY,
    caveats: Object.freeze([ESTIMATE_CAVEAT, CUTTING_CAVEAT]),
  }),
  Object.freeze({
    id: 'swisstrax-12-series-pegged-male-edge',
    name: '12-Series - Pegged Male Edge',
    manufacturerId: 'swisstrax',
    edgeGender: 'male',
    segmentLengthInches: 12,
    segmentDepthInches: 2.75,
    colors: SWISSTRAX_12_SERIES_COLORS,
    saleUnit: 'piece',
    piecesPerSaleUnit: 1,
    straightSegmentsPerSaleUnit: 1,
    priceCents: 296,
    currency: RAMP_CURRENCY,
    isEstimate: true,
    seller: 'Swisstrax',
    source: source(
      'https://store.swisstrax.com/products/copy-of-male-edge',
      'Edge size: 2.75 in. W x 12 in. L x 0.50 in. H (tapered).'
    ),
    cuttability: 'unknown',
    compatibility: SWISSTRAX_12_SERIES_COMPATIBILITY,
    caveats: Object.freeze([
      ESTIMATE_CAVEAT,
      CUTTING_CAVEAT,
      'Male and female edges mate with opposite tile edges. Which one a given door opening needs ' +
        'depends on how the field is laid out.',
    ]),
  }),
  Object.freeze({
    id: 'racedeck-female-edge-12',
    name: 'RaceDeck Edges - 12" Female edge',
    manufacturerId: 'racedeck',
    edgeGender: 'female',
    segmentLengthInches: 12,
    segmentDepthInches: 1.75,
    colors: RACEDECK_12_COLORS,
    saleUnit: 'piece',
    piecesPerSaleUnit: 1,
    straightSegmentsPerSaleUnit: 1,
    priceCents: 199,
    currency: RAMP_CURRENCY,
    isEstimate: true,
    seller: 'RaceDeck',
    source: source(
      'https://racedeck.com/racedeck-garage-floors-and-tiles/racedeck-edges/',
      '12" edges fit Diamond, TuffShield, Free-Flow, CircleTrac, MAX, Snap-Carpet, and GarageFlow.'
    ),
    cuttability: 'unknown',
    compatibility: RACEDECK_12_COMPATIBILITY,
    garageDoorGuidance: 'RaceDeck recommends female edges for garage doors.',
    caveats: Object.freeze([
      ESTIMATE_CAVEAT,
      CUTTING_CAVEAT,
      'Edge size, edge type, and color are variants of one RaceDeck listing, so the URL is the ' +
        'shared product page rather than a per-variant page.',
    ]),
  }),
  Object.freeze({
    id: 'racedeck-female-edge-18',
    name: 'RaceDeck Edges - 18" Female edge',
    manufacturerId: 'racedeck',
    edgeGender: 'female',
    segmentLengthInches: 18,
    segmentDepthInches: null,
    colors: Object.freeze(['Alloy', 'Black', 'Graphite']),
    saleUnit: 'piece',
    piecesPerSaleUnit: 1,
    straightSegmentsPerSaleUnit: 1,
    priceCents: 299,
    currency: RAMP_CURRENCY,
    isEstimate: true,
    seller: 'RaceDeck',
    source: source(
      'https://racedeck.com/racedeck-garage-floors-and-tiles/racedeck-edges/',
      'Edges fit Free-Flow XLC, XL, Smoked Oak, and Charred Oak.'
    ),
    cuttability: 'unknown',
    compatibility: RACEDECK_18_COMPATIBILITY,
    garageDoorGuidance: 'RaceDeck recommends female edges for garage doors.',
    caveats: Object.freeze([
      ESTIMATE_CAVEAT,
      CUTTING_CAVEAT,
      'The 18" variant publishes no projection depth, so ramp depth is unknown. The 12" variant ' +
        'dimensions do not apply to it.',
    ]),
  }),
  Object.freeze({
    id: 'vevor-male-transition-edge-kit-20in',
    name: 'VEVOR Male Garage Floors Transition Edge Kit, 12 Edges and 4 Corners',
    manufacturerId: 'vevor',
    edgeGender: 'male',
    segmentLengthInches: 20.2,
    segmentDepthInches: 4.1,
    colors: Object.freeze(['Black']),
    saleUnit: 'kit',
    piecesPerSaleUnit: 16,
    straightSegmentsPerSaleUnit: 12,
    priceCents: 2890,
    currency: RAMP_CURRENCY,
    isEstimate: true,
    seller: 'VEVOR',
    source: source(
      'https://www.vevor.com/garage-flooring-mat-c_11210/vevor-male-garage-floors-transition-edge-kit-12-edges-and-4-corners-sturdy-pvc-interlocking-modular-garage-floor-edging-slip-resistant-compatible-only-with-vevor-4-sided-interlocking-mats-black-p_010266878657',
      'Compatible Only with VEVOR 4-Sided Interlocking Mats. 20.2 x 4.1 x 0.2 inches (513 x 103 x 5 mm).'
    ),
    cuttability: 'unknown',
    compatibility: Object.freeze([
      Object.freeze({
        productId: 'vevor-garage-floor-tiles-interlocking-20in',
        basis: 'inferred' as const,
        evidence:
          'The listing restricts compatibility to "VEVOR 4-Sided Interlocking Mats" without naming ' +
          'a SKU. The match rests on the published edge size of 20.2 x 4.1 x 0.2 in matching this ' +
          "family's 20.2 in, 5 mm PVC tile. Confirm with VEVOR before buying.",
      }),
    ]),
    caveats: Object.freeze([
      ESTIMATE_CAVEAT,
      CUTTING_CAVEAT,
      'The kit contains 16 pieces but only 12 are straight edges; the 4 corners cannot run across ' +
        'a door opening and are excluded from ramp length.',
      'Only a male kit was verified for this system. A matching female kit was not found.',
    ]),
  }),
  Object.freeze({
    id: 'vevor-drainage-mat-straight-transition-edge-kit',
    name: 'VEVOR Transition Edge Kit, 11-Piece, Durable Straight Garage Floor Edging, PP Material',
    manufacturerId: 'vevor',
    edgeGender: 'unspecified',
    segmentLengthInches: 12.2,
    segmentDepthInches: 2.36,
    colors: Object.freeze(['Black']),
    saleUnit: 'kit',
    piecesPerSaleUnit: 11,
    straightSegmentsPerSaleUnit: 11,
    priceCents: 1390,
    currency: RAMP_CURRENCY,
    isEstimate: true,
    seller: 'VEVOR',
    source: source(
      'https://www.vevor.com/other-c_45583/vevor-transition-edge-kit-11-piece-durable-straight-garage-floor-edging-pp-material-easy-installation-edge-protection-for-wet-area-restaurant-pool-only-compatible-with-vevor-drainage-mats-black-p_010443077487',
      'Only Compatible with VEVOR Drainage Mats. The listing describes 11 straight transition pieces whose dimensions match the drainage-mat line.',
      RAMP_CHECKED_DATE
    ),
    cuttability: 'unknown',
    compatibility: Object.freeze([
      Object.freeze({
        productId: 'vevor-interlocking-drainage-mat-12in',
        basis: 'published' as const,
        evidence:
          'VEVOR titles the accessory "Only Compatible with VEVOR Drainage Mats" and states that ' +
          'its dimensions match the exact edge profile, thickness, and surface geometry of the ' +
          'VEVOR drainage-mat line.',
      }),
    ]),
    garageDoorGuidance:
      'VEVOR describes a smooth, sloped transition, and a verified purchaser reports using the ' +
      'edging to finish two garage-door openings.',
    caveats: Object.freeze([
      `Price read from the source listing on ${RAMP_CHECKED_DATE}; it is an estimate, not a quote.`,
      CUTTING_CAVEAT,
      'VEVOR publishes no cut-to-length instructions. One verified purchaser reports trimming ' +
        'pieces at garage-door corners, but the estimator conservatively buys whole pieces for ' +
        'each opening.',
      "A verified purchaser reports that the edging attaches only to the tile's female edge, so " +
        'the tile-field orientation must put that edge at the garage doors.',
      'This drainage-mat kit is separate from VEVOR 6-Lock and 4-sided transition kits, which do ' +
        'not match this 12.2-inch by 0.59-inch drainage-mat system.',
    ]),
  }),
  Object.freeze({
    id: 'modutile-ramp-edge-with-loops-12',
    name: 'Ramp Edges for 12-inch Interlocking Tiles - Ramp Edges WITH Loops',
    manufacturerId: 'modutile',
    edgeGender: 'female',
    segmentLengthInches: 12,
    segmentDepthInches: 2.375,
    colors: Object.freeze([
      'Beige',
      'Black',
      'Blue',
      'Brown',
      'Gray',
      'Green',
      'Orange',
      'Red',
      'White',
    ]),
    saleUnit: 'piece',
    piecesPerSaleUnit: 1,
    straightSegmentsPerSaleUnit: 1,
    priceCents: 185,
    currency: RAMP_CURRENCY,
    isEstimate: true,
    seller: 'ModuTile',
    source: source(
      'https://modutile.com/product/ramp-edges-corner-trim-pp/',
      'Size 12 x 2-3/8 x 1/2 - inch'
    ),
    cuttability: 'unknown',
    compatibility: MODUTILE_12_COMPATIBILITY,
    garageDoorGuidance:
      'ModuTile writes that an installation started at the garage entrance needs the ramp edges ' +
      'with loops, because the tiles are then oriented with their loops pointing to the back of ' +
      'the garage.',
    caveats: Object.freeze([
      ESTIMATE_CAVEAT,
      CUTTING_CAVEAT,
      'ModuTile also sells a "NO Loops" edge at the same USD 1.85 and a corner piece at USD 0.99. ' +
        'Which edge a given door needs depends on where the installation starts, and corners ' +
        'cannot run across an opening, so neither is counted in ramp length here.',
    ]),
  }),
  Object.freeze({
    id: 'greatmats-click-tile-border-ramp-female',
    name: 'Click Tile Border Ramp - Female - With Loops',
    manufacturerId: 'greatmats',
    edgeGender: 'female',
    segmentLengthInches: 12.12,
    segmentDepthInches: 2.4,
    colors: Object.freeze([]),
    saleUnit: 'piece',
    piecesPerSaleUnit: 1,
    straightSegmentsPerSaleUnit: 1,
    priceCents: 380,
    currency: RAMP_CURRENCY,
    isEstimate: true,
    seller: 'Greatmats',
    source: retailerSource(
      'https://www.greatmats.com/accessories/click-tile-border-ramp.php',
      'Thickness 5/8 inch Width 0.20 feet Length 1.01 feet'
    ),
    cuttability: 'cuttable',
    compatibility: GREATMATS_TURBOTILE_COMPATIBILITY,
    garageDoorGuidance:
      'The listing publishes male and female counting rules for island and corner installs, and ' +
      'states that inside corners need two border ramps cut at a diagonal.',
    caveats: Object.freeze([
      ESTIMATE_CAVEAT,
      'The listing says to cut this border with a sharp utility knife or a table saw, so a door ' +
        'opening can be trimmed rather than rounded up to whole pieces.',
      'Border colour is not published as a separate option; the listing sells the ramp by loop ' +
        'type ("Female - With Loops" or "Male - No Loops") and publishes no colour list.',
      'A matching male "No Loops" border is listed at the same USD 3.80. Which one a door needs ' +
        'depends on how the field is laid out.',
    ]),
  }),
]);

/**
 * Seeded tile families with no ramp accessory that could be verified, and why. Returning one of
 * these is a real answer; substituting a generic ramp would not be.
 */
export const PRODUCTS_WITHOUT_VERIFIED_RAMP: Readonly<Record<string, string>> = Object.freeze({
  'vevor-garage-tiles-interlocking-12in':
    'VEVOR\'s transition edge kits publish compatibility only with its "Upgraded 6-Lock" mats, and ' +
    `this tile's listing does not identify itself as that system. No compatible ramp was verified ` +
    `on ${RAMP_CHECKED_DATE}.`,
  'techfloor-solid-raised-squares':
    'The Greatmats tile page says "Optional border edges and corners are available for a finished ' +
    'look", but no accessory listing with a verifiable name, size, pack quantity, and price could ' +
    `be retrieved on ${RAMP_CHECKED_DATE}; the ramp URLs redirected away from a product page.`,
  'flooringinc-nitro-vented-12in':
    'FlooringInc lists Nitro edge pieces, but no published edge length or depth was verified, so ' +
    `door-opening ramp quantities cannot be calculated as of ${RAMP_CHECKED_DATE}.`,
  'flooringinc-vented-grid-loc-12in':
    'FlooringInc lists Grid-Loc male and female edges, but no published edge length or depth was ' +
    `verified, so door-opening ramp quantities cannot be calculated as of ${RAMP_CHECKED_DATE}.`,
});

export function findRampAccessory(id: string): RampAccessorySeed | undefined {
  return RAMP_ACCESSORY_SEEDS.find((accessory) => accessory.id === id);
}

/**
 * Compatible accessories, best first: published compatibility before inferred, then the vendor's
 * recommended garage-door edge, then the cheapest cost per inch. Deterministic so a plan does not
 * change between renders.
 */
export function listRampAccessoriesForProduct(productId: string): readonly RampAccessorySeed[] {
  return RAMP_ACCESSORY_SEEDS.filter((accessory) =>
    accessory.compatibility.some((entry) => entry.productId === productId)
  ).sort((left, right) => compareAccessories(left, right, productId));
}

export function getRampCompatibility(
  accessory: RampAccessorySeed,
  productId: string
): RampCompatibility | undefined {
  return accessory.compatibility.find((entry) => entry.productId === productId);
}

/** Why a product has no ramp, when it is a known seeded product with none. */
export function getRampUnavailableReason(productId: string): string | undefined {
  return Object.hasOwn(PRODUCTS_WITHOUT_VERIFIED_RAMP, productId)
    ? PRODUCTS_WITHOUT_VERIFIED_RAMP[productId]
    : undefined;
}

export function costPerInchCents(accessory: RampAccessorySeed): number {
  return (
    accessory.priceCents / (accessory.segmentLengthInches * accessory.straightSegmentsPerSaleUnit)
  );
}

/**
 * Numeric and structural sanity for one accessory, whether it came from this file or from a
 * caller pricing a listing the catalog does not carry yet. Without this a non-finite segment
 * length would silently produce a plan full of `NaN` quantities.
 */
export function assertRampAccessory(accessory: RampAccessorySeed): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(accessory.id)) {
    throw new Error(`Ramp accessory id "${accessory.id}" must be lowercase kebab-case.`);
  }
  if (!Number.isFinite(accessory.segmentLengthInches) || accessory.segmentLengthInches <= 0) {
    throw new Error(`Ramp accessory "${accessory.id}" must have a positive segment length.`);
  }
  if (
    accessory.segmentDepthInches !== null &&
    (!Number.isFinite(accessory.segmentDepthInches) || accessory.segmentDepthInches <= 0)
  ) {
    throw new Error(`Ramp accessory "${accessory.id}" must have a positive depth or none at all.`);
  }
  if (
    !Number.isSafeInteger(accessory.piecesPerSaleUnit) ||
    !Number.isSafeInteger(accessory.straightSegmentsPerSaleUnit) ||
    accessory.straightSegmentsPerSaleUnit < 1 ||
    accessory.straightSegmentsPerSaleUnit > accessory.piecesPerSaleUnit
  ) {
    throw new Error(
      `Ramp accessory "${accessory.id}" must contain at least one straight piece and no more ` +
        'straight pieces than total pieces.'
    );
  }
  if (!Number.isSafeInteger(accessory.priceCents) || accessory.priceCents <= 0) {
    throw new Error(`Ramp accessory "${accessory.id}" must have a positive integer price.`);
  }
  if (accessory.compatibility.length === 0) {
    throw new Error(`Ramp accessory "${accessory.id}" lists no compatible product.`);
  }
  for (const entry of accessory.compatibility) {
    if (entry.evidence.trim().length === 0) {
      throw new Error(
        `Ramp accessory "${accessory.id}" must record evidence for "${entry.productId}".`
      );
    }
  }
}

/**
 * Structural check for the seeded records. Run against the real catalog in tests so a renamed or
 * removed product cannot leave an accessory pointing at nothing.
 */
export function assertRampSeedsValid(knownProductIds: readonly string[]): void {
  const known = new Set(knownProductIds);
  const seenIds = new Set<string>();

  for (const accessory of RAMP_ACCESSORY_SEEDS) {
    if (seenIds.has(accessory.id)) {
      throw new Error(`Duplicate ramp accessory id "${accessory.id}".`);
    }
    seenIds.add(accessory.id);
    assertRampAccessory(accessory);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(accessory.source.checkedDate)) {
      throw new Error(`Ramp accessory "${accessory.id}" must record a valid checked date.`);
    }

    for (const entry of accessory.compatibility) {
      if (!known.has(entry.productId)) {
        throw new Error(
          `Ramp accessory "${accessory.id}" claims compatibility with unknown product ` +
            `"${entry.productId}".`
        );
      }
      if (Object.hasOwn(PRODUCTS_WITHOUT_VERIFIED_RAMP, entry.productId)) {
        throw new Error(
          `Product "${entry.productId}" is listed both with a compatible ramp and as having none.`
        );
      }
    }
  }

  for (const productId of Object.keys(PRODUCTS_WITHOUT_VERIFIED_RAMP)) {
    if (!known.has(productId)) {
      throw new Error(`Unknown product "${productId}" is recorded as having no verified ramp.`);
    }
  }
}

function compareAccessories(
  left: RampAccessorySeed,
  right: RampAccessorySeed,
  productId: string
): number {
  const basisRank = (accessory: RampAccessorySeed): number =>
    getRampCompatibility(accessory, productId)?.basis === 'published' ? 0 : 1;
  const guidanceRank = (accessory: RampAccessorySeed): number =>
    accessory.garageDoorGuidance === undefined ? 1 : 0;

  return (
    basisRank(left) - basisRank(right) ||
    guidanceRank(left) - guidanceRank(right) ||
    costPerInchCents(left) - costPerInchCents(right) ||
    left.id.localeCompare(right.id)
  );
}
