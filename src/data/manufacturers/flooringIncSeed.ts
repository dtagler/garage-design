import {
  FLOORINGINC_CHECKED_DATE,
  PRODUCT_IMAGE_RIGHTS_BASIS,
  type RawManufacturerSeed,
  type RawPalette,
} from '../seedTypes';

const FLOORINGINC_PALETTE: RawPalette = {
  'midnight-black': {
    name: 'Midnight Black',
    vendorColorToken: 'Midnight Black',
    approximateSwatchHex: '#17191B',
  },
  'arctic-white': {
    name: 'Arctic White',
    vendorColorToken: 'Arctic White',
    approximateSwatchHex: '#F1F2EF',
  },
  graphite: { name: 'Graphite', vendorColorToken: 'Graphite', approximateSwatchHex: '#555A5D' },
  gunmetal: { name: 'Gunmetal', vendorColorToken: 'Gunmetal', approximateSwatchHex: '#747A7D' },
  'harley-orange': {
    name: 'Harley Orange',
    vendorColorToken: 'Harley Orange',
    approximateSwatchHex: '#D95F19',
  },
  'sahara-sand': {
    name: 'Sahara Sand',
    vendorColorToken: 'Sahara Sand',
    approximateSwatchHex: '#C8AE7C',
  },
  'shelby-blue': {
    name: 'Shelby Blue',
    vendorColorToken: 'Shelby Blue',
    approximateSwatchHex: '#2465A3',
  },
  'victory-red': {
    name: 'Victory Red',
    vendorColorToken: 'Victory Red',
    approximateSwatchHex: '#B9282F',
  },
  black: { name: 'Black', vendorColorToken: 'Black', approximateSwatchHex: '#17191B' },
  blue: { name: 'Blue', vendorColorToken: 'Blue', approximateSwatchHex: '#22599A' },
  brown: { name: 'Brown', vendorColorToken: 'Brown', approximateSwatchHex: '#5C3D2A' },
  green: { name: 'Green', vendorColorToken: 'Green', approximateSwatchHex: '#317546' },
  orange: { name: 'Orange', vendorColorToken: 'Orange', approximateSwatchHex: '#DF681C' },
  purple: { name: 'Purple', vendorColorToken: 'Purple', approximateSwatchHex: '#633D8B' },
  red: { name: 'Red', vendorColorToken: 'Red', approximateSwatchHex: '#BD2B31' },
  sand: { name: 'Sand', vendorColorToken: 'Sand', approximateSwatchHex: '#C7B083' },
  white: { name: 'White', vendorColorToken: 'White', approximateSwatchHex: '#F1F2EF' },
  yellow: { name: 'Yellow', vendorColorToken: 'Yellow', approximateSwatchHex: '#E6BD25' },
};

const NITRO_URL = 'https://www.flooringinc.com/shop/nitro-tiles-7266.html';
const GRID_LOC_URL = 'https://www.flooringinc.com/shop/vented-grid-loc-tilestm-3254.html';
const GARAGE_TILE_URL = 'https://www.flooringinc.com/shop/garage-flooring/garage-tiles.html';

const NITRO_PRICE_BY_COLOR = {
  'midnight-black': 225,
  'arctic-white': 249,
  graphite: 249,
  gunmetal: 249,
  'harley-orange': 249,
  'sahara-sand': 199,
  'shelby-blue': 249,
  'victory-red': 249,
} as const;

export const FLOORINGINC_SEED: RawManufacturerSeed = {
  id: 'flooringinc',
  name: 'FlooringInc',
  trademarkNotice:
    'FlooringInc and the product names above are trademarks of their respective owners. Used ' +
    'only to identify the products described. This project is not affiliated with FlooringInc.',
  sourceHostnames: ['www.flooringinc.com'],
  imageHostnames: ['www.flooringinc.com'],
  palette: FLOORINGINC_PALETTE,
  products: [
    {
      id: 'flooringinc-nitro-vented-12in',
      name: 'Nitro Garage Floor Tiles - Vented Pattern (12 x 12 in)',
      checkedDate: FLOORINGINC_CHECKED_DATE,
      dimensions: { widthInches: 12, lengthInches: 12, thicknessInches: 0.375 },
      rotationRule: 'fixed',
      rotationRuleRationale:
        'The installation uses directional peg-and-loop edges and publishes no rotated-tile option.',
      dimensionsSource: {
        url: NITRO_URL,
        kind: 'manufacturer-store',
        checkedDate: FLOORINGINC_CHECKED_DATE,
        quote: 'Nitro Garage Floor Tiles - 12" x 12" x 3/8"',
      },
      colorsSource: {
        url: NITRO_URL,
        kind: 'manufacturer-store',
        checkedDate: FLOORINGINC_CHECKED_DATE,
        quote:
          'Midnight Black, Arctic White, Graphite, Gunmetal, Harley Orange, Sahara Sand, Shelby Blue, Victory Red',
      },
      surfaceStyle: {
        label: 'Vented Pattern',
        source: {
          url: NITRO_URL,
          kind: 'manufacturer-store',
          checkedDate: FLOORINGINC_CHECKED_DATE,
          quote: 'Select An Option: Vented Pattern',
        },
      },
      drainage: {
        isDrainable: true,
        surfaceOpenness: 'open-drainable',
        evidence:
          'FlooringInc says its vented garage tiles allow water and other liquids to flow through ' +
          'the floor to drains or out of the garage.',
        source: {
          url: GARAGE_TILE_URL,
          kind: 'manufacturer-store',
          checkedDate: FLOORINGINC_CHECKED_DATE,
          quote:
            'These tiles do allow water and other liquids to easily flow through the floor and under to any drains or out of the garage.',
        },
      },
      plannerCaveat:
        'FlooringInc says these tiles are not car-jack approved. Put the jack on concrete or use ' +
        'a plywood board or steel plate. Published colors can vary between production batches.',
      image: {
        imageUrl:
          'https://www.flooringinc.com/media/catalog/product/7/2/7266_9555_40648_image_general_sku_url_2.jpg',
        sourcePageUrl: NITRO_URL,
        attributionText: 'Photo (c) FlooringInc. Used to identify the product. Not affiliated.',
        altText: 'Midnight Black Nitro vented garage tile with an open drainage pattern.',
        checkedDate: FLOORINGINC_CHECKED_DATE,
        rightsBasis: PRODUCT_IMAGE_RIGHTS_BASIS,
        hotlinkStability: 'medium',
        caveat: 'Magento catalog image paths can change when the seller refreshes product media.',
      },
      colorSlugs: Object.keys(NITRO_PRICE_BY_COLOR),
      prices: Object.entries(NITRO_PRICE_BY_COLOR).map(([colorSlug, priceCents]) => ({
        slug: `tile-${colorSlug}`,
        priceCents,
        saleUnit: 'tile',
        colorSlug,
        publishedCoverageSquareFeet: 1,
        sourceUrl: NITRO_URL,
        sourceKind: 'manufacturer-store',
        seller: 'FlooringInc',
        sourceProductCode: '7266',
        note:
          'Price and color variant were read from FlooringInc storefront product data. One 12 x ' +
          '12 inch tile covers one square foot.',
      })),
    },
    {
      id: 'flooringinc-vented-grid-loc-12in',
      name: 'Vented Grid-Loc Garage Floor Tiles (12 x 12 in)',
      checkedDate: FLOORINGINC_CHECKED_DATE,
      dimensions: { widthInches: 12, lengthInches: 12, thicknessInches: 0.5 },
      rotationRule: 'fixed',
      rotationRuleRationale:
        'The installation uses directional peg-and-loop edges and publishes no rotated-tile option.',
      dimensionsSource: {
        url: GRID_LOC_URL,
        kind: 'manufacturer-store',
        checkedDate: FLOORINGINC_CHECKED_DATE,
        quote: 'Vented Grid-Loc Garage Floor Tiles - 12" x 12" x 1/2"',
      },
      colorsSource: {
        url: GRID_LOC_URL,
        kind: 'manufacturer-store',
        checkedDate: FLOORINGINC_CHECKED_DATE,
        quote:
          'Black, Blue, Brown, Graphite, Green, Gunmetal, Orange, Purple, Red, Sand, White, Yellow',
      },
      surfaceStyle: {
        label: 'Vented Grid-Loc',
        source: {
          url: GRID_LOC_URL,
          kind: 'manufacturer-store',
          checkedDate: FLOORINGINC_CHECKED_DATE,
          quote: 'Vented Grid-Loc Garage Floor Tiles',
        },
      },
      drainage: {
        isDrainable: true,
        surfaceOpenness: 'open-drainable',
        evidence:
          'FlooringInc links this product as a vented garage tile and says water and other liquids ' +
          'flow through the floor to drains or out of the garage.',
        source: {
          url: GARAGE_TILE_URL,
          kind: 'manufacturer-store',
          checkedDate: FLOORINGINC_CHECKED_DATE,
          quote:
            'These tiles do allow water and other liquids to easily flow through the floor and under to any drains or out of the garage.',
        },
      },
      plannerCaveat:
        'FlooringInc publishes conflicting UV guidance: its FAQ warns that direct sunlight can ' +
        'cause fading, while its product metadata describes the tile as UV stable.',
      image: {
        imageUrl:
          'https://www.flooringinc.com/media/catalog/product/I/m/Image_General_Product_Url_13_47.jpg',
        sourcePageUrl: GRID_LOC_URL,
        attributionText: 'Photo (c) FlooringInc. Used to identify the product. Not affiliated.',
        altText:
          'Black and red Vented Grid-Loc garage tiles in a checker pattern beneath a sports car.',
        checkedDate: FLOORINGINC_CHECKED_DATE,
        rightsBasis: PRODUCT_IMAGE_RIGHTS_BASIS,
        hotlinkStability: 'medium',
        caveat: 'Magento catalog image paths can change when the seller refreshes product media.',
      },
      colorSlugs: [
        'black',
        'blue',
        'brown',
        'graphite',
        'green',
        'gunmetal',
        'orange',
        'purple',
        'red',
        'sand',
        'white',
        'yellow',
      ],
      prices: [
        {
          slug: 'tile',
          priceCents: 449,
          saleUnit: 'tile',
          publishedCoverageSquareFeet: 1,
          sourceUrl: GRID_LOC_URL,
          sourceKind: 'manufacturer-store',
          seller: 'FlooringInc',
          sourceProductCode: '3254',
          note:
            'All twelve color variants shared the USD 4.49 price in FlooringInc storefront ' +
            'product data. One 12 x 12 inch tile covers one square foot.',
        },
      ],
    },
  ],
};
