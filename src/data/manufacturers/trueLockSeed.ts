import {
  PRODUCT_IMAGE_RIGHTS_BASIS,
  TRUELOCK_CHECKED_DATE,
  type RawManufacturerSeed,
  type RawPalette,
} from '../seedTypes';

const TRUELOCK_PALETTE: RawPalette = {
  'alloy-silver': {
    name: 'Alloy Silver',
    vendorColorToken: 'Alloy Silver',
    approximateSwatchHex: '#A6A9A8',
  },
  beige: { name: 'Beige', vendorColorToken: 'Beige', approximateSwatchHex: '#C7B38F' },
  black: { name: 'Black', vendorColorToken: 'Black', approximateSwatchHex: '#17191B' },
  'graphite-gray': {
    name: 'Graphite Gray',
    vendorColorToken: 'Graphite Gray',
    approximateSwatchHex: '#55595C',
  },
  orange: { name: 'Orange', vendorColorToken: 'Orange', approximateSwatchHex: '#DF681C' },
  purple: { name: 'Purple', vendorColorToken: 'Purple', approximateSwatchHex: '#633D8B' },
  red: { name: 'Red', vendorColorToken: 'Red', approximateSwatchHex: '#BD2B31' },
  'royal-blue': {
    name: 'Royal Blue',
    vendorColorToken: 'Royal Blue',
    approximateSwatchHex: '#24549A',
  },
  white: { name: 'White', vendorColorToken: 'White', approximateSwatchHex: '#F1F2EF' },
  yellow: { name: 'Yellow', vendorColorToken: 'Yellow', approximateSwatchHex: '#E6BD25' },
};

const PRODUCT_URL = 'https://www.garageflooringllc.com/product/ribbed-flow-through-tile/';

export const TRUELOCK_SEED: RawManufacturerSeed = {
  id: 'truelock',
  name: 'TrueLock',
  trademarkNotice:
    'TrueLock and the product name above are trademarks of their respective owners. Used only ' +
    'to identify the product described. This project is not affiliated with Garage Flooring LLC.',
  sourceHostnames: ['www.garageflooringllc.com'],
  imageHostnames: ['www.garageflooringllc.com'],
  palette: TRUELOCK_PALETTE,
  products: [
    {
      id: 'truelock-hd-ribbed-flow-through-12in',
      name: 'HD/HDXT Ribbed Flow Through Tile (12 x 12 in)',
      checkedDate: TRUELOCK_CHECKED_DATE,
      dimensions: { widthInches: 12, lengthInches: 12, thicknessInches: 0.5 },
      rotationRule: 'fixed',
      rotationRuleRationale:
        'The installation uses directional male and female edges and publishes no rotated-tile option.',
      dimensionsSource: {
        url: PRODUCT_URL,
        kind: 'manufacturer-store',
        checkedDate: TRUELOCK_CHECKED_DATE,
        quote: 'Each of our Ribbed Flow Through tiles measures 12" x 12" x 1/2" thick.',
      },
      colorsSource: {
        url: PRODUCT_URL,
        kind: 'manufacturer-store',
        checkedDate: TRUELOCK_CHECKED_DATE,
        quote:
          'Alloy Silver, Beige, Black, Graphite Gray, Orange, Purple, Red, Royal Blue, White, Yellow',
      },
      surfaceStyle: {
        label: 'Ribbed Flow Through',
        source: {
          url: PRODUCT_URL,
          kind: 'manufacturer-store',
          checkedDate: TRUELOCK_CHECKED_DATE,
          quote:
            'Ribbed tiles are vented on top, allowing water and snowmelt to fall through the face.',
        },
      },
      drainage: {
        isDrainable: true,
        surfaceOpenness: 'open-drainable',
        evidence:
          'Garage Flooring LLC says the tile is vented on top so water and snowmelt fall through ' +
          'the visible face instead of remaining in puddles.',
        source: {
          url: PRODUCT_URL,
          kind: 'manufacturer-store',
          checkedDate: TRUELOCK_CHECKED_DATE,
          quote:
            'Ribbed tiles are vented on top, allowing water and snowmelt to fall through the face, keeping you out of puddles.',
        },
      },
      plannerCaveat:
        'Garage Flooring LLC describes this as its own lower-cost version of a leading national ' +
        'brand, and its imagery and specifications closely match RaceDeck Free-Flow. Treat it as ' +
        'a private-label purchasing alternative, not an independent tile design. Opposing ribs ' +
        'can also make one color appear as two shades when viewed at an angle.',
      image: {
        imageUrl:
          'https://www.garageflooringllc.com/wp-content/uploads/Nick-TrueLock-HD-Ribbed.jpg',
        sourcePageUrl: PRODUCT_URL,
        attributionText:
          'Photo (c) Garage Flooring LLC. Used to identify the product. Not affiliated.',
        altText: 'TrueLock HD ribbed flow-through garage tiles installed beneath a parked vehicle.',
        checkedDate: TRUELOCK_CHECKED_DATE,
        rightsBasis: PRODUCT_IMAGE_RIGHTS_BASIS,
        hotlinkStability: 'medium',
        caveat: 'Plain WordPress upload path that can change if the seller reorganizes media.',
      },
      colorSlugs: [
        'alloy-silver',
        'beige',
        'black',
        'graphite-gray',
        'orange',
        'purple',
        'red',
        'royal-blue',
        'white',
        'yellow',
      ],
      prices: [
        {
          slug: 'tile',
          priceCents: 349,
          saleUnit: 'tile',
          publishedCoverageSquareFeet: 1,
          sourceUrl: PRODUCT_URL,
          sourceKind: 'manufacturer-store',
          seller: 'Garage Flooring LLC',
          sourceProductCode: 'HDRIB',
          note:
            'Listed at USD 3.49 per tile on sale against USD 3.79. One 12 x 12 inch tile covers ' +
            'one square foot; the minimum order is one tile.',
        },
      ],
    },
  ],
};
