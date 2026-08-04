import {
  DRAINABLE_CHECKED_DATE,
  PRODUCT_IMAGE_RIGHTS_BASIS,
  type RawManufacturerSeed,
  type RawPalette,
} from '../seedTypes';

/**
 * ModuTile seed data: the lowest-cost verified drainable tile in the catalog.
 *
 * Dimensions, the color list, the surface pattern, and the price were read on 2026-07-29 from
 * ModuTile's own store at modutile.com, which publishes a machine-readable product record with one
 * purchasable variation per color plus a published attribute table. Nothing here is fetched at
 * runtime; the values are a point-in-time snapshot committed to source.
 *
 * ModuTile does not publish hex or RGB values for its color names, so every swatch below is an
 * approximation chosen for on-screen preview only. Color names are reproduced verbatim.
 *
 * Only the perforated garage tile is seeded. ModuTile's coin-top, diamond-top, and flexible PVC
 * lines are closed-surface tiles, and its perforated patio, sport-court, and trade-show tiles are
 * the same open grid but are not marketed for garages, so none of them are seeded here.
 */

const MODUTILE_PALETTE: RawPalette = {
  beige: { name: 'Beige', vendorColorToken: 'Beige', approximateSwatchHex: '#D8C9AC' },
  black: { name: 'Black', vendorColorToken: 'Black', approximateSwatchHex: '#1B1B1B' },
  blue: { name: 'Blue', vendorColorToken: 'Blue', approximateSwatchHex: '#1F52A0' },
  brown: { name: 'Brown', vendorColorToken: 'Brown', approximateSwatchHex: '#5A3B27' },
  gray: { name: 'Gray', vendorColorToken: 'Gray', approximateSwatchHex: '#8D9195' },
  green: { name: 'Green', vendorColorToken: 'Green', approximateSwatchHex: '#2F7D42' },
  orange: { name: 'Orange', vendorColorToken: 'Orange', approximateSwatchHex: '#E2691B' },
  purple: { name: 'Purple', vendorColorToken: 'Purple', approximateSwatchHex: '#5B2D8E' },
  red: { name: 'Red', vendorColorToken: 'Red', approximateSwatchHex: '#C22026' },
  white: { name: 'White', vendorColorToken: 'White', approximateSwatchHex: '#F2F2EF' },
  yellow: { name: 'Yellow', vendorColorToken: 'Yellow', approximateSwatchHex: '#F0C21B' },
};

const PERFORATED_TILE_URL = 'https://modutile.com/product/perforated-garage-floor-tiles-12x12-pp/';

export const MODUTILE_SEED: RawManufacturerSeed = {
  id: 'modutile',
  name: 'ModuTile',
  trademarkNotice:
    'ModuTile and the product name above are trademarks of their respective owners. Used here ' +
    'only to identify the product described. This project is not affiliated with, authorized by, ' +
    'or endorsed by ModuTile.',
  sourceHostnames: ['modutile.com'],
  imageHostnames: ['modutile.com'],
  palette: MODUTILE_PALETTE,
  products: [
    {
      id: 'modutile-perforated-garage-tile',
      name: 'Perforated Garage Floor Tiles - Drain (12 x 12 in)',
      checkedDate: DRAINABLE_CHECKED_DATE,
      dimensions: { widthInches: 12, lengthInches: 12, thicknessInches: 0.5 },
      rotationRule: 'fixed',
      rotationRuleRationale:
        'The listing publishes a loop-to-peg interlocking system, which pairs a loop edge against ' +
        'a peg edge, and no rotated-tile installation option, so rotation is treated as fixed.',
      dimensionsSource: {
        url: PERFORATED_TILE_URL,
        kind: 'manufacturer-store',
        checkedDate: DRAINABLE_CHECKED_DATE,
        quote: 'Size 12" x 12" x 1/2"; Coverage 1 sq. ft. per tile',
      },
      colorsSource: {
        url: PERFORATED_TILE_URL,
        kind: 'manufacturer-store',
        checkedDate: DRAINABLE_CHECKED_DATE,
        quote: 'Color Beige, Black, Blue, Brown, Gray, Green, Orange, Purple, Red, White, Yellow',
      },
      surfaceStyle: {
        label: 'Mesh - Perforated w/ Anti-Slip Resistance',
        source: {
          url: PERFORATED_TILE_URL,
          kind: 'manufacturer-store',
          checkedDate: DRAINABLE_CHECKED_DATE,
          quote: 'Surface Pattern Mesh - Perforated w/ Anti-Slip Resistance',
        },
      },
      drainage: {
        isDrainable: true,
        surfaceOpenness: 'open-drainable',
        evidence:
          'The listing states these tiles "are designed for maximum water drainage", names the ' +
          'surface pattern "Mesh - Perforated w/ Anti-Slip Resistance", and lists "Water Flow" ' +
          'among its special features.',
        source: {
          url: PERFORATED_TILE_URL,
          kind: 'manufacturer-store',
          checkedDate: DRAINABLE_CHECKED_DATE,
          quote: 'They are designed for maximum water drainage.',
        },
      },
      image: {
        imageUrl:
          'https://modutile.com/wp-content/uploads/2018/10/perforated-garage-floor-tiles-12x1-a' +
          '.jp2g.jpg',
        sourcePageUrl: PERFORATED_TILE_URL,
        attributionText: 'Photo (c) ModuTile. Used to identify the product. Not affiliated.',
        altText:
          'Stack of ModuTile perforated garage floor tiles showing the open mesh drainage grid ' +
          'across the top surface.',
        checkedDate: DRAINABLE_CHECKED_DATE,
        rightsBasis: PRODUCT_IMAGE_RIGHTS_BASIS,
        hotlinkStability: 'medium',
        caveat:
          'Plain WordPress upload path, unchanged since 2018, but the site sits behind a ' +
          'LiteSpeed cache that could rewrite asset URLs.',
      },
      colorSlugs: [
        'gray',
        'black',
        'white',
        'beige',
        'brown',
        'blue',
        'red',
        'orange',
        'green',
        'purple',
        'yellow',
      ],
      prices: [
        {
          slug: 'tile',
          priceCents: 198,
          saleUnit: 'tile',
          publishedCoverageSquareFeet: 1,
          sourceUrl: PERFORATED_TILE_URL,
          sourceKind: 'manufacturer-store',
          seller: 'ModuTile',
          note:
            'Listed at USD 1.98 on sale against a regular USD 2.59. ModuTile quotes the price per ' +
            'square foot and publishes "Coverage 1 sq. ft. per tile", so one tile is one square ' +
            'foot and the two bases are the same number. Every color shared the price, and each ' +
            'color variation was individually purchasable with a minimum order of one.',
        },
      ],
    },
  ],
};
