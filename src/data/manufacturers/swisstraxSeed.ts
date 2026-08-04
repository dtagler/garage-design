import {
  CATALOG_CHECKED_DATE,
  PRODUCT_IMAGE_RIGHTS_BASIS,
  type RawManufacturerSeed,
  type RawPalette,
} from '../seedTypes';

/**
 * Swisstrax seed data.
 *
 * Dimensions, color lists, and prices were read on 2026-07-28 from Swisstrax's own web store at
 * store.swisstrax.com, which publishes a machine-readable product record per tile line. Nothing in
 * this file is fetched at runtime; the values are a point-in-time snapshot committed to source.
 *
 * Swisstrax does not publish hex or RGB values for its color names, so every swatch below is an
 * approximation chosen for on-screen preview only. Color names are reproduced verbatim.
 *
 * Only tile lines whose width, length, thickness, and full color list could all be verified are
 * included. Vinyltrax PRO, Vinyltrax 12-SERIES, and the Ribtrax PRO specialty color range are
 * deliberately omitted: their published color ranges are printed vinyl patterns rather than solid
 * colors, so a flat hex swatch would misrepresent them.
 */

const SWISSTRAX_PALETTE: RawPalette = {
  'arctic-white': {
    name: 'Arctic White',
    vendorColorToken: 'Arctic White',
    approximateSwatchHex: '#F1F1EF',
  },
  'boxwood-green': {
    name: 'Boxwood Green',
    vendorColorToken: 'Boxwood Green',
    approximateSwatchHex: '#47613F',
  },
  'chocolate-brown': {
    name: 'Chocolate Brown',
    vendorColorToken: 'Chocolate Brown',
    approximateSwatchHex: '#4A3226',
  },
  'citrus-yellow': {
    name: 'Citrus Yellow',
    vendorColorToken: 'Citrus Yellow',
    approximateSwatchHex: '#F0C200',
  },
  'jet-black': {
    name: 'Jet Black',
    vendorColorToken: 'Jet Black',
    approximateSwatchHex: '#1B1B1B',
  },
  'mocha-java': {
    name: 'Mocha Java',
    vendorColorToken: 'Mocha Java',
    approximateSwatchHex: '#7B5E48',
  },
  'pearl-grey': {
    name: 'Pearl Grey',
    vendorColorToken: 'Pearl Grey',
    approximateSwatchHex: '#A7ABAE',
  },
  'pearl-silver': {
    name: 'Pearl Silver',
    vendorColorToken: 'Pearl Silver',
    approximateSwatchHex: '#C6C8CA',
  },
  'racing-red': {
    name: 'Racing Red',
    vendorColorToken: 'Racing Red',
    approximateSwatchHex: '#B4131C',
  },
  'royal-blue': {
    name: 'Royal Blue',
    vendorColorToken: 'Royal Blue',
    approximateSwatchHex: '#1F3E93',
  },
  'slate-grey': {
    name: 'Slate Grey',
    vendorColorToken: 'Slate Grey',
    approximateSwatchHex: '#6E7276',
  },
  'tropical-orange': {
    name: 'Tropical Orange',
    vendorColorToken: 'Tropical Orange',
    approximateSwatchHex: '#E1610E',
  },
};

/**
 * Swisstrax tiles interlock with a directional connector edge and, on the Ribtrax lines, a
 * directional drainage channel. Swisstrax does not publish an installation option for rotating
 * individual tiles within a floor, so the conservative rule is a single fixed orientation.
 */
const FIXED_ROTATION_RATIONALE =
  'Swisstrax publishes no rotated-tile installation option; the interlocking edge and the ' +
  'directional surface profile are laid in one consistent orientation, so rotation is treated as ' +
  'fixed.';

export const SWISSTRAX_SEED: RawManufacturerSeed = {
  id: 'swisstrax',
  name: 'Swisstrax',
  trademarkNotice:
    'Swisstrax, Ribtrax, and Diamondtrax are trademarks of their respective owners. Used here ' +
    'only to identify the products described. This project is not affiliated with or endorsed by ' +
    'Swisstrax.',
  sourceHostnames: ['store.swisstrax.com'],
  imageHostnames: ['cdn.shopify.com'],
  palette: SWISSTRAX_PALETTE,
  products: [
    {
      id: 'swisstrax-ribtrax-pro',
      name: 'Ribtrax PRO (Standard Colors)',
      dimensions: { widthInches: 15.75, lengthInches: 15.75, thicknessInches: 0.75 },
      rotationRule: 'fixed',
      rotationRuleRationale: FIXED_ROTATION_RATIONALE,
      dimensionsSource: {
        url: 'https://store.swisstrax.com/products/ribtrax',
        kind: 'manufacturer-store',
        checkedDate: CATALOG_CHECKED_DATE,
        quote: 'Tile Size: 15.75 in (40 cm) x 15.75 in (40 cm); Height/Thickness: 0.75 in (1.9 cm)',
      },
      colorsSource: {
        url: 'https://store.swisstrax.com/products/ribtrax',
        kind: 'manufacturer-store',
        checkedDate: CATALOG_CHECKED_DATE,
      },
      surfaceStyle: {
        label: 'Open Profile',
        source: {
          url: 'https://store.swisstrax.com/products/ribtrax',
          kind: 'manufacturer-store',
          checkedDate: CATALOG_CHECKED_DATE,
          quote: 'Open Profile',
        },
      },
      drainage: {
        isDrainable: true,
        surfaceOpenness: 'open-drainable',
        evidence:
          'Swisstrax classifies Ribtrax PRO as an "Open Profile" tile and publishes a ' +
          '"Perforation Width: 0.13 in (0.32 cm)" spec, so the openings are in the tile face ' +
          'itself rather than only in the understructure.',
        source: {
          url: 'https://store.swisstrax.com/products/ribtrax',
          kind: 'manufacturer-store',
          checkedDate: CATALOG_CHECKED_DATE,
          quote: 'Perforation Width: 0.13 in (0.32 cm)',
        },
      },
      image: {
        imageUrl:
          'https://cdn.shopify.com/s/files/1/0142/7469/1126/products/xl-populartile_1000x1000_' +
          '2000x_442c988a-1cb4-4edb-a1ee-3ff07ff28828.png?v=1658774641',
        sourcePageUrl: 'https://store.swisstrax.com/products/ribtrax',
        attributionText: 'Photo (c) Swisstrax. Used to identify the product. Not affiliated.',
        altText:
          'Swisstrax Ribtrax PRO tiles shown from above, with the open ribbed channels that let ' +
          'water and debris drain through the tile face.',
        checkedDate: CATALOG_CHECKED_DATE,
        rightsBasis: PRODUCT_IMAGE_RIGHTS_BASIS,
        hotlinkStability: 'high',
        caveat:
          'Shopify CDN asset, globally cached and stable, but the "?v=" cache-busting token ' +
          'changes whenever Swisstrax replaces the image.',
      },
      colorSlugs: [
        'arctic-white',
        'boxwood-green',
        'chocolate-brown',
        'citrus-yellow',
        'jet-black',
        'mocha-java',
        'pearl-grey',
        'pearl-silver',
        'racing-red',
        'royal-blue',
        'slate-grey',
        'tropical-orange',
      ],
      prices: [
        {
          slug: 'tile',
          priceCents: 858,
          saleUnit: 'tile',
          sourceUrl: 'https://store.swisstrax.com/products/ribtrax',
          sourceKind: 'manufacturer-store',
          seller: 'Swisstrax',
          note: 'Listed at USD 8.58 for a single tile; every standard color shared that price.',
        },
      ],
    },
    {
      id: 'swisstrax-ribtrax-smooth-pro',
      name: 'Ribtrax Smooth PRO',
      dimensions: { widthInches: 15.75, lengthInches: 15.75, thicknessInches: 0.63 },
      rotationRule: 'fixed',
      rotationRuleRationale: FIXED_ROTATION_RATIONALE,
      dimensionsSource: {
        url: 'https://store.swisstrax.com/products/ribtrax-smooth',
        kind: 'manufacturer-store',
        checkedDate: CATALOG_CHECKED_DATE,
        quote: 'Tile Size: 15.75 in (40 cm) x 15.75 in (40 cm); Height/Thickness: 0.63 in (1.6 cm)',
      },
      colorsSource: {
        url: 'https://store.swisstrax.com/products/ribtrax-smooth',
        kind: 'manufacturer-store',
        checkedDate: CATALOG_CHECKED_DATE,
      },
      surfaceStyle: {
        label: 'Smooth',
        source: {
          url: 'https://store.swisstrax.com/products/ribtrax-smooth',
          kind: 'manufacturer-store',
          checkedDate: CATALOG_CHECKED_DATE,
          quote: 'smooth and even surface',
        },
      },
      drainage: {
        isDrainable: false,
        surfaceOpenness: 'closed',
        evidence:
          'Swisstrax sells this tile on its "smooth and even surface" and publishes no ' +
          'perforation width for it. Its drainage channels run under the tile only, which does ' +
          'not let water through the face.',
        source: {
          url: 'https://store.swisstrax.com/products/ribtrax-smooth',
          kind: 'manufacturer-store',
          checkedDate: CATALOG_CHECKED_DATE,
          quote: 'smooth and even surface',
        },
      },
      colorSlugs: [
        'arctic-white',
        'boxwood-green',
        'chocolate-brown',
        'citrus-yellow',
        'jet-black',
        'mocha-java',
        'pearl-silver',
        'racing-red',
        'royal-blue',
        'slate-grey',
        'tropical-orange',
      ],
      prices: [
        {
          slug: 'tile',
          priceCents: 858,
          saleUnit: 'tile',
          sourceUrl: 'https://store.swisstrax.com/products/ribtrax-smooth',
          sourceKind: 'manufacturer-store',
          seller: 'Swisstrax',
          note: 'Listed at USD 8.58 for a single tile; every color shared that price.',
        },
      ],
    },
    {
      id: 'swisstrax-diamondtrax-12-series',
      name: 'Diamondtrax 12-SERIES',
      dimensions: { widthInches: 12, lengthInches: 12, thicknessInches: 0.5 },
      rotationRule: 'fixed',
      rotationRuleRationale: FIXED_ROTATION_RATIONALE,
      dimensionsSource: {
        url: 'https://store.swisstrax.com/products/diamondtrax-12series',
        kind: 'manufacturer-store',
        checkedDate: CATALOG_CHECKED_DATE,
        quote:
          'Tile Size: 12 in (30.48 cm) x 12 in (30.48 cm); Height/Thickness: 0.50 in (1.27 cm)',
      },
      colorsSource: {
        url: 'https://store.swisstrax.com/products/diamondtrax-12series',
        kind: 'manufacturer-store',
        checkedDate: CATALOG_CHECKED_DATE,
      },
      surfaceStyle: {
        label: 'Solid diamond plate',
        source: {
          url: 'https://store.swisstrax.com/products/diamondtrax-12series',
          kind: 'manufacturer-store',
          checkedDate: CATALOG_CHECKED_DATE,
          quote: 'a solid diamond plate tile',
        },
      },
      drainage: {
        isDrainable: false,
        surfaceOpenness: 'closed',
        evidence:
          'Swisstrax describes this tile in its own words as "a solid diamond plate tile", and ' +
          'publishes no perforation width for it.',
        source: {
          url: 'https://store.swisstrax.com/products/diamondtrax-12series',
          kind: 'manufacturer-store',
          checkedDate: CATALOG_CHECKED_DATE,
          quote: 'a solid diamond plate tile',
        },
      },
      colorSlugs: [
        'arctic-white',
        'chocolate-brown',
        'citrus-yellow',
        'jet-black',
        'mocha-java',
        'pearl-silver',
        'racing-red',
        'royal-blue',
        'slate-grey',
        'tropical-orange',
      ],
      prices: [
        {
          slug: 'tile',
          priceCents: 399,
          saleUnit: 'tile',
          sourceUrl: 'https://store.swisstrax.com/products/diamondtrax-12series',
          sourceKind: 'manufacturer-store',
          seller: 'Swisstrax',
          note: 'Listed at USD 3.99 for a single tile; every color shared that price.',
        },
      ],
    },
    {
      id: 'swisstrax-ribtrax-smooth-12-series',
      name: 'Ribtrax Smooth 12-SERIES',
      dimensions: { widthInches: 12, lengthInches: 12, thicknessInches: 0.5 },
      rotationRule: 'fixed',
      rotationRuleRationale: FIXED_ROTATION_RATIONALE,
      dimensionsSource: {
        url: 'https://store.swisstrax.com/products/ribtrax-smooth-12series',
        kind: 'manufacturer-store',
        checkedDate: CATALOG_CHECKED_DATE,
        quote:
          'Tile Size: 12 in (30.48 cm) x 12 in (30.48 cm); Height/Thickness: 0.50 in (1.27 cm)',
      },
      colorsSource: {
        url: 'https://store.swisstrax.com/products/ribtrax-smooth-12series',
        kind: 'manufacturer-store',
        checkedDate: CATALOG_CHECKED_DATE,
      },
      surfaceStyle: {
        label: 'Smooth',
        source: {
          url: 'https://store.swisstrax.com/products/ribtrax-smooth-12series',
          kind: 'manufacturer-store',
          checkedDate: CATALOG_CHECKED_DATE,
          quote: 'Ribtrax Smooth 12-SERIES',
        },
      },
      drainage: {
        isDrainable: false,
        surfaceOpenness: 'closed',
        evidence:
          'The 12-SERIES Smooth tile carries the same closed face as Ribtrax Smooth PRO. ' +
          'Swisstrax publishes no perforation width for it and sells the line on its smooth ' +
          'surface.',
        source: {
          url: 'https://store.swisstrax.com/products/ribtrax-smooth-12series',
          kind: 'manufacturer-store',
          checkedDate: CATALOG_CHECKED_DATE,
          quote: 'Ribtrax Smooth 12-SERIES',
        },
      },
      colorSlugs: [
        'arctic-white',
        'chocolate-brown',
        'citrus-yellow',
        'jet-black',
        'mocha-java',
        'pearl-silver',
        'racing-red',
        'royal-blue',
        'slate-grey',
        'tropical-orange',
      ],
      prices: [
        {
          slug: 'tile',
          priceCents: 399,
          saleUnit: 'tile',
          sourceUrl: 'https://store.swisstrax.com/products/ribtrax-smooth-12series',
          sourceKind: 'manufacturer-store',
          seller: 'Swisstrax',
          note: 'Listed at USD 3.99 for a single tile; every color shared that price.',
        },
      ],
    },
  ],
};
