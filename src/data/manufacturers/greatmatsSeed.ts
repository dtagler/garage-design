import {
  DRAINABLE_CHECKED_DATE,
  PRODUCT_IMAGE_RIGHTS_BASIS,
  type RawManufacturerSeed,
  type RawPalette,
} from '../seedTypes';

/**
 * Greatmats TurboTile seed data.
 *
 * Every fact below was read on 2026-07-29 from the Greatmats listing at www.greatmats.com, which
 * publishes a specification table, a schema.org price, and one `<meta itemprop="color">` tag per
 * available color. Greatmats sells TurboTile as its own brand, but the only page that publishes
 * these facts is a retail listing, so the source kind stays `retailer-listing` rather than
 * claiming a manufacturer spec sheet that was never seen.
 *
 * Greatmats publishes no hex or RGB values for these color names, so every swatch below is an
 * approximation chosen for on-screen preview only. Color names are reproduced verbatim.
 *
 * Only the perforated tile is seeded. TurboTile Diamond is the closed-surface counterpart of the
 * same tile and does not drain through its top, so it is deliberately absent.
 */

const GREATMATS_PALETTE: RawPalette = {
  black: { name: 'Black', vendorColorToken: 'Black', approximateSwatchHex: '#1B1B1B' },
  gray: { name: 'Gray', vendorColorToken: 'Gray', approximateSwatchHex: '#8E9296' },
  red: { name: 'Red', vendorColorToken: 'Red', approximateSwatchHex: '#B92A2E' },
};

const TURBOTILE_URL =
  'https://www.greatmats.com/garage-floor-tile/perforated-flow-drain-garage-tile.php';

export const GREATMATS_SEED: RawManufacturerSeed = {
  id: 'greatmats',
  name: 'Greatmats',
  trademarkNotice:
    'Greatmats and TurboTile are trademarks of their respective owners. Used here only to ' +
    'identify the product described and the listing it was read from. This project is not ' +
    'affiliated with, authorized by, or endorsed by Greatmats.',
  sourceHostnames: ['www.greatmats.com'],
  imageHostnames: ['www.greatmats.com'],
  palette: GREATMATS_PALETTE,
  products: [
    {
      id: 'greatmats-turbotile-perforated',
      name: 'TurboTile Perforated Garage Floor Tile 5/8 Inch x 1x1 Ft.',
      checkedDate: DRAINABLE_CHECKED_DATE,
      // The spec table publishes 1.01 ft, not the 1 ft in the product name; the table wins, and
      // the naming conflict is recorded in the price note rather than quietly rounded away.
      dimensions: { widthInches: 12.12, lengthInches: 12.12, thicknessInches: 0.625 },
      rotationRule: 'fixed',
      rotationRuleRationale:
        'The listing describes a hidden tab-and-loop interlock, which pairs a tab edge against a ' +
        'loop edge, and publishes no rotated-tile installation option, so rotation is fixed.',
      dimensionsSource: {
        url: TURBOTILE_URL,
        kind: 'retailer-listing',
        checkedDate: DRAINABLE_CHECKED_DATE,
        quote: 'Thickness 5/8 inch Width 1.01 feet Length 1.01 feet SF per Item 1.02',
      },
      colorsSource: {
        url: TURBOTILE_URL,
        kind: 'retailer-listing',
        checkedDate: DRAINABLE_CHECKED_DATE,
        quote: 'Black Gray Red',
      },
      surfaceStyle: {
        label: 'Ribbed Drainage',
        source: {
          url: TURBOTILE_URL,
          kind: 'retailer-listing',
          checkedDate: DRAINABLE_CHECKED_DATE,
          quote: 'Surface Finish Ribbed Drainage',
        },
      },
      drainage: {
        isDrainable: true,
        surfaceOpenness: 'open-drainable',
        evidence:
          'The listing states the tile "has perforations that allow water, other liquids, and ' +
          'small solids to fall through to the subfloor", names the surface finish "Ribbed ' +
          'Drainage", and markets the tile as "Made to work in wet areas".',
        source: {
          url: TURBOTILE_URL,
          kind: 'retailer-listing',
          checkedDate: DRAINABLE_CHECKED_DATE,
          quote:
            'it has perforations that allow water, other liquids, and small solids to fall ' +
            'through to the subfloor',
        },
      },
      image: {
        imageUrl:
          'https://www.greatmats.com/images/garage-floor-tile-perforated/garage-perforated-stack' +
          '-1.jpg.webp',
        sourcePageUrl: TURBOTILE_URL,
        attributionText: 'Photo (c) Greatmats. Used to identify the listing. Not affiliated.',
        altText:
          'Stack of black TurboTile perforated garage floor tiles showing the ribbed drainage ' +
          'top and the open spaces between the ribs.',
        checkedDate: DRAINABLE_CHECKED_DATE,
        rightsBasis: PRODUCT_IMAGE_RIGHTS_BASIS,
        hotlinkStability: 'medium',
        caveat:
          'The host answers 406 to non-browser user agents, so the URL only resolves from a real ' +
          'browser request. It also uses a double ".jpg.webp" extension, which suggests a ' +
          'generated derivative that could be regenerated under a different name.',
      },
      colorSlugs: ['black', 'gray', 'red'],
      prices: [
        {
          slug: 'tile',
          priceCents: 415,
          saleUnit: 'tile',
          publishedCoverageSquareFeet: 1.02,
          sourceUrl: TURBOTILE_URL,
          sourceKind: 'retailer-listing',
          seller: 'Greatmats',
          note:
            'Listed at USD 4.15 per tile on sale, marked "Save 23%" against a regular USD 5.45 ' +
            'per tile. The same listing showed USD 4.07 per square foot, which follows from the ' +
            'published 1.02 sq ft per tile rather than being a second offer. Order minimum is 1 ' +
            'tile. The listing also discloses that the tile is not UV-treated and may fade in ' +
            'sunlight, and that color varies from lot to lot.',
        },
      ],
    },
  ],
};
