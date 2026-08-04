import { CATALOG_CHECKED_DATE, type RawManufacturerSeed, type RawPalette } from '../seedTypes';

/**
 * VEVOR seed data: the lower-cost end of the catalog.
 *
 * Dimensions, style wording, color option lists, pack quantities, sellers, and prices were read on
 * 2026-07-28 from VEVOR's own store at www.vevor.com, which publishes a schema.org product record
 * plus a "Product specification" table on every variant page. Nothing here is fetched at runtime;
 * the values are a point-in-time snapshot committed to source.
 *
 * VEVOR publishes no hex or RGB values for its color names, so every swatch below is an
 * approximation chosen for on-screen preview only. Color names are reproduced verbatim.
 *
 * VEVOR prices each color and each pack size as its own listing, so every price below carries the
 * color it was read from and the pack it was quoted for. All prices were the current selling price
 * on the checked date; VEVOR also displays a higher struck-through figure on some variants, and the
 * current price is what is recorded.
 *
 * Deliberately excluded, because the live listings contradict themselves or are not on sale:
 *
 * - The third color of the 20.2 in diamond-plate line. Its color selector calls the option
 *   "Silver", while the variant page's own specification table calls the same item "Light Gray".
 *   Those are different color words, not a spelling variant, so no color is seeded for it and no
 *   price is recorded from either of its pages.
 * - VEVOR's older 25-piece diamond-plate garage tile, whose live listing is marked discontinued.
 *
 * Recorded caveats that did not block seeding:
 *
 * - VEVOR spells the same color "Graphite Grey" in its color selector and "Graphite Gray" in the
 *   variant specification table and product URL. The specification-table spelling is seeded because
 *   it is the wording on the page each fact was read from, and the caveat is kept on the color.
 * - The 25-pack Blue listing repeats the Black listing's model number (JQ-3025BK) while naming the
 *   color Blue. Model numbers are not seeded, so this affects nothing here, but it is a sign the
 *   variant metadata is hand-maintained.
 */

const VEVOR_PALETTE: RawPalette = {
  black: { name: 'Black', vendorColorToken: 'Black', approximateSwatchHex: '#1A1A1A' },
  blue: { name: 'Blue', vendorColorToken: 'Blue', approximateSwatchHex: '#1D4E9C' },
  'graphite-gray': {
    name: 'Graphite Gray',
    vendorColorToken: 'Graphite Gray',
    approximateSwatchHex: '#4F5356',
    note:
      'VEVOR spells this color "Graphite Gray" in the variant specification table and the product ' +
      'URL, and "Graphite Grey" in the color selector. The specification-table spelling is seeded.',
  },
  red: { name: 'Red', vendorColorToken: 'Red', approximateSwatchHex: '#B71C1C' },
  silver: { name: 'Silver', vendorColorToken: 'Silver', approximateSwatchHex: '#C9CCCE' },
  'light-gray': {
    name: 'Light Gray',
    vendorColorToken: 'Light Gray',
    approximateSwatchHex: '#BFC2C3',
  },
};

/**
 * VEVOR sells separate "male" and "female" transition edge kits for these floors, so the tile edges
 * are directional rather than symmetric, and VEVOR publishes no rotated-tile installation option.
 * The conservative rule is a single fixed orientation.
 */
const FIXED_ROTATION_RATIONALE =
  'VEVOR publishes no rotated-tile installation option, and sells separate male and female ' +
  'transition edges for these floors, so the interlocking edges are directional and rotation is ' +
  'treated as fixed.';

const TWELVE_INCH_URL =
  'https://www.vevor.com/garage-flooring-mat-c_11210/vevor-garage-tiles-interlocking-12-x-12-x-0-' +
  '53-inch-50-pack-garage-floor-covering-tiles-non-slip-double-sided-texture-garage-flooring-' +
  'tiles-for-garages-basements-repair-shops-silver-p_010925341767';

const TWENTY_INCH_URL =
  'https://www.vevor.com/garage-flooring-mat-c_11210/vevor-garage-floor-tiles-interlocking-16-' +
  'pack-20-2-x-20-2-x-0-2-in-interlocking-modular-garage-flooring-tiles-diamond-plate-slip-' +
  'resistant-pvc-mats-for-workshop-warehouse-tool-room-black-p_010711653870';

const DRAINAGE_MAT_LIGHT_GRAY_50_URL =
  'https://www.vevor.com/interlocking-rubber-tiles-c_11196/drainage-mat-interlocking-drainage-' +
  'cushion-12-x-12-modular-floor-tile-p_010236218415';

const DRAINAGE_MAT_LIGHT_GRAY_12_URL =
  'https://www.vevor.com/interlocking-rubber-tiles-c_11196/drainage-mat-modular-interlocking-' +
  'cushion-12-x-12-drainage-floor-mat-p_010889415077';

const DRAINAGE_MAT_FIXED_ROTATION_RATIONALE =
  'VEVOR publishes no rotated-tile installation option for this interlocking drainage mat, so ' +
  'the planner keeps its orientation fixed rather than assuming its connection is symmetric.';

export const VEVOR_SEED: RawManufacturerSeed = {
  id: 'vevor',
  name: 'VEVOR',
  trademarkNotice:
    'VEVOR and the product names above are trademarks of their respective owners. Used here only ' +
    'to identify the products described. This project is not affiliated with, authorized by, or ' +
    'endorsed by VEVOR.',
  sourceHostnames: ['www.vevor.com'],
  imageHostnames: ['www.vevor.com', 'img.vevorstatic.com'],
  palette: VEVOR_PALETTE,
  products: [
    {
      id: 'vevor-interlocking-drainage-mat-12in',
      name: 'Interlocking Drainage Mat (nominal 12 x 12 in)',
      checkedDate: '2026-07-29',
      dimensions: { widthInches: 12, lengthInches: 12, thicknessInches: 0.59 },
      rotationRule: 'fixed',
      rotationRuleRationale: DRAINAGE_MAT_FIXED_ROTATION_RATIONALE,
      dimensionsSource: {
        url: DRAINAGE_MAT_LIGHT_GRAY_50_URL,
        kind: 'manufacturer-store',
        checkedDate: '2026-07-29',
        quote: 'Drainage Mat, 12 x 12 in modular interlocking cushion; thickness 0.59 in / 15 mm.',
      },
      colorsSource: {
        url: DRAINAGE_MAT_LIGHT_GRAY_12_URL,
        kind: 'manufacturer-store',
        checkedDate: '2026-07-29',
        quote: 'Verified VEVOR-direct variants: Light Gray and Black.',
      },
      surfaceStyle: {
        label: 'Open Grid (PP)',
        source: {
          url: DRAINAGE_MAT_LIGHT_GRAY_12_URL,
          kind: 'manufacturer-store',
          checkedDate: '2026-07-29',
          quote: 'PP material with Intelligent Open-Grid Design',
        },
      },
      drainage: {
        isDrainable: true,
        surfaceOpenness: 'open-drainable',
        evidence:
          'VEVOR describes an intelligent open-grid design: water passes through the holes rather ' +
          'than remaining on the surface.',
        source: {
          url: DRAINAGE_MAT_LIGHT_GRAY_12_URL,
          kind: 'manufacturer-store',
          checkedDate: '2026-07-29',
          quote: 'Intelligent Open-Grid Design: water passes through the holes.',
        },
      },
      plannerCaveat:
        'VEVOR claims daily vehicle support but publishes no numeric load rating, and lists this ' +
        'product under commercial drainage mats. Its 12 x 12 in title is nominal; the model code ' +
        'implies 30 cm / 11.81 in, so the planner uses nominal 12 in.',
      image: {
        imageUrl:
          'https://img.vevorstatic.com/us%2FCKPSD12X12INHIBDXV0%2Fgoods_img-v4%2Fdrainage-' +
          'mat-m100-1.2.jpg?timestamp=1761120985000&format=webp',
        sourcePageUrl: DRAINAGE_MAT_LIGHT_GRAY_50_URL,
        attributionText: 'Photo (c) VEVOR, loaded from VEVOR. Not affiliated.',
        altText:
          'Light gray VEVOR open-grid interlocking drainage mat with square perforations for water flow.',
        checkedDate: '2026-07-29',
        rightsBasis: 'remote-reference-with-attribution',
        hotlinkStability: 'medium',
        caveat:
          'The VEVOR CDN URL includes a timestamp and path version, so the hotlink can change or expire.',
      },
      colorSlugs: ['light-gray', 'black'],
      prices: [
        {
          slug: 'pack-12-light-gray',
          priceCents: 2490,
          saleUnit: 'pack',
          packQuantity: 12,
          colorSlug: 'light-gray',
          sourceUrl: DRAINAGE_MAT_LIGHT_GRAY_12_URL,
          sourceKind: 'manufacturer-store',
          seller: 'Vevor',
          sourceProductCode: 'CKPSD12X12YC7FR5ZV0',
          note: 'VEVOR does not publish pack coverage for this listing.',
        },
        {
          slug: 'pack-24-black',
          priceCents: 4190,
          saleUnit: 'pack',
          packQuantity: 24,
          colorSlug: 'black',
          sourceUrl:
            'https://www.vevor.com/interlocking-rubber-tiles-c_11196/drainage-mat-modular-' +
            'interlocking-mat-12-x-12-drainage-floor-tile-p_010263593576',
          sourceKind: 'manufacturer-store',
          seller: 'Vevor',
          sourceProductCode: 'CKPSD12X12INM0OD3V0',
          note: 'VEVOR does not publish pack coverage for this listing.',
        },
        {
          slug: 'pack-24-light-gray',
          priceCents: 4390,
          saleUnit: 'pack',
          packQuantity: 24,
          colorSlug: 'light-gray',
          sourceUrl:
            'https://www.vevor.com/interlocking-rubber-tiles-c_11196/drainage-mat-drainage-' +
            'floor-tile-12-x-12-modular-interlocking-cushion-p_010818413264',
          sourceKind: 'manufacturer-store',
          seller: 'Vevor',
          sourceProductCode: 'CKPSD12X12IN7YEXHV0',
          note: 'VEVOR does not publish pack coverage for this listing.',
        },
        {
          slug: 'pack-40-black',
          priceCents: 6290,
          saleUnit: 'pack',
          packQuantity: 40,
          colorSlug: 'black',
          sourceUrl:
            'https://www.vevor.com/interlocking-rubber-tiles-c_11196/drainage-mat-drainage-' +
            'floor-tile-12-x-12-modular-interlocking-mat-p_010465991958',
          sourceKind: 'manufacturer-store',
          seller: 'Vevor',
          sourceProductCode: 'CKPSD12X12IN0TICAV0',
          note: 'VEVOR does not publish pack coverage for this listing.',
        },
        {
          slug: 'pack-50-black',
          priceCents: 7590,
          saleUnit: 'pack',
          packQuantity: 50,
          colorSlug: 'black',
          sourceUrl:
            'https://www.vevor.com/interlocking-rubber-tiles-c_11196/drainage-mat-modular-' +
            'floor-tile-12-x-12-interlocking-drainage-cushion-p_010585105882',
          sourceKind: 'manufacturer-store',
          seller: 'Vevor',
          sourceProductCode: 'CKPSD12X12INH8T9BV0',
          note: 'VEVOR does not publish pack coverage for this listing.',
        },
        {
          slug: 'pack-50-light-gray',
          priceCents: 7690,
          saleUnit: 'pack',
          packQuantity: 50,
          colorSlug: 'light-gray',
          sourceUrl: DRAINAGE_MAT_LIGHT_GRAY_50_URL,
          sourceKind: 'manufacturer-store',
          seller: 'Vevor',
          sourceProductCode: 'CKPSD12X12INHIBDXV0',
          note: 'VEVOR does not publish pack coverage for this listing.',
        },
        {
          slug: 'pack-55-light-gray',
          priceCents: 8190,
          saleUnit: 'pack',
          packQuantity: 55,
          colorSlug: 'light-gray',
          sourceUrl:
            'https://www.vevor.com/interlocking-rubber-tiles-c_11196/modular-drainage-mat-' +
            'interlocking-floor-tile-12-x-12-drainage-cushion-p_010787249151',
          sourceKind: 'manufacturer-store',
          seller: 'Vevor',
          sourceProductCode: 'CKPSD12X12IN4FGUZV0',
          note: 'VEVOR does not publish pack coverage for this listing.',
        },
        {
          slug: 'pack-55-black',
          priceCents: 8290,
          saleUnit: 'pack',
          packQuantity: 55,
          colorSlug: 'black',
          sourceUrl:
            'https://www.vevor.com/interlocking-rubber-tiles-c_11196/interlocking-drainage-' +
            'mat-modular-floor-tile-12-x-12-drainage-cushion-p_010434219578',
          sourceKind: 'manufacturer-store',
          seller: 'Vevor',
          sourceProductCode: 'CKPSD12X12INHT62XV0',
          note: 'VEVOR does not publish pack coverage for this listing.',
        },
      ],
    },
    {
      id: 'vevor-garage-tiles-interlocking-12in',
      name: 'Garage Tiles Interlocking (12 in)',
      dimensions: { widthInches: 12, lengthInches: 12, thicknessInches: 0.53 },
      rotationRule: 'fixed',
      rotationRuleRationale: FIXED_ROTATION_RATIONALE,
      dimensionsSource: {
        url: TWELVE_INCH_URL,
        kind: 'manufacturer-store',
        checkedDate: CATALOG_CHECKED_DATE,
        quote: 'Sizes 12 x 12 x 0.53 inch / 305 x 305 x 13.4 mm; Thickness 0.53 inch / 13.4 mm',
      },
      colorsSource: {
        url: TWELVE_INCH_URL,
        kind: 'manufacturer-store',
        checkedDate: CATALOG_CHECKED_DATE,
        quote: 'Color: Graphite Grey, Silver, Red, Black, Blue',
      },
      surfaceStyle: {
        label: 'Non-Slip Double-Sided Texture',
        source: {
          url: TWELVE_INCH_URL,
          kind: 'manufacturer-store',
          checkedDate: CATALOG_CHECKED_DATE,
          quote:
            'VEVOR Garage Tiles Interlocking, 12 x 12 x 0.53 inch 50 Pack Garage Floor Covering ' +
            'Tiles, Non-Slip Double-Sided Texture Garage Flooring Tiles',
        },
      },
      drainage: {
        isDrainable: false,
        surfaceOpenness: 'closed',
        evidence:
          'VEVOR sells this tile on its "Non-Slip Double-Sided Texture" and makes no perforation ' +
          "or drainage claim anywhere on the listing. VEVOR's own garage flooring category copy " +
          'positions the range as "an impenetrable barrier ... a non-absorbent surface to contain ' +
          'liquids", which is the opposite of a flow-through floor.',
        source: {
          url: TWELVE_INCH_URL,
          kind: 'manufacturer-store',
          checkedDate: CATALOG_CHECKED_DATE,
          quote: 'Non-Slip Double-Sided Texture Garage Flooring Tiles',
        },
      },
      colorSlugs: ['graphite-gray', 'silver', 'red', 'black', 'blue'],
      prices: [
        {
          slug: 'pack-50-silver',
          priceCents: 8590,
          saleUnit: 'pack',
          packQuantity: 50,
          colorSlug: 'silver',
          publishedCoverageSquareFeet: 50,
          sourceUrl: TWELVE_INCH_URL,
          sourceKind: 'manufacturer-store',
          seller: 'Vevor',
          note: 'Current price USD 85.90; the page also showed a struck-through USD 105.99.',
        },
        {
          slug: 'pack-50-black',
          priceCents: 8990,
          saleUnit: 'pack',
          packQuantity: 50,
          colorSlug: 'black',
          publishedCoverageSquareFeet: 50,
          sourceUrl:
            'https://www.vevor.com/garage-flooring-mat-c_11210/vevor-garage-tiles-interlocking-' +
            '12-x-12-x-0-53-inch-50-pack-garage-floor-covering-tiles-non-slip-double-sided-' +
            'texture-garage-flooring-tiles-for-garages-basements-repair-shops-black-p_010335944085',
          sourceKind: 'manufacturer-store',
          seller: 'Vevor',
        },
        {
          slug: 'pack-50-graphite-gray',
          priceCents: 8790,
          saleUnit: 'pack',
          packQuantity: 50,
          colorSlug: 'graphite-gray',
          publishedCoverageSquareFeet: 50,
          sourceUrl:
            'https://www.vevor.com/garage-flooring-mat-c_11210/vevor-garage-tiles-interlocking-' +
            '12-x-12-x-0-53-inch-50-pack-garage-floor-covering-tiles-non-slip-double-sided-' +
            'texture-garage-flooring-tiles-for-garages-basements-repair-shops-graphite-gray-' +
            'p_010219078818',
          sourceKind: 'manufacturer-store',
          seller: 'Vevor',
        },
        {
          slug: 'pack-50-red',
          priceCents: 8790,
          saleUnit: 'pack',
          packQuantity: 50,
          colorSlug: 'red',
          publishedCoverageSquareFeet: 50,
          sourceUrl:
            'https://www.vevor.com/garage-flooring-mat-c_11210/vevor-garage-tiles-interlocking-' +
            '12-x-12-x-0-53-inch-50-pack-garage-floor-covering-tiles-non-slip-double-sided-' +
            'texture-garage-flooring-tiles-for-garages-basements-repair-shops-red-p_010363750580',
          sourceKind: 'manufacturer-store',
          seller: 'Vevor',
        },
        {
          slug: 'pack-50-blue',
          priceCents: 8790,
          saleUnit: 'pack',
          packQuantity: 50,
          colorSlug: 'blue',
          publishedCoverageSquareFeet: 50,
          sourceUrl:
            'https://www.vevor.com/garage-flooring-mat-c_11210/vevor-garage-tiles-interlocking-' +
            '12-x-12-x-0-53-inch-50-pack-garage-floor-covering-tiles-non-slip-double-sided-' +
            'texture-garage-flooring-tiles-for-garages-basements-repair-shops-blue-p_010110062898',
          sourceKind: 'manufacturer-store',
          seller: 'Vevor',
        },
        {
          slug: 'pack-25-silver',
          priceCents: 5090,
          saleUnit: 'pack',
          packQuantity: 25,
          colorSlug: 'silver',
          publishedCoverageSquareFeet: 25,
          sourceUrl:
            'https://www.vevor.com/garage-flooring-mat-c_11210/vevor-garage-tiles-interlocking-' +
            '12-x-12-x-0-53-inch-25-pack-garage-floor-covering-tiles-non-slip-double-sided-' +
            'texture-garage-flooring-tiles-for-garages-basements-repair-shops-silver-p_010648194619',
          sourceKind: 'manufacturer-store',
          seller: 'Vevor',
        },
        {
          slug: 'pack-25-black',
          priceCents: 5190,
          saleUnit: 'pack',
          packQuantity: 25,
          colorSlug: 'black',
          publishedCoverageSquareFeet: 25,
          sourceUrl:
            'https://www.vevor.com/garage-flooring-mat-c_11210/vevor-garage-tiles-interlocking-' +
            '12-x-12-x-0-53-inch-25-pack-garage-floor-covering-tiles-non-slip-double-sided-' +
            'texture-garage-flooring-tiles-for-garages-basements-repair-shops-black-p_010844551383',
          sourceKind: 'manufacturer-store',
          seller: 'Vevor',
        },
        {
          slug: 'pack-25-graphite-gray',
          priceCents: 5190,
          saleUnit: 'pack',
          packQuantity: 25,
          colorSlug: 'graphite-gray',
          publishedCoverageSquareFeet: 25,
          sourceUrl:
            'https://www.vevor.com/garage-flooring-mat-c_11210/vevor-garage-tiles-interlocking-' +
            '12-x-12-x-0-53-inch-25-pack-garage-floor-covering-tiles-non-slip-double-sided-' +
            'texture-garage-flooring-tiles-for-garages-basements-repair-shops-graphite-gray-' +
            'p_010906864976',
          sourceKind: 'manufacturer-store',
          seller: 'Vevor',
        },
        {
          slug: 'pack-25-red',
          priceCents: 4790,
          saleUnit: 'pack',
          packQuantity: 25,
          colorSlug: 'red',
          publishedCoverageSquareFeet: 25,
          sourceUrl:
            'https://www.vevor.com/garage-flooring-mat-c_11210/vevor-garage-tiles-interlocking-' +
            '12-x-12-x-0-53-inch-25-pack-garage-floor-covering-tiles-non-slip-double-sided-' +
            'texture-garage-flooring-tiles-for-garages-basements-repair-shops-red-p_010301887785',
          sourceKind: 'manufacturer-store',
          seller: 'Vevor',
        },
        {
          slug: 'pack-25-blue',
          priceCents: 4690,
          saleUnit: 'pack',
          packQuantity: 25,
          colorSlug: 'blue',
          publishedCoverageSquareFeet: 25,
          sourceUrl:
            'https://www.vevor.com/garage-flooring-mat-c_11210/vevor-garage-tiles-interlocking-' +
            '12-x-12-x-0-53-inch-25-pack-garage-floor-covering-tiles-non-slip-double-sided-' +
            'texture-garage-flooring-tiles-for-garages-basements-repair-shops-blue-p_010206380134',
          sourceKind: 'manufacturer-store',
          seller: 'Vevor',
          note: 'This listing repeats the Black variant model number JQ-3025BK while naming Blue.',
        },
      ],
    },
    {
      id: 'vevor-garage-floor-tiles-interlocking-20in',
      name: 'Garage Floor Tiles Interlocking Diamond Plate (20.2 in)',
      dimensions: { widthInches: 20.2, lengthInches: 20.2, thicknessInches: 0.2 },
      rotationRule: 'fixed',
      rotationRuleRationale: FIXED_ROTATION_RATIONALE,
      dimensionsSource: {
        url: TWENTY_INCH_URL,
        kind: 'manufacturer-store',
        checkedDate: CATALOG_CHECKED_DATE,
        quote: 'Item Dimensions 20.2 x 20.2 x 0.2 in / 513 x 513 x 5 mm',
      },
      colorsSource: {
        url: TWENTY_INCH_URL,
        kind: 'manufacturer-store',
        checkedDate: CATALOG_CHECKED_DATE,
        quote: 'product color: Black, Silver, Graphite Grey',
      },
      surfaceStyle: {
        label: 'Diamond Plate',
        source: {
          url: TWENTY_INCH_URL,
          kind: 'manufacturer-store',
          checkedDate: CATALOG_CHECKED_DATE,
          quote:
            'VEVOR Garage Floor Tiles Interlocking, 16 Pack 20.2 x 20.2 x 0.2 in Interlocking ' +
            'Modular Garage Flooring Tiles, Diamond Plate Slip-Resistant PVC Mats',
        },
      },
      drainage: {
        isDrainable: false,
        surfaceOpenness: 'closed',
        evidence:
          'A solid diamond-plate PVC mat. The listing makes no perforation or drainage claim, and ' +
          "VEVOR's garage flooring category copy markets the range as an impermeable barrier " +
          'that contains liquids rather than draining them.',
        source: {
          url: TWENTY_INCH_URL,
          kind: 'manufacturer-store',
          checkedDate: CATALOG_CHECKED_DATE,
          quote: 'Diamond Plate Slip-Resistant PVC Mats',
        },
      },
      colorSlugs: ['black', 'graphite-gray'],
      prices: [
        {
          slug: 'pack-16-black',
          priceCents: 9990,
          saleUnit: 'pack',
          packQuantity: 16,
          colorSlug: 'black',
          publishedCoverageSquareFeet: 45.32,
          sourceUrl: TWENTY_INCH_URL,
          sourceKind: 'manufacturer-store',
          seller: 'Vevor',
        },
        {
          slug: 'pack-16-graphite-gray',
          priceCents: 9990,
          saleUnit: 'pack',
          packQuantity: 16,
          colorSlug: 'graphite-gray',
          publishedCoverageSquareFeet: 45.32,
          sourceUrl:
            'https://www.vevor.com/garage-flooring-mat-c_11210/vevor-garage-floor-tiles-' +
            'interlocking-16-pack-20-2-x-20-2-x-0-2-in-interlocking-modular-garage-flooring-tiles-' +
            'diamond-plate-slip-resistant-pvc-mats-for-workshop-warehouse-tool-room-graphite-gray-' +
            'p_010781918137',
          sourceKind: 'manufacturer-store',
          seller: 'Vevor',
        },
        {
          slug: 'pack-8-black',
          priceCents: 5190,
          saleUnit: 'pack',
          packQuantity: 8,
          colorSlug: 'black',
          publishedCoverageSquareFeet: 22.7,
          sourceUrl:
            'https://www.vevor.com/garage-flooring-mat-c_11210/vevor-garage-floor-tiles-' +
            'interlocking-8-pack-20-2-x-20-2-x-0-2-in-interlocking-modular-garage-flooring-tiles-' +
            'diamond-plate-slip-resistant-pvc-mats-for-workshop-warehouse-tool-room-black-' +
            'p_010322292639',
          sourceKind: 'manufacturer-store',
          seller: 'Vevor',
        },
        {
          slug: 'pack-8-graphite-gray',
          priceCents: 5390,
          saleUnit: 'pack',
          packQuantity: 8,
          colorSlug: 'graphite-gray',
          publishedCoverageSquareFeet: 22.7,
          sourceUrl:
            'https://www.vevor.com/garage-flooring-mat-c_11210/vevor-garage-floor-tiles-' +
            'interlocking-8-pack-20-2-x-20-2-x-0-2-in-interlocking-modular-garage-flooring-tiles-' +
            'diamond-plate-slip-resistant-pvc-mats-for-workshop-warehouse-tool-room-graphite-gray-' +
            'p_010674995402',
          sourceKind: 'manufacturer-store',
          seller: 'Vevor',
        },
      ],
    },
  ],
};
