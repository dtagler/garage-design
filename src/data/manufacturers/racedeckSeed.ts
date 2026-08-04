import {
  CATALOG_CHECKED_DATE,
  DRAINABLE_CHECKED_DATE,
  PRODUCT_IMAGE_RIGHTS_BASIS,
  type RawManufacturerSeed,
  type RawPalette,
  type SeedDrainage,
} from '../seedTypes';

/**
 * RaceDeck seed data.
 *
 * Dimensions, color lists, and prices were read from RaceDeck's own product pages at racedeck.com,
 * which publish a structured product record containing a verbatim DIMENSIONS line plus one entry
 * per purchasable color variant. The closed-surface lines were read on 2026-07-28; the two
 * open-surface additions, Free-Flow XLC and GarageFlow, were read on 2026-07-29 and carry that
 * later date. Nothing here is fetched at runtime; the values are a point-in-time snapshot
 * committed to source.
 *
 * RaceDeck does not publish hex or RGB values for its color names, so every swatch below is an
 * approximation chosen for on-screen preview only. Display names are title-cased from the color
 * tokens RaceDeck's own store publishes, and the original token is kept alongside each color.
 *
 * Only tile lines whose width, length, thickness, and full color list could all be verified are
 * included. RaceDeck MAX, Snap-Carpet, TuffShield Carbon Fiber, and the 3 ft x 3 ft wood-look
 * panels are omitted because their published color range, thickness, or both could not be
 * confirmed.
 *
 * Prices are for the base tile without the optional ShockTower underlay. Where RaceDeck also lists
 * a ShockTower variant, the price difference is recorded in the note rather than seeded as a
 * separate product, because ShockTower does not change tile dimensions or color.
 */

const RACEDECK_PALETTE: RawPalette = {
  alloy: { name: 'Alloy', vendorColorToken: 'alloy', approximateSwatchHex: '#9BA0A6' },
  beige: { name: 'Beige', vendorColorToken: 'beige', approximateSwatchHex: '#D7C9AE' },
  black: { name: 'Black', vendorColorToken: 'black', approximateSwatchHex: '#1A1A1A' },
  chalk: { name: 'Chalk', vendorColorToken: 'chalk', approximateSwatchHex: '#E8E6DF' },
  'cool-blue': {
    name: 'Cool Blue',
    vendorColorToken: 'cool-blue',
    approximateSwatchHex: '#4E7FA8',
  },
  'bright-blue': {
    name: 'Bright Blue',
    vendorColorToken: 'bright-blue',
    approximateSwatchHex: '#1D7FCB',
  },
  gray: { name: 'Gray', vendorColorToken: 'gray', approximateSwatchHex: '#8B9095' },
  espresso: { name: 'Espresso', vendorColorToken: 'espresso', approximateSwatchHex: '#4B3428' },
  graphite: { name: 'Graphite', vendorColorToken: 'graphite', approximateSwatchHex: '#4A4E52' },
  'green-light': {
    name: 'Green Light',
    vendorColorToken: 'green-light',
    approximateSwatchHex: '#7DBF5E',
  },
  'neon-orange': {
    name: 'Neon Orange',
    vendorColorToken: 'neon-orange',
    approximateSwatchHex: '#FF6A13',
  },
  'neon-pink': {
    name: 'Neon Pink',
    vendorColorToken: 'neon-pink',
    approximateSwatchHex: '#FF3D8B',
  },
  'neon-teal': {
    name: 'Neon Teal',
    vendorColorToken: 'neon-teal',
    approximateSwatchHex: '#12C2C2',
  },
  orange: { name: 'Orange', vendorColorToken: 'orange', approximateSwatchHex: '#E36414' },
  red: { name: 'Red', vendorColorToken: 'red', approximateSwatchHex: '#C81E20' },
  'royal-blue': {
    name: 'Royal Blue',
    vendorColorToken: 'royal-blue',
    approximateSwatchHex: '#1F3F94',
  },
  'royal-purple': {
    name: 'Royal Purple',
    vendorColorToken: 'royal-purple',
    approximateSwatchHex: '#4B2E83',
  },
  sublime: { name: 'Sublime', vendorColorToken: 'sublime', approximateSwatchHex: '#B7D93A' },
  white: { name: 'White', vendorColorToken: 'white', approximateSwatchHex: '#F2F2F0' },
  yellow: { name: 'Yellow', vendorColorToken: 'yellow', approximateSwatchHex: '#F2C500' },
};

/**
 * RaceDeck tiles interlock with the PowerLock edge, which pairs a loop edge against a peg edge.
 * RaceDeck publishes no option for rotating individual tiles within a floor, so the conservative
 * rule is a single fixed orientation.
 */
const FIXED_ROTATION_RATIONALE =
  'RaceDeck publishes no rotated-tile installation option; the PowerLock edge pairs loop edges ' +
  'against peg edges, so every tile is laid in one consistent orientation and rotation is treated ' +
  'as fixed.';

const TWELVE_INCH_DIMENSIONS_QUOTE = '12" x 12" x 0.5" (304.8 mm x 304.8 mm x 12.7 mm)';

/**
 * RaceDeck's closed-top lines all publish the same "High Performance Substructure" claim about
 * air and moisture escaping *underneath* the tile. That is an under-tile channel, not an opening
 * a wet car drains through, so it never makes a tile drainable here.
 */
function closedTop(url: string, surfaceEvidence: string): SeedDrainage {
  return {
    isDrainable: false,
    surfaceOpenness: 'closed',
    evidence: surfaceEvidence,
    source: {
      url,
      kind: 'manufacturer-official',
      checkedDate: CATALOG_CHECKED_DATE,
      quote:
        'High Performance Substructure - Supports rolling loads of over 80,000 pounds while ' +
        'allowing air and moisture to escape',
    },
  };
}

const FREE_FLOW_URL = 'https://racedeck.com/racedeck-garage-floors-and-tiles/free-flow/';
const FREE_FLOW_XLC_URL = 'https://racedeck.com/racedeck-garage-floors-and-tiles/free-flow-xlc/';
const GARAGEFLOW_URL =
  'https://racedeck.com/racedeck-garage-floors-and-tiles/garageflow-clearance/';

const RACEDECK_PHOTO_ATTRIBUTION =
  'Photo (c) RaceDeck. Used to identify the product. Not affiliated.';

const RACEDECK_PHOTO_CAVEAT =
  'Plain WordPress upload path. RaceDeck has already retired product page URLs on this site, so ' +
  'the asset path could move with them.';

export const RACEDECK_SEED: RawManufacturerSeed = {
  id: 'racedeck',
  name: 'RaceDeck',
  trademarkNotice:
    'RaceDeck, Free-Flow, GarageFlow, TuffShield, CircleTrac, and PowerLock are trademarks of ' +
    'their respective owners. Used here only to identify the products described. This project is ' +
    'not affiliated with or endorsed by RaceDeck.',
  sourceHostnames: ['racedeck.com'],
  palette: RACEDECK_PALETTE,
  products: [
    {
      id: 'racedeck-diamond',
      name: 'RaceDeck Diamond',
      dimensions: { widthInches: 12, lengthInches: 12, thicknessInches: 0.5 },
      rotationRule: 'fixed',
      rotationRuleRationale: FIXED_ROTATION_RATIONALE,
      dimensionsSource: {
        url: 'https://racedeck.com/racedeck-garage-floors-and-tiles/racedeck-diamond/',
        kind: 'manufacturer-official',
        checkedDate: CATALOG_CHECKED_DATE,
        quote: TWELVE_INCH_DIMENSIONS_QUOTE,
      },
      colorsSource: {
        url: 'https://racedeck.com/racedeck-garage-floors-and-tiles/racedeck-diamond/',
        kind: 'manufacturer-official',
        checkedDate: CATALOG_CHECKED_DATE,
      },
      surfaceStyle: {
        label: 'Diamond plate',
        source: {
          url: 'https://racedeck.com/racedeck-garage-floors-and-tiles/racedeck-diamond/',
          kind: 'manufacturer-official',
          checkedDate: CATALOG_CHECKED_DATE,
          quote: 'RaceDeck Diamond',
        },
      },
      drainage: closedTop(
        'https://racedeck.com/racedeck-garage-floors-and-tiles/racedeck-diamond/',
        'A closed diamond-plate top. The page makes no perforation, open-profile, or ' +
          'self-draining claim about the surface; its only air and moisture claim is about the ' +
          'substructure underneath the tile.'
      ),
      colorSlugs: [
        'alloy',
        'beige',
        'black',
        'chalk',
        'cool-blue',
        'espresso',
        'graphite',
        'green-light',
        'neon-orange',
        'neon-pink',
        'neon-teal',
        'orange',
        'red',
        'royal-blue',
        'royal-purple',
        'sublime',
        'white',
        'yellow',
      ],
      prices: [
        {
          slug: 'tile',
          priceCents: 485,
          saleUnit: 'tile',
          sourceUrl: 'https://racedeck.com/racedeck-garage-floors-and-tiles/racedeck-diamond/',
          sourceKind: 'manufacturer-store',
          seller: 'RaceDeck',
          note:
            'USD 4.85 for a single tile without ShockTower. The same tile with ShockTower was ' +
            'listed at USD 5.85.',
        },
      ],
    },
    {
      id: 'racedeck-free-flow',
      name: 'RaceDeck Free-Flow',
      dimensions: { widthInches: 12, lengthInches: 12, thicknessInches: 0.5 },
      rotationRule: 'fixed',
      rotationRuleRationale: FIXED_ROTATION_RATIONALE,
      dimensionsSource: {
        url: FREE_FLOW_URL,
        kind: 'manufacturer-official',
        checkedDate: CATALOG_CHECKED_DATE,
        quote: TWELVE_INCH_DIMENSIONS_QUOTE,
      },
      colorsSource: {
        url: FREE_FLOW_URL,
        kind: 'manufacturer-official',
        checkedDate: CATALOG_CHECKED_DATE,
      },
      surfaceStyle: {
        label: 'Self-Draining',
        source: {
          url: FREE_FLOW_URL,
          kind: 'manufacturer-official',
          checkedDate: CATALOG_CHECKED_DATE,
          quote: 'Self-Draining - Maximum airflow and drainage of liquids and debris',
        },
      },
      drainage: {
        isDrainable: true,
        surfaceOpenness: 'open-drainable',
        evidence:
          'RaceDeck lists "Self-Draining - Maximum airflow and drainage of liquids and debris" as ' +
          'a key benefit of the tile itself and markets the line as "Free-Flow Self-Draining ' +
          'Garage Floor Tiles". The open top is the product, not an under-tile channel.',
        source: {
          url: FREE_FLOW_URL,
          kind: 'manufacturer-official',
          checkedDate: CATALOG_CHECKED_DATE,
          quote: 'Self-Draining - Maximum airflow and drainage of liquids and debris',
        },
      },
      image: {
        imageUrl: 'https://racedeck.com/wp-content/uploads/2020/08/free-flow-garage.webp',
        sourcePageUrl: FREE_FLOW_URL,
        attributionText: RACEDECK_PHOTO_ATTRIBUTION,
        altText:
          'Garage floored with RaceDeck Free-Flow open-grid tiles, showing the self-draining top ' +
          'surface running under a parked vehicle.',
        checkedDate: CATALOG_CHECKED_DATE,
        rightsBasis: PRODUCT_IMAGE_RIGHTS_BASIS,
        hotlinkStability: 'medium',
        caveat: RACEDECK_PHOTO_CAVEAT,
      },
      colorSlugs: [
        'alloy',
        'beige',
        'black',
        'cool-blue',
        'espresso',
        'graphite',
        'green-light',
        'neon-orange',
        'neon-pink',
        'neon-teal',
        'orange',
        'red',
        'royal-blue',
        'royal-purple',
        'sublime',
        'white',
        'yellow',
      ],
      prices: [
        {
          slug: 'tile',
          priceCents: 399,
          saleUnit: 'tile',
          sourceUrl: FREE_FLOW_URL,
          sourceKind: 'manufacturer-store',
          seller: 'RaceDeck',
          note:
            'USD 3.99 for a single tile, re-read on 2026-07-29 at the same figure with an order ' +
            'minimum of 1. This open-grid tile has no ShockTower option. Seventeen colors are ' +
            'purchasable; the color filter on the page offers seven further names (Brick, Bright ' +
            'Blue, Chalk, Dark Blue, Gray, Green, Metallic) that have no buyable variant, so they ' +
            'are not seeded. RaceDeck states 10 oz in its description and 9.6 oz in its store ' +
            'record; neither weight is used here.',
        },
      ],
    },
    {
      id: 'racedeck-free-flow-xlc',
      name: 'RaceDeck Free-Flow XLC',
      checkedDate: DRAINABLE_CHECKED_DATE,
      // The DIMENSIONS block publishes 0.625 in. RaceDeck's own store field and one marketing
      // bullet both say 3/4 in; the spec block wins and the conflict is recorded in the price note.
      dimensions: { widthInches: 18, lengthInches: 18, thicknessInches: 0.625 },
      rotationRule: 'fixed',
      rotationRuleRationale: FIXED_ROTATION_RATIONALE,
      dimensionsSource: {
        url: FREE_FLOW_XLC_URL,
        kind: 'manufacturer-official',
        checkedDate: DRAINABLE_CHECKED_DATE,
        quote: '18" x 18" x 0.625" (457.2 mm x 457.2 mm x 15.9 mm), Weight: 36.8 oz. (1044.2 g)',
      },
      colorsSource: {
        url: FREE_FLOW_XLC_URL,
        kind: 'manufacturer-official',
        checkedDate: DRAINABLE_CHECKED_DATE,
      },
      surfaceStyle: {
        label: 'Dual-Traction Tread',
        source: {
          url: FREE_FLOW_XLC_URL,
          kind: 'manufacturer-official',
          checkedDate: DRAINABLE_CHECKED_DATE,
          quote: 'Dual-Traction Tread - Patent pending rib design',
        },
      },
      drainage: {
        isDrainable: true,
        surfaceOpenness: 'open-drainable',
        evidence:
          'RaceDeck describes XLC as having "the same self-draining surface" as Free-Flow and ' +
          'lists "Self-Draining - The combination of the flat to round rib increases drainage and ' +
          'eliminates hydrostatic tension" as a key benefit of the tile top.',
        source: {
          url: FREE_FLOW_XLC_URL,
          kind: 'manufacturer-official',
          checkedDate: DRAINABLE_CHECKED_DATE,
          quote: 'the same self-draining surface, PowerLocks, high-performance substructure',
        },
      },
      image: {
        imageUrl: 'https://racedeck.com/wp-content/uploads/2020/09/free-flow-xlc-tile-beige.png',
        sourcePageUrl: FREE_FLOW_XLC_URL,
        attributionText: RACEDECK_PHOTO_ATTRIBUTION,
        altText:
          'Single beige RaceDeck Free-Flow XLC tile seen from above, showing the open ribbed ' +
          'drainage grid across the whole 18 inch face.',
        checkedDate: DRAINABLE_CHECKED_DATE,
        rightsBasis: PRODUCT_IMAGE_RIGHTS_BASIS,
        hotlinkStability: 'medium',
        caveat: RACEDECK_PHOTO_CAVEAT,
      },
      colorSlugs: [
        'alloy',
        'beige',
        'black',
        'chalk',
        'cool-blue',
        'espresso',
        'graphite',
        'green-light',
        'orange',
        'red',
        'royal-blue',
        'royal-purple',
        'sublime',
        'white',
        'yellow',
      ],
      prices: [
        {
          slug: 'tile',
          priceCents: 1123,
          saleUnit: 'tile',
          sourceUrl: FREE_FLOW_XLC_URL,
          sourceKind: 'manufacturer-store',
          seller: 'RaceDeck',
          note:
            'USD 11.23 for a single tile (SKU FFXLC) with an order minimum of 1. The page headline ' +
            'reads "$4.99 sqft", which is the same money as USD 11.23 across a 2.25 sq ft tile; ' +
            'only the per-tile basis RaceDeck actually sells on is seeded. RaceDeck also runs a ' +
            'separate clearance listing for this tile at USD 6.58 to 10.98 in Beige and Chalk ' +
            'only, with one unit in stock, which is not seeded as an offer. RaceDeck publishes ' +
            '0.625 in thickness in its DIMENSIONS block but 0.75 in both in a marketing bullet ' +
            'and in its store record; the DIMENSIONS block is what is seeded.',
        },
      ],
    },
    {
      id: 'racedeck-garageflow',
      name: 'RaceDeck GarageFlow',
      checkedDate: DRAINABLE_CHECKED_DATE,
      dimensions: { widthInches: 12, lengthInches: 12, thicknessInches: 0.5 },
      rotationRule: 'fixed',
      rotationRuleRationale: FIXED_ROTATION_RATIONALE,
      dimensionsSource: {
        url: GARAGEFLOW_URL,
        kind: 'manufacturer-official',
        checkedDate: DRAINABLE_CHECKED_DATE,
        quote: '12" x 12" x 0.5" (304.8 mm x 304.8 mm x 12.7 mm), Weight: 15 oz. (431.1 g)',
      },
      colorsSource: {
        url: GARAGEFLOW_URL,
        kind: 'manufacturer-official',
        checkedDate: DRAINABLE_CHECKED_DATE,
      },
      surfaceStyle: {
        label: 'Self-draining',
        source: {
          url: GARAGEFLOW_URL,
          kind: 'manufacturer-official',
          checkedDate: DRAINABLE_CHECKED_DATE,
          quote: 'one sq. ft. self-draining garage flooring tiles',
        },
      },
      drainage: {
        isDrainable: true,
        surfaceOpenness: 'open-drainable',
        evidence:
          'RaceDeck sells GarageFlow as "one sq. ft. self-draining garage flooring tiles" and ' +
          'positions it "FOR GARAGES THAT ENCOUNTER WATER & SNOW ... your choice for affordable ' +
          'self-draining, reinforced flooring".',
        source: {
          url: GARAGEFLOW_URL,
          kind: 'manufacturer-official',
          checkedDate: DRAINABLE_CHECKED_DATE,
          quote:
            'Garage Flow is your choice for affordable self-draining, reinforced flooring. Keep ' +
            'your cars and other toys high and dry',
        },
      },
      image: {
        imageUrl:
          'https://racedeck.com/wp-content/uploads/2022/08/garage-floor-tiles-large-garage-flow-' +
          'product.webp',
        sourcePageUrl: GARAGEFLOW_URL,
        attributionText: RACEDECK_PHOTO_ATTRIBUTION,
        altText:
          'RaceDeck GarageFlow self-draining tiles laid in a garage, showing the open drainage ' +
          'pattern across the tile faces.',
        checkedDate: DRAINABLE_CHECKED_DATE,
        rightsBasis: PRODUCT_IMAGE_RIGHTS_BASIS,
        hotlinkStability: 'medium',
        caveat: RACEDECK_PHOTO_CAVEAT,
      },
      colorSlugs: ['black', 'bright-blue', 'gray', 'red'],
      prices: [
        {
          slug: 'tile',
          priceCents: 269,
          saleUnit: 'tile',
          sourceUrl: GARAGEFLOW_URL,
          sourceKind: 'manufacturer-store',
          seller: 'RaceDeck',
          note:
            'USD 2.69 for a single tile, marked "33% off MSRP" against a regular USD 3.99, with ' +
            'an order minimum of 1. Two caveats belong with this price: RaceDeck lists the tile ' +
            'under Clearance, so the price and the stock behind it can end without notice, and ' +
            'RaceDeck states the tile is intended for light-duty residential garage use. ' +
            'RaceDeck publishes 15 oz in its description and 12.8 oz in its store record; ' +
            'neither weight is used here.',
        },
      ],
    },
    {
      id: 'racedeck-tuffshield',
      name: 'RaceDeck TuffShield',
      dimensions: { widthInches: 12, lengthInches: 12, thicknessInches: 0.5 },
      rotationRule: 'fixed',
      rotationRuleRationale: FIXED_ROTATION_RATIONALE,
      dimensionsSource: {
        url: 'https://racedeck.com/racedeck-garage-floors-and-tiles/racedeck-tuffshield/',
        kind: 'manufacturer-official',
        checkedDate: CATALOG_CHECKED_DATE,
        quote: TWELVE_INCH_DIMENSIONS_QUOTE,
      },
      colorsSource: {
        url: 'https://racedeck.com/racedeck-garage-floors-and-tiles/racedeck-tuffshield/',
        kind: 'manufacturer-official',
        checkedDate: CATALOG_CHECKED_DATE,
      },
      surfaceStyle: {
        label: 'Diamond plate with TuffShield coating',
        source: {
          url: 'https://racedeck.com/racedeck-garage-floors-and-tiles/racedeck-tuffshield/',
          kind: 'manufacturer-official',
          checkedDate: CATALOG_CHECKED_DATE,
          quote: 'RaceDeck TuffShield',
        },
      },
      drainage: closedTop(
        'https://racedeck.com/racedeck-garage-floors-and-tiles/racedeck-tuffshield/',
        'A closed coated diamond-plate top. The page makes no perforation, open-profile, or ' +
          'self-draining claim about the surface; its only air and moisture claim is about the ' +
          'substructure underneath the tile.'
      ),
      colorSlugs: [
        'alloy',
        'beige',
        'black',
        'espresso',
        'graphite',
        'green-light',
        'orange',
        'red',
        'royal-blue',
        'royal-purple',
        'sublime',
        'white',
        'yellow',
      ],
      prices: [
        {
          slug: 'tile',
          priceCents: 585,
          saleUnit: 'tile',
          sourceUrl: 'https://racedeck.com/racedeck-garage-floors-and-tiles/racedeck-tuffshield/',
          sourceKind: 'manufacturer-store',
          seller: 'RaceDeck',
          note:
            'USD 5.85 for a single tile without ShockTower. The same tile with ShockTower was ' +
            'listed at USD 6.75, but only in a subset of colors.',
        },
      ],
    },
    {
      id: 'racedeck-circletrac',
      name: 'RaceDeck CircleTrac',
      dimensions: { widthInches: 12, lengthInches: 12, thicknessInches: 0.5 },
      rotationRule: 'fixed',
      rotationRuleRationale: FIXED_ROTATION_RATIONALE,
      dimensionsSource: {
        url: 'https://racedeck.com/racedeck-garage-floors-and-tiles/circletrac/',
        kind: 'manufacturer-official',
        checkedDate: CATALOG_CHECKED_DATE,
        quote: TWELVE_INCH_DIMENSIONS_QUOTE,
      },
      colorsSource: {
        url: 'https://racedeck.com/racedeck-garage-floors-and-tiles/circletrac/',
        kind: 'manufacturer-official',
        checkedDate: CATALOG_CHECKED_DATE,
      },
      surfaceStyle: {
        label: 'Circle coin top',
        source: {
          url: 'https://racedeck.com/racedeck-garage-floors-and-tiles/circletrac/',
          kind: 'manufacturer-official',
          checkedDate: CATALOG_CHECKED_DATE,
          quote: 'RaceDeck CircleTrac',
        },
      },
      drainage: closedTop(
        'https://racedeck.com/racedeck-garage-floors-and-tiles/circletrac/',
        'A closed circle-coin top. The page makes no perforation, open-profile, or self-draining ' +
          'claim about the surface; its only air and moisture claim is about the substructure ' +
          'underneath the tile.'
      ),
      colorSlugs: [
        'alloy',
        'beige',
        'black',
        'chalk',
        'espresso',
        'graphite',
        'green-light',
        'orange',
        'red',
        'royal-blue',
        'royal-purple',
        'sublime',
        'white',
        'yellow',
      ],
      prices: [
        {
          slug: 'tile',
          priceCents: 485,
          saleUnit: 'tile',
          sourceUrl: 'https://racedeck.com/racedeck-garage-floors-and-tiles/circletrac/',
          sourceKind: 'manufacturer-store',
          seller: 'RaceDeck',
          note:
            'USD 4.85 for a single tile without ShockTower. The same tile with ShockTower was ' +
            'listed at USD 5.85.',
        },
      ],
    },
    {
      id: 'racedeck-xl',
      name: 'RaceDeck XL',
      dimensions: { widthInches: 18, lengthInches: 18, thicknessInches: 0.5 },
      rotationRule: 'fixed',
      rotationRuleRationale: FIXED_ROTATION_RATIONALE,
      dimensionsSource: {
        url: 'https://racedeck.com/racedeck-garage-floors-and-tiles/racedeck-xl/',
        kind: 'manufacturer-official',
        checkedDate: CATALOG_CHECKED_DATE,
        quote: '18" x 18" x 0.5" (457.28 mm x 457.28 mm x 12.7 mm)',
      },
      colorsSource: {
        url: 'https://racedeck.com/racedeck-garage-floors-and-tiles/racedeck-xl/',
        kind: 'manufacturer-official',
        checkedDate: CATALOG_CHECKED_DATE,
      },
      surfaceStyle: {
        label: 'Diamond plate',
        source: {
          url: 'https://racedeck.com/racedeck-garage-floors-and-tiles/racedeck-xl/',
          kind: 'manufacturer-official',
          checkedDate: CATALOG_CHECKED_DATE,
          quote: 'RaceDeck XL',
        },
      },
      drainage: closedTop(
        'https://racedeck.com/racedeck-garage-floors-and-tiles/racedeck-xl/',
        'A closed diamond-plate top in the 18 inch size. The page makes no perforation, ' +
          'open-profile, or self-draining claim about the surface; its only air and moisture ' +
          'claim is about the substructure underneath the tile.'
      ),
      colorSlugs: [
        'alloy',
        'beige',
        'black',
        'chalk',
        'espresso',
        'graphite',
        'green-light',
        'orange',
        'red',
        'royal-blue',
        'royal-purple',
        'sublime',
        'white',
        'yellow',
      ],
      prices: [
        {
          slug: 'tile',
          priceCents: 1091,
          saleUnit: 'tile',
          sourceUrl: 'https://racedeck.com/racedeck-garage-floors-and-tiles/racedeck-xl/',
          sourceKind: 'manufacturer-store',
          seller: 'RaceDeck',
          note:
            'USD 10.91 for a single tile without ShockTower. The same tile with ShockTower was ' +
            'listed at USD 12.00.',
        },
      ],
    },
  ],
};
