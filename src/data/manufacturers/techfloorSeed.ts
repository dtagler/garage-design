import { CATALOG_CHECKED_DATE, type RawManufacturerSeed, type RawPalette } from '../seedTypes';

/**
 * TechFloor seed data: a second lower-cost, pack-priced option alongside VEVOR.
 *
 * TechFloor is a WeatherTech product line. WeatherTech does not publish a reachable spec page for
 * this carton, so every fact below was read on 2026-07-28 from the Greatmats retail listing at
 * www.greatmats.com, which publishes a specification table, a schema.org price, and one
 * `<meta itemprop="color">` tag per available color. That source is recorded as a retailer listing
 * rather than a manufacturer page, and it is the only hostname this brand's sources may use.
 *
 * Neither TechFloor nor Greatmats publishes hex or RGB values for these color names, so every
 * swatch below is an approximation chosen for on-screen preview only. Color names are reproduced
 * verbatim, including the British "Grey" spelling the listing uses.
 *
 * Only the Solid tile with raised squares is seeded. The TechFloor Premium tile with traction top
 * is listed on the same site but is not seeded, because its published color list could not be tied
 * to a single verified tile size and thickness on the checked date.
 *
 * The carton price was a sale price on the checked date: the listing showed "$27.36 /carton",
 * "Save 20%", and "Reg: $34.20 /carton". The current selling price is what is recorded.
 */

const TECHFLOOR_PALETTE: RawPalette = {
  black: { name: 'Black', vendorColorToken: 'Black', approximateSwatchHex: '#1A1A1A' },
  blue: { name: 'Blue', vendorColorToken: 'Blue', approximateSwatchHex: '#1F5FA9' },
  'dark-grey': {
    name: 'Dark Grey',
    vendorColorToken: 'Dark Grey',
    approximateSwatchHex: '#4A4E52',
  },
  grey: { name: 'Grey', vendorColorToken: 'Grey', approximateSwatchHex: '#9A9EA2' },
  red: { name: 'Red', vendorColorToken: 'Red', approximateSwatchHex: '#C0272D' },
  tan: { name: 'Tan', vendorColorToken: 'Tan', approximateSwatchHex: '#C8B294' },
  white: { name: 'White', vendorColorToken: 'White', approximateSwatchHex: '#F2F2EF' },
};

const SOLID_TILE_URL =
  'https://www.greatmats.com/garage-floor-tiles/techfloor-standard-solid-raised-squares.php';

export const TECHFLOOR_SEED: RawManufacturerSeed = {
  id: 'techfloor',
  name: 'TechFloor',
  trademarkNotice:
    'TechFloor and WeatherTech are trademarks of their respective owners, and Greatmats is a ' +
    'trademark of its respective owner. Used here only to identify the product described and the ' +
    'listing it was read from. This project is not affiliated with, authorized by, or endorsed by ' +
    'any of them.',
  sourceHostnames: ['www.greatmats.com'],
  palette: TECHFLOOR_PALETTE,
  products: [
    {
      id: 'techfloor-solid-raised-squares',
      name: 'Solid Garage Tile with Raised Squares',
      dimensions: { widthInches: 12, lengthInches: 12, thicknessInches: 0.25 },
      rotationRule: 'fixed',
      rotationRuleRationale:
        'The listing describes a loop-and-tab edge, which pairs a loop edge against a tab edge, ' +
        'and publishes no rotated-tile installation option, so rotation is treated as fixed.',
      dimensionsSource: {
        url: SOLID_TILE_URL,
        kind: 'retailer-listing',
        checkedDate: CATALOG_CHECKED_DATE,
        quote: 'Thickness 1/4 inch Width 1.00 feet Length 1.00 feet',
      },
      colorsSource: {
        url: SOLID_TILE_URL,
        kind: 'retailer-listing',
        checkedDate: CATALOG_CHECKED_DATE,
        quote: 'Black/Black Blue/Blue Dark Grey/Dark Grey Grey/Grey Red/Red Tan/Tan White/White',
      },
      surfaceStyle: {
        label: 'Raised squares',
        source: {
          url: SOLID_TILE_URL,
          kind: 'retailer-listing',
          checkedDate: CATALOG_CHECKED_DATE,
          quote: 'Surface Finish Raised squares',
        },
      },
      drainage: {
        isDrainable: false,
        surfaceOpenness: 'closed',
        evidence:
          'The tile is named "Solid" and the listing publishes "Surface Finish Raised squares" ' +
          'with no perforation, drainage, or open-profile claim.',
        source: {
          url: SOLID_TILE_URL,
          kind: 'retailer-listing',
          checkedDate: CATALOG_CHECKED_DATE,
          quote: 'Surface Finish Raised squares',
        },
      },
      colorSlugs: ['black', 'blue', 'dark-grey', 'grey', 'red', 'tan', 'white'],
      prices: [
        {
          slug: 'carton-10',
          priceCents: 2736,
          saleUnit: 'pack',
          packQuantity: 10,
          publishedCoverageSquareFeet: 10,
          sourceUrl: SOLID_TILE_URL,
          sourceKind: 'retailer-listing',
          seller: 'Greatmats',
          note:
            'Listed at USD 27.36 per carton of 10, marked "Save 20%" against a regular USD 34.20. ' +
            'The listing quotes one carton price for every color.',
        },
      ],
    },
  ],
};
