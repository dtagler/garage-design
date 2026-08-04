import { calculateTileGrid, type TileGrid } from '../calculations/estimate';
import {
  COLOR_FAMILY_TOKENS,
  findBestColorSubstitute,
  getColorFamily,
  normalizeColorName,
} from '../domain/colorMatching';
import type { CatalogProduct, ProductColor } from '../domain/catalog';
import {
  AUTOMOTIVE_PATTERN_PRESETS,
  getAutomotivePatternRole,
  type AutomotivePatternId,
} from './automotivePatterns';
import {
  BORDER_CHECKER_PATTERN_PRESETS,
  getBorderCheckerPatternRole,
  type BorderCheckerPatternId,
} from './borderCheckerPatterns';

export const ROUGH_DESIGN_ROLES = ['base', 'accent', 'secondary'] as const;
export const ROUGH_DESIGN_VERSION = 3;
export const MINIMUM_GARAGE_DIMENSION_INCHES = 48;
export const MAXIMUM_GARAGE_DIMENSION_INCHES = 1_000;
export const CONCEPTUAL_LONG_AXIS_CELLS = 24;
export const MINIMUM_CONCEPTUAL_SHORT_AXIS_CELLS = 8;

export type RoughDesignRole = (typeof ROUGH_DESIGN_ROLES)[number];
export type RoughDesignCellId = `${number}-${number}`;

export type RoughPatternCategory =
  | 'frames'
  | 'parking-bays'
  | 'stripes-bands'
  | 'checkers-grids'
  | 'diagonals-chevrons'
  | 'corners-accents'
  | 'center-fields'
  | 'racing-showroom';

export interface RoughPatternParameter {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

export interface RoughPatternPreset {
  readonly id: string;
  readonly name: string;
  readonly category: RoughPatternCategory;
  readonly description: string;
  readonly roles: readonly RoughDesignRole[];
  readonly parameters?: readonly RoughPatternParameter[];
  /** Search terms are deliberately product and brand neutral. */
  readonly searchTerms: readonly string[];
}

const patternParameter = (
  id: string,
  label: string,
  description: string
): RoughPatternParameter => ({ id, label, description });

/**
 * Original parametric layouts inspired only by public, high-level pattern categories:
 * RaceDeck galleries and color guide; Swisstrax garage-flooring overview; ModuTile garage-tile
 * guide; and Greatmats garage-flooring guides (checked 2026-07-29). No gallery image, product
 * layout, or proprietary artwork was copied.
 */
const CORE_ROUGH_PATTERN_PRESETS = [
  {
    id: 'perimeter-frame',
    name: 'Border',
    category: 'frames',
    description: 'A crisp accent ring around the floor.',
    roles: ['base', 'accent'],
    searchTerms: ['border', 'frame', 'perimeter'],
  },
  {
    id: 'inset-frame',
    name: 'Inset Frame',
    category: 'frames',
    description: 'A floating frame one cell inside the perimeter.',
    roles: ['base', 'accent'],
    searchTerms: ['border', 'inset', 'frame'],
  },
  {
    id: 'broken-frame',
    name: 'Broken Frame',
    category: 'frames',
    description: 'A perimeter frame with an open door threshold.',
    roles: ['base', 'accent'],
    searchTerms: ['border', 'frame', 'door', 'opening'],
  },
  {
    id: 'corner-bracket-frame',
    name: 'Corner Bracket Frame',
    category: 'frames',
    description: 'Short frame brackets define all four corners.',
    roles: ['base', 'accent'],
    parameters: [patternParameter('arm', 'Bracket arm', 'Corner bracket length.')],
    searchTerms: ['corner', 'bracket', 'frame'],
  },
  {
    id: 'threshold-bands',
    name: 'Threshold Bands',
    category: 'frames',
    description: 'Accent bands mark the front and back thresholds.',
    roles: ['base', 'accent'],
    searchTerms: ['threshold', 'band', 'front', 'back'],
  },
  {
    id: 'side-rails',
    name: 'Side Rails',
    category: 'frames',
    description: 'Parallel rails run the full garage depth.',
    roles: ['base', 'accent'],
    searchTerms: ['rail', 'side', 'perimeter'],
  },
  {
    id: 'stepped-frame',
    name: 'Stepped Frame',
    category: 'frames',
    description: 'A two-tone perimeter with a stepped front half.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['frame', 'step', 'border'],
  },
  {
    id: 'twin-bay-pads',
    name: 'Twin Bay Pads',
    category: 'parking-bays',
    description: 'Two centered parking pads scale to the floor width.',
    roles: ['base', 'accent'],
    searchTerms: ['parking', 'bay', 'pad', 'vehicle'],
  },
  {
    id: 'bay-outline-pads',
    name: 'Bay Outline Pads',
    category: 'parking-bays',
    description: 'Outlined parking bays keep the field open.',
    roles: ['base', 'accent'],
    searchTerms: ['parking', 'bay', 'outline', 'vehicle'],
  },
  {
    id: 'drip-apron',
    name: 'Drip Apron',
    category: 'parking-bays',
    description: 'A full-width entry zone for wet vehicles.',
    roles: ['base', 'accent'],
    searchTerms: ['parking', 'apron', 'entry', 'wet'],
  },
  {
    id: 'wheel-tracks',
    name: 'Wheel Tracks',
    category: 'parking-bays',
    description: 'Four wheel-track runs span the garage depth.',
    roles: ['base', 'accent'],
    searchTerms: ['parking', 'wheel', 'track', 'vehicle'],
  },
  {
    id: 'bay-divider-rails',
    name: 'Bay Divider Rails',
    category: 'parking-bays',
    description: 'Center rails divide parking positions.',
    roles: ['base', 'accent'],
    searchTerms: ['parking', 'bay', 'divider', 'rail'],
  },
  {
    id: 'bay-head-blocks',
    name: 'Bay Head Blocks',
    category: 'parking-bays',
    description: 'Rear parking markers anchor each vehicle bay.',
    roles: ['base', 'accent'],
    searchTerms: ['parking', 'bay', 'rear', 'marker'],
  },
  {
    id: 'walk-aisle',
    name: 'Walk Aisle',
    category: 'parking-bays',
    description: 'A framed field with a centered walking lane.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['parking', 'walkway', 'aisle', 'lane'],
  },
  {
    id: 'twin-racing-stripes',
    name: 'Twin Racing Stripes',
    category: 'stripes-bands',
    description: 'Paired center stripes run front to back.',
    roles: ['base', 'accent'],
    searchTerms: ['racing', 'stripe', 'center', 'runner'],
  },
  {
    id: 'offset-racing-stripes',
    name: 'Offset Racing Stripes',
    category: 'stripes-bands',
    description: 'Paired stripes shift toward one bay.',
    roles: ['base', 'accent'],
    searchTerms: ['racing', 'stripe', 'offset', 'asymmetric'],
  },
  {
    id: 'transverse-bands',
    name: 'Transverse Bands',
    category: 'stripes-bands',
    description: 'Regular cross-garage accent bands.',
    roles: ['base', 'accent'],
    parameters: [patternParameter('period', 'Band spacing', 'Distance between accent bands.')],
    searchTerms: ['stripe', 'band', 'horizontal', 'cross'],
  },
  {
    id: 'ribbon-wrap',
    name: 'Ribbon Wrap',
    category: 'stripes-bands',
    description: 'A continuous accent ribbon wraps the field.',
    roles: ['base', 'accent'],
    searchTerms: ['ribbon', 'wrap', 'stripe', 'path'],
  },
  {
    id: 'edge-pinstripes',
    name: 'Edge Pinstripes',
    category: 'stripes-bands',
    description: 'Fine stripes sit just inside both side edges.',
    roles: ['base', 'accent'],
    searchTerms: ['stripe', 'pinstripe', 'edge', 'side'],
  },
  {
    id: 'horizontal-bands',
    name: 'Horizontal stripes',
    category: 'stripes-bands',
    description: 'Alternating rows run across the garage.',
    roles: ['base', 'accent'],
    searchTerms: ['stripe', 'horizontal', 'legacy', 'band'],
  },
  {
    id: 'vertical-bands',
    name: 'Vertical stripes',
    category: 'stripes-bands',
    description: 'Alternating columns run front to back.',
    roles: ['base', 'accent'],
    searchTerms: ['stripe', 'vertical', 'legacy', 'band'],
  },
  {
    id: 'checker-grid',
    name: 'Checkerboard',
    category: 'checkers-grids',
    description: 'Classic alternating checker tiles.',
    roles: ['base', 'accent'],
    searchTerms: ['checkerboard', 'checker', 'grid', 'classic'],
  },
  {
    id: 'jumbo-checker',
    name: 'Jumbo Checker',
    category: 'checkers-grids',
    description: 'Large checker blocks for an oversized field.',
    roles: ['base', 'accent'],
    parameters: [patternParameter('block', 'Block size', 'Checker block size in cells.')],
    searchTerms: ['checkerboard', 'checker', 'large', 'grid'],
  },
  {
    id: 'checker-core',
    name: 'Checker Core',
    category: 'checkers-grids',
    description: 'A framed interior checker field.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['checkerboard', 'checker', 'border', 'core'],
  },
  {
    id: 'checker-apron',
    name: 'Checker Apron',
    category: 'checkers-grids',
    description: 'A checker entry apron leads into a solid field.',
    roles: ['base', 'accent'],
    searchTerms: ['checkerboard', 'checker', 'apron', 'entry'],
  },
  {
    id: 'windowpane-grid',
    name: 'Windowpane Grid',
    category: 'checkers-grids',
    description: 'Evenly spaced cross-lines form a grid.',
    roles: ['base', 'accent'],
    searchTerms: ['grid', 'windowpane', 'line', 'square'],
  },
  {
    id: 'tartan-grid',
    name: 'Tartan Grid',
    category: 'checkers-grids',
    description: 'Layered grid lines add a third color.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['grid', 'tartan', 'plaid', 'three-color'],
  },
  {
    id: 'diagonal-checker',
    name: 'Diagonal Checker',
    category: 'checkers-grids',
    description: 'Diagonal checker bands sweep across the field.',
    roles: ['base', 'secondary'],
    searchTerms: ['checker', 'diagonal', 'grid', 'band'],
  },
  {
    id: 'single-sweep',
    name: 'Single Sweep',
    category: 'diagonals-chevrons',
    description: 'One diagonal accent sweeps corner to corner.',
    roles: ['base', 'accent'],
    searchTerms: ['diagonal', 'sweep', 'line'],
  },
  {
    id: 'chevron-split',
    name: 'Chevron Split',
    category: 'diagonals-chevrons',
    description: 'A centered V opens toward the garage door.',
    roles: ['base', 'accent'],
    searchTerms: ['chevron', 'v', 'diagonal', 'center'],
  },
  {
    id: 'arrow-nose',
    name: 'Arrow Nose',
    category: 'diagonals-chevrons',
    description: 'A filled center arrow points into the garage.',
    roles: ['base', 'accent'],
    searchTerms: ['arrow', 'chevron', 'triangle', 'center'],
  },
  {
    id: 'zigzag-runner',
    name: 'Zigzag Runner',
    category: 'diagonals-chevrons',
    description: 'A repeating zigzag travels through the field.',
    roles: ['base', 'accent'],
    searchTerms: ['zigzag', 'runner', 'diagonal', 'wave'],
  },
  {
    id: 'corner-wedge',
    name: 'Corner Wedge',
    category: 'diagonals-chevrons',
    description: 'An asymmetric triangular corner accent.',
    roles: ['base', 'accent'],
    searchTerms: ['corner', 'wedge', 'triangle', 'diagonal'],
  },
  {
    id: 'gate-wedges',
    name: 'Gate Wedges',
    category: 'diagonals-chevrons',
    description: 'Mirrored wedges frame the garage-door edge.',
    roles: ['base', 'accent'],
    searchTerms: ['gate', 'wedge', 'triangle', 'door'],
  },
  {
    id: 'quad-corner-squares',
    name: 'Quad Corner Squares',
    category: 'corners-accents',
    description: 'Four equal corner markers.',
    roles: ['base', 'accent'],
    searchTerms: ['corner', 'square', 'four'],
  },
  {
    id: 'door-corner-kickers',
    name: 'Door Corner Kickers',
    category: 'corners-accents',
    description: 'Two front-corner markers frame the door.',
    roles: ['base', 'accent'],
    searchTerms: ['corner', 'door', 'front', 'marker'],
  },
  {
    id: 'notched-frame',
    name: 'Notched Frame',
    category: 'corners-accents',
    description: 'A perimeter frame with open corner notches.',
    roles: ['base', 'accent'],
    searchTerms: ['frame', 'notch', 'corner', 'border'],
  },
  {
    id: 'l-bracket-accents',
    name: 'L-Bracket Accents',
    category: 'corners-accents',
    description: 'L-shaped accents reinforce every corner.',
    roles: ['base', 'accent'],
    searchTerms: ['corner', 'bracket', 'l-shape', 'accent'],
  },
  {
    id: 'corner-stairs',
    name: 'Corner Stairs',
    category: 'corners-accents',
    description: 'A stepped accent builds from one corner.',
    roles: ['base', 'accent'],
    searchTerms: ['corner', 'stairs', 'step', 'asymmetric'],
  },
  {
    id: 'solid-field',
    name: 'Solid',
    category: 'center-fields',
    description: 'One calm color across the entire floor.',
    roles: ['base'],
    searchTerms: ['solid', 'single-color', 'legacy', 'field'],
  },
  {
    id: 'center-pad',
    name: 'Center Pad',
    category: 'center-fields',
    description: 'A proportional center pad anchors the room.',
    roles: ['base', 'accent'],
    searchTerms: ['center', 'pad', 'field', 'rectangle'],
  },
  {
    id: 'framed-center-pad',
    name: 'Framed Center Pad',
    category: 'center-fields',
    description: 'A center pad receives a contrasting outline.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['center', 'pad', 'frame', 'outline'],
  },
  {
    id: 'diamond-medallion',
    name: 'Diamond Medallion',
    category: 'center-fields',
    description: 'A centered diamond creates a focal point.',
    roles: ['base', 'accent'],
    searchTerms: ['center', 'diamond', 'medallion'],
  },
  {
    id: 'ring-medallion',
    name: 'Ring Medallion',
    category: 'center-fields',
    description: 'A diamond outline floats in the center.',
    roles: ['base', 'accent'],
    searchTerms: ['center', 'ring', 'medallion', 'diamond'],
  },
  {
    id: 'cross-medallion',
    name: 'Cross Medallion',
    category: 'center-fields',
    description: 'Crossing center bands form a plus sign.',
    roles: ['base', 'accent'],
    searchTerms: ['center', 'cross', 'plus', 'medallion'],
  },
  {
    id: 'start-finish-band',
    name: 'Start-Finish Band',
    category: 'racing-showroom',
    description: 'A checkered door threshold starts the show.',
    roles: ['base', 'accent'],
    searchTerms: ['racing', 'start', 'finish', 'checkerboard'],
  },
  {
    id: 'podium-steps',
    name: 'Podium Steps',
    category: 'racing-showroom',
    description: 'Three centered tiers rise at the rear wall.',
    roles: ['base', 'accent'],
    searchTerms: ['racing', 'podium', 'steps', 'showroom'],
  },
  {
    id: 'pit-box',
    name: 'Pit Box',
    category: 'racing-showroom',
    description: 'An open-front outline marks a vehicle footprint.',
    roles: ['base', 'accent'],
    searchTerms: ['racing', 'pit', 'box', 'parking'],
  },
  {
    id: 'apex-curve',
    name: 'Apex Curve',
    category: 'racing-showroom',
    description: 'A quarter-arc sweeps from one corner.',
    roles: ['base', 'accent'],
    searchTerms: ['racing', 'apex', 'curve', 'arc'],
  },
  {
    id: 'speed-fade',
    name: 'Speed Fade',
    category: 'racing-showroom',
    description: 'Compressed stripes accelerate toward one wall.',
    roles: ['base', 'accent'],
    searchTerms: ['racing', 'speed', 'stripe', 'fade'],
  },
  {
    id: 'double-border',
    name: 'Double Border',
    category: 'frames',
    description: 'Two separated rings give the field a layered edge.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['border', 'double', 'layered', 'frame'],
  },
  {
    id: 'triple-border',
    name: 'Triple Border',
    category: 'frames',
    description: 'Three alternating perimeter rings build a deep frame.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['border', 'triple', 'layered', 'frame'],
  },
  {
    id: 'alternating-border',
    name: 'Alternating Border',
    category: 'frames',
    description: 'The perimeter alternates accent and secondary tiles.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['border', 'alternating', 'perimeter', 'frame'],
  },
  {
    id: 'offset-nested-frame',
    name: 'Offset Nested Frame',
    category: 'frames',
    description: 'An outer border surrounds a deliberately shifted inner frame.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['border', 'nested', 'offset', 'frame'],
  },
  {
    id: 'split-rail-frame',
    name: 'Split Rail Frame',
    category: 'frames',
    description: 'Side rails and threshold rails use contrasting frame colors.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['border', 'rail', 'split', 'frame'],
  },
  {
    id: 'broken-corner-frame',
    name: 'Broken Corner Frame',
    category: 'frames',
    description: 'A continuous frame breaks into contrasting corner blocks.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['border', 'corner', 'broken', 'frame'],
  },
  {
    id: 'halo-frame',
    name: 'Halo Frame',
    category: 'frames',
    description: 'A soft elliptical halo floats inside a secondary perimeter.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['border', 'halo', 'ring', 'frame'],
  },
  {
    id: 'framed-parking-bays',
    name: 'Framed Parking Bays',
    category: 'parking-bays',
    description: 'Two vehicle outlines sit inside a contrasting garage frame.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['parking', 'bay', 'frame', 'vehicle'],
  },
  {
    id: 'twin-vehicle-pads',
    name: 'Twin Vehicle Pads',
    category: 'parking-bays',
    description: 'Paired vehicle pads use one color per parking position.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['parking', 'twin', 'vehicle', 'pad'],
  },
  {
    id: 'runway-lanes',
    name: 'Runway Lanes',
    category: 'parking-bays',
    description: 'A wide central runway is edged with twin guide lanes.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['parking', 'runway', 'lane', 'guide'],
  },
  {
    id: 'pit-lane',
    name: 'Pit Lane',
    category: 'parking-bays',
    description: 'An offset service lane includes regularly spaced pit markers.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['parking', 'pit', 'lane', 'service'],
  },
  {
    id: 'start-grid',
    name: 'Start Grid',
    category: 'parking-bays',
    description: 'Staggered painted boxes evoke a front-of-grid lineup.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['parking', 'start', 'grid', 'staggered'],
  },
  {
    id: 'service-bay-pairs',
    name: 'Service Bay Pairs',
    category: 'parking-bays',
    description: 'Opposed service outlines leave a clear central aisle.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['parking', 'service', 'bay', 'aisle'],
  },
  {
    id: 'staggered-bay-markers',
    name: 'Staggered Bay Markers',
    category: 'parking-bays',
    description: 'Alternating front and rear markers guide two parking bays.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['parking', 'bay', 'marker', 'staggered'],
  },
  {
    id: 'double-stripe',
    name: 'Double Stripe',
    category: 'stripes-bands',
    description: 'Two solid center stripes run as a single graphic band.',
    roles: ['base', 'accent'],
    searchTerms: ['stripe', 'double', 'racing', 'center'],
  },
  {
    id: 'triple-stripe',
    name: 'Triple Stripe',
    category: 'stripes-bands',
    description: 'Three center lanes alternate accent and secondary colors.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['stripe', 'triple', 'racing', 'center'],
  },
  {
    id: 'pulse-bands',
    name: 'Pulse Bands',
    category: 'stripes-bands',
    description: 'Repeated paired bands create a measured pulse down the floor.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['stripe', 'pulse', 'band', 'rhythm'],
  },
  {
    id: 'barcode-rhythm',
    name: 'Barcode Rhythm',
    category: 'stripes-bands',
    description: 'Irregular vertical bars give the field a graphic cadence.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['stripe', 'barcode', 'vertical', 'rhythm'],
  },
  {
    id: 'tapered-speed-bands',
    name: 'Tapered Speed Bands',
    category: 'stripes-bands',
    description: 'Parallel bands widen as they accelerate toward the rear.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['stripe', 'tapered', 'speed', 'band'],
  },
  {
    id: 'offset-speed-ribbon',
    name: 'Offset Speed Ribbon',
    category: 'stripes-bands',
    description: 'A wide, offset ribbon angles across the length of the room.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['stripe', 'ribbon', 'offset', 'speed'],
  },
  {
    id: 'split-lane-stripes',
    name: 'Split Lane Stripes',
    category: 'stripes-bands',
    description: 'Twin outer lanes flank a contrasting center divider.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['stripe', 'lane', 'split', 'divider'],
  },
  {
    id: 'checker-gradient',
    name: 'Checker Gradient',
    category: 'checkers-grids',
    description: 'Checker blocks grow from fine at the door to broad at the rear.',
    roles: ['base', 'accent'],
    searchTerms: ['checker', 'gradient', 'scale', 'grid'],
  },
  {
    id: 'split-checker-field',
    name: 'Split Checker Field',
    category: 'checkers-grids',
    description: 'Each half of the room carries its own checker accent.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['checker', 'split', 'field', 'grid'],
  },
  {
    id: 'herringbone-field',
    name: 'Herringbone Field',
    category: 'checkers-grids',
    description: 'Offset paired tiles give a herringbone-like field rhythm.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['herringbone', 'checker', 'offset', 'grid'],
  },
  {
    id: 'woven-lattice',
    name: 'Woven Lattice',
    category: 'checkers-grids',
    description: 'Crossing lines alternate over and under at each junction.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['woven', 'lattice', 'grid', 'weave'],
  },
  {
    id: 'tartan-weave',
    name: 'Tartan Weave',
    category: 'checkers-grids',
    description: 'Uneven vertical and horizontal threads form a tartan grid.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['tartan', 'woven', 'plaid', 'grid'],
  },
  {
    id: 'double-windowpane',
    name: 'Double Windowpane',
    category: 'checkers-grids',
    description: 'Paired window lines make a refined architectural grid.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['windowpane', 'double', 'grid', 'line'],
  },
  {
    id: 'crosshatch-field',
    name: 'Crosshatch Field',
    category: 'checkers-grids',
    description: 'Crossing diagonal threads build a diamond hatch texture.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['crosshatch', 'diagonal', 'diamond', 'grid'],
  },
  {
    id: 'nested-chevrons',
    name: 'Nested Chevrons',
    category: 'diagonals-chevrons',
    description: 'Repeating V bands stack from the garage door inward.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['chevron', 'nested', 'v', 'diagonal'],
  },
  {
    id: 'herringbone-run',
    name: 'Herringbone Run',
    category: 'diagonals-chevrons',
    description: 'Alternating diagonal runs form a directional herringbone path.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['herringbone', 'diagonal', 'runner', 'zigzag'],
  },
  {
    id: 'lightning-bolt',
    name: 'Lightning Bolt',
    category: 'diagonals-chevrons',
    description: 'A sharp stepped bolt cuts across the floor.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['lightning', 'bolt', 'zigzag', 'diagonal'],
  },
  {
    id: 'opposing-sweeps',
    name: 'Opposing Sweeps',
    category: 'diagonals-chevrons',
    description: 'Two contrasting diagonals meet at the center point.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['diagonal', 'sweep', 'opposing', 'cross'],
  },
  {
    id: 'offset-zigzag',
    name: 'Offset Zigzag',
    category: 'diagonals-chevrons',
    description: 'A wide two-color zigzag travels through one side of the field.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['zigzag', 'offset', 'diagonal', 'runner'],
  },
  {
    id: 'diagonal-ladder',
    name: 'Diagonal Ladder',
    category: 'diagonals-chevrons',
    description: 'Parallel diagonal rails connect regularly spaced rungs.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['diagonal', 'ladder', 'rail', 'rung'],
  },
  {
    id: 'opposing-corners',
    name: 'Opposing Corners',
    category: 'corners-accents',
    description: 'Two distant corner wedges answer each other in contrasting colors.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['corner', 'opposing', 'wedge', 'asymmetric'],
  },
  {
    id: 'corner-to-corner',
    name: 'Corner to Corner',
    category: 'corners-accents',
    description: 'A broad diagonal division runs from one corner to the other.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['corner', 'diagonal', 'split', 'asymmetric'],
  },
  {
    id: 'stepped-corners',
    name: 'Stepped Corners',
    category: 'corners-accents',
    description: 'Layered corner steps create four compact focal markers.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['corner', 'step', 'layered', 'marker'],
  },
  {
    id: 'asymmetric-cascade',
    name: 'Asymmetric Cascade',
    category: 'corners-accents',
    description: 'A descending series of blocks cascades from one rear corner.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['corner', 'cascade', 'asymmetric', 'step'],
  },
  {
    id: 'offset-crosshair',
    name: 'Offset Crosshair',
    category: 'corners-accents',
    description: 'An off-center crosshair balances a pair of opposing corner accents.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['corner', 'crosshair', 'offset', 'asymmetric'],
  },
  {
    id: 'nested-diamonds',
    name: 'Nested Diamonds',
    category: 'center-fields',
    description: 'Concentric diamond rings focus attention on the center.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['center', 'diamond', 'nested', 'ring'],
  },
  {
    id: 'octagon-medallion',
    name: 'Octagon Medallion',
    category: 'center-fields',
    description: 'A clipped-corner medallion creates an octagon-like centerpiece.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['center', 'octagon', 'medallion', 'diamond'],
  },
  {
    id: 'stepped-rings',
    name: 'Stepped Rings',
    category: 'center-fields',
    description: 'Square concentric rings step inward to a calm center.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['center', 'ring', 'stepped', 'nested'],
  },
  {
    id: 'compass-rose',
    name: 'Compass Rose',
    category: 'center-fields',
    description: 'Cardinal bands and diagonals form a geometric compass motif.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['center', 'compass', 'crosshair', 'diamond'],
  },
  {
    id: 'crosshair-halo',
    name: 'Crosshair Halo',
    category: 'center-fields',
    description: 'A centered crosshair is wrapped by a proportional halo ring.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['center', 'crosshair', 'halo', 'ring'],
  },
  {
    id: 'showroom-island',
    name: 'Showroom Island',
    category: 'center-fields',
    description: 'An offset framed island leaves circulation space around a display pad.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['center', 'showroom', 'island', 'frame'],
  },
  {
    id: 'showroom-halo',
    name: 'Showroom Halo',
    category: 'racing-showroom',
    description: 'A central display pad is surrounded by a broad diamond halo.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['showroom', 'halo', 'diamond', 'display'],
  },
  {
    id: 'finish-lane',
    name: 'Finish Lane',
    category: 'racing-showroom',
    description: 'A checkered racing lane is edged by contrasting guide stripes.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['racing', 'finish', 'lane', 'checker'],
  },
  {
    id: 'pit-wall',
    name: 'Pit Wall',
    category: 'racing-showroom',
    description: 'A long side wall uses repeating pit-box accents.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['racing', 'pit', 'wall', 'service'],
  },
  {
    id: 'grandstand-bands',
    name: 'Grandstand Bands',
    category: 'racing-showroom',
    description: 'Rear-facing stepped bands create a gallery-like backdrop.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['racing', 'grandstand', 'band', 'showroom'],
  },
  {
    id: 'launch-grid',
    name: 'Launch Grid',
    category: 'racing-showroom',
    description: 'A centered launch lane rises from a staggered starting grid.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['racing', 'launch', 'start', 'grid'],
  },
] as const satisfies readonly RoughPatternPreset[];

export const ROUGH_PATTERN_PRESETS = [
  ...CORE_ROUGH_PATTERN_PRESETS,
  ...AUTOMOTIVE_PATTERN_PRESETS,
  ...BORDER_CHECKER_PATTERN_PRESETS,
] as const satisfies readonly RoughPatternPreset[];

export type RoughPresetDesignType =
  (typeof CORE_ROUGH_PATTERN_PRESETS)[number]['id'] | AutomotivePatternId | BorderCheckerPatternId;
export type RoughDesignType = RoughPresetDesignType | 'custom';
export type LegacyRoughDesignType =
  'solid' | 'checkerboard' | 'horizontal-stripes' | 'vertical-stripes' | 'border';

export const ROUGH_DESIGN_TYPES: readonly RoughDesignType[] = Object.freeze([
  ...ROUGH_PATTERN_PRESETS.map((preset) => preset.id),
  'custom',
]);

const LEGACY_PRESET_IDS: Readonly<Record<LegacyRoughDesignType, RoughPresetDesignType>> =
  Object.freeze({
    solid: 'solid-field',
    checkerboard: 'checker-grid',
    'horizontal-stripes': 'horizontal-bands',
    'vertical-stripes': 'vertical-bands',
    border: 'perimeter-frame',
  });

const RETIRED_PRESET_IDS: Readonly<Record<string, RoughPresetDesignType>> = Object.freeze({
  'interlocking-nd-block': 'turbine-medallion-5',
  'interlocking-nd-outline': 'circuit-frame-2',
  'interlocking-nd-medallion': 'turbine-medallion-7',
  'interlocking-nd-twin-bays': 'pit-bay-2',
  'woven-nd-slab': 'turbine-medallion-5',
  'woven-nd-outline': 'circuit-frame-2',
  'nd-double-frame': 'turbine-medallion-7',
  'nd-door-pair': 'pit-bay-2',
});

export interface RoughGarageDimensions {
  readonly widthInches: number;
  readonly lengthInches: number;
}

/**
 * Mandatory empty space between the tile field and the outer garage walls.
 *
 * The front wall, including garage doors, is the horizontal top edge of every plan and SVG:
 * `frontInches` is therefore the top inset and `backInches` is the bottom inset. Width always
 * runs left-to-right; length runs front-to-back.
 */
export interface PerimeterExpansionClearance {
  readonly leftInches: number;
  readonly rightInches: number;
  readonly frontInches: number;
  readonly backInches: number;
}

/** The physical tile field, positioned within the outer wall dimensions. */
export interface TileFieldRectangle {
  readonly xInches: number;
  readonly yInches: number;
  readonly widthInches: number;
  readonly lengthInches: number;
  readonly clearance: PerimeterExpansionClearance;
}

export interface RoughDisplayColor {
  /** A user-facing display color, deliberately independent of a catalog color id. */
  readonly hex: string;
  /** An optional user-facing name that can improve later catalog color matching. */
  readonly label?: string;
}

export type RoughDesignColors = Readonly<Record<RoughDesignRole, RoughDisplayColor>>;
export type RoughCustomCells = Readonly<Record<RoughDesignCellId, RoughDesignRole>>;

/**
 * This compact state contains no catalog product, tile size, or editor-layout cell. It is ready
 * to serialize directly to local storage once the UI starts persisting rough designs.
 */
export interface RoughDesignState {
  readonly version: typeof ROUGH_DESIGN_VERSION;
  /** Outer wall dimensions, never reduced for expansion clearance. */
  readonly garage: RoughGarageDimensions;
  /** Mandatory perimeter clearance; product and conceptual grids use the inset tile field. */
  readonly expansionClearance: PerimeterExpansionClearance;
  readonly type: RoughDesignType;
  readonly colors: RoughDesignColors;
  readonly customBaseType: RoughPresetDesignType | null;
  readonly customGrid: ConceptualGrid | null;
  readonly customCells: RoughCustomCells;
}

export interface RoughDesignOptions {
  readonly garage?: RoughGarageDimensions;
  readonly expansionClearance?: PerimeterExpansionClearance;
  /** Legacy simple values are accepted only to upgrade old callers and saved plans. */
  readonly type?: RoughDesignType | LegacyRoughDesignType;
  readonly colors?: Partial<RoughDesignColors>;
  readonly customBaseType?: RoughPresetDesignType | LegacyRoughDesignType;
  readonly customGrid?: ConceptualGrid;
  readonly customCells?: RoughCustomCells;
}

export interface ConceptualGrid {
  readonly columns: number;
  readonly rows: number;
}

export interface RoughDesignCell {
  readonly id: RoughDesignCellId;
  readonly column: number;
  readonly row: number;
  readonly role: RoughDesignRole;
  readonly displayColor: RoughDisplayColor;
}

export interface RoughDesignPreview {
  readonly grid: ConceptualGrid;
  readonly cells: readonly RoughDesignCell[];
  readonly roleCounts: Readonly<Record<RoughDesignRole, number>>;
}

/** Reusable SVG geometry for a conceptual plan, including its inset physical tile field. */
export interface RoughPreviewGeometry {
  readonly outerGarage: RoughGarageDimensions;
  readonly tileField: TileFieldRectangle;
  readonly grid: ConceptualGrid;
}

export type EdgeCutStrategy = 'no-cuts' | 'back-left-edge-cuts';

export interface AnchoredEdgeFit {
  readonly placementPolicy: 'front-right-anchored';
  /** Space remaining around full tiles. When cuts are required, these are the edge cut widths. */
  readonly leftGapInches: number;
  readonly rightGapInches: number;
  readonly topGapInches: number;
  readonly bottomGapInches: number;
  readonly cutsRequired: boolean;
  readonly cutStrategy: EdgeCutStrategy;
}

export interface RoughProductCell extends RoughDesignCell {
  readonly isCut: boolean;
}

export interface RoughProductDesign {
  readonly productId: string;
  /** Inset physical rectangle used for every product-grid and material calculation. */
  readonly tileField: TileFieldRectangle;
  /**
   * Material quantities based on source tiles. Back and left strips each consume one source tile
   * per full-tile run, plus one corner tile when both axes have remainders.
   */
  readonly materialTileGrid: TileGrid;
  readonly edgeFit: AnchoredEdgeFit;
  readonly grid: ConceptualGrid;
  readonly cells: readonly RoughProductCell[];
  readonly roleCounts: Readonly<Record<RoughDesignRole, number>>;
}

export type RoughColorMappingStatus = 'matched' | 'substituted' | 'unavailable' | 'not-used';

export interface RoughProductColorMapping {
  readonly role: RoughDesignRole;
  readonly requested: RoughDisplayColor;
  readonly status: RoughColorMappingStatus;
  readonly color?: ProductColor;
  readonly message: string;
}

export const DEFAULT_ROUGH_GARAGE_DIMENSIONS: Readonly<RoughGarageDimensions> = Object.freeze({
  widthInches: 230,
  lengthInches: 246,
});

export const DEFAULT_PERIMETER_EXPANSION_CLEARANCE: Readonly<PerimeterExpansionClearance> =
  Object.freeze({
    leftInches: 1,
    rightInches: 1,
    frontInches: 1,
    backInches: 1,
  });

export const DEFAULT_ROUGH_DESIGN_COLORS: RoughDesignColors = Object.freeze({
  base: Object.freeze({ hex: '#d1d5db', label: 'Silver' }),
  accent: Object.freeze({ hex: '#2563eb', label: 'Blue' }),
  secondary: Object.freeze({ hex: '#dc2626', label: 'Red' }),
});

/** Returns deterministic, compact role cells suitable for preset-picker thumbnails. */
export function createRoughPatternThumbnail(
  presetId: RoughPresetDesignType,
  grid: ConceptualGrid = { columns: 8, rows: 5 }
): readonly RoughDesignRole[] {
  assertGrid(grid);
  return Array.from({ length: grid.columns * grid.rows }, (_, index) =>
    getPresetCellRole(presetId, grid, index % grid.columns, Math.floor(index / grid.columns))
  );
}

/** Finds presets by name, category, description, or deliberately curated search terms. */
export function filterRoughPatternPresets(
  query = '',
  category?: RoughPatternCategory
): readonly RoughPatternPreset[] {
  const queryTokens = query
    .trim()
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
  return ROUGH_PATTERN_PRESETS.filter((preset) => {
    const searchableTokens = [
      preset.id,
      preset.name,
      preset.category,
      preset.description,
      ...preset.searchTerms,
    ]
      .join(' ')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 0);
    return (
      (category === undefined || preset.category === category) &&
      queryTokens.every((queryToken) =>
        searchableTokens.some((searchToken) =>
          queryToken.length <= 2 ? searchToken === queryToken : searchToken.includes(queryToken)
        )
      )
    );
  });
}

export function getRoughPatternPreset(presetId: RoughPresetDesignType): RoughPatternPreset {
  const preset = ROUGH_PATTERN_PRESETS.find((candidate) => candidate.id === presetId);
  if (preset === undefined) {
    throw new RangeError(`Unknown rough pattern preset "${presetId}".`);
  }
  return preset;
}

/** Converts the five v1 simple pattern names to stable v2 preset ids. */
export function migrateRoughDesignType(value: unknown): RoughDesignType | null {
  if (typeof value !== 'string') return null;
  if (Object.prototype.hasOwnProperty.call(LEGACY_PRESET_IDS, value)) {
    return LEGACY_PRESET_IDS[value as LegacyRoughDesignType];
  }
  if (Object.prototype.hasOwnProperty.call(RETIRED_PRESET_IDS, value)) {
    return RETIRED_PRESET_IDS[value];
  }
  return isRoughDesignType(value) ? value : null;
}

export function createRoughDesignState(options: RoughDesignOptions = {}): RoughDesignState {
  const garage = options.garage ?? DEFAULT_ROUGH_GARAGE_DIMENSIONS;
  const expansionClearance = options.expansionClearance ?? DEFAULT_PERIMETER_EXPANSION_CLEARANCE;
  const type = normalizeRoughDesignType(options.type ?? 'solid-field');
  const colors: RoughDesignColors = {
    base: options.colors?.base ?? DEFAULT_ROUGH_DESIGN_COLORS.base,
    accent: options.colors?.accent ?? DEFAULT_ROUGH_DESIGN_COLORS.accent,
    secondary: options.colors?.secondary ?? DEFAULT_ROUGH_DESIGN_COLORS.secondary,
  };
  const state: RoughDesignState = {
    version: ROUGH_DESIGN_VERSION,
    garage,
    expansionClearance,
    type,
    colors,
    customBaseType:
      type === 'custom' ? normalizeRoughPresetType(options.customBaseType ?? 'solid-field') : null,
    customGrid:
      type === 'custom'
        ? (options.customGrid ?? getConceptualGrid(garage, expansionClearance))
        : null,
    customCells: options.customCells ?? {},
  };

  assertRoughDesignState(state);
  return state;
}

export function assertRoughGarageDimensions(dimensions: RoughGarageDimensions): void {
  assertPracticalDimension(dimensions.widthInches, 'garage width');
  assertPracticalDimension(dimensions.lengthInches, 'garage length');
}

export function assertPerimeterExpansionClearance(
  clearance: PerimeterExpansionClearance,
  garage?: RoughGarageDimensions
): void {
  for (const [edge, value] of Object.entries(clearance)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`${edge} must be a finite number greater than or equal to zero.`);
    }
  }
  if (garage !== undefined) {
    getTileFieldRectangle(garage, clearance);
  }
}

/**
 * Returns the physical field available for tiles. This is the only rectangle used by tile fit,
 * quantities, product mapping, and conceptual design proportions.
 */
export function getTileFieldRectangle(
  garage: RoughGarageDimensions,
  clearance: PerimeterExpansionClearance = DEFAULT_PERIMETER_EXPANSION_CLEARANCE
): TileFieldRectangle {
  assertRoughGarageDimensions(garage);
  assertPerimeterExpansionClearance(clearance);
  const widthInches = garage.widthInches - clearance.leftInches - clearance.rightInches;
  const lengthInches = garage.lengthInches - clearance.frontInches - clearance.backInches;
  if (widthInches <= 0 || lengthInches <= 0) {
    throw new RangeError(
      'Perimeter expansion clearance must leave a positive-width, positive-length tile field.'
    );
  }

  return {
    xInches: clearance.leftInches,
    yInches: clearance.frontInches,
    widthInches,
    lengthInches,
    clearance,
  };
}

export function assertRoughDesignState(state: RoughDesignState): void {
  if (state.version !== ROUGH_DESIGN_VERSION) {
    throw new RangeError(`Unsupported rough design version ${String(state.version)}.`);
  }
  assertRoughGarageDimensions(state.garage);
  assertPerimeterExpansionClearance(state.expansionClearance, state.garage);
  if (!isRoughDesignType(state.type)) {
    throw new RangeError('Rough design type is invalid.');
  }
  if (state.type === 'custom') {
    const customBaseType: string | null = state.customBaseType;
    if (
      customBaseType === null ||
      !isRoughPresetDesignType(customBaseType) ||
      state.customGrid === null
    ) {
      throw new RangeError('Custom rough designs require a preset base and conceptual grid.');
    }
    assertGrid(state.customGrid);
  } else if (
    state.customBaseType !== null ||
    state.customGrid !== null ||
    Object.keys(state.customCells).length > 0
  ) {
    throw new RangeError('Only custom rough designs can contain custom cell data.');
  }
  for (const role of ROUGH_DESIGN_ROLES) {
    assertDisplayColor(state.colors[role], `${role} color`);
  }
  for (const [cellId, role] of Object.entries(state.customCells)) {
    if (
      !isRoughDesignCellId(cellId) ||
      !ROUGH_DESIGN_ROLES.includes(role) ||
      (state.customGrid !== null && !isCellIdWithinGrid(cellId, state.customGrid))
    ) {
      throw new RangeError(`Custom rough-design cell "${cellId}" is invalid.`);
    }
  }
}

export function getConceptualGrid(
  garage: RoughGarageDimensions,
  clearance: PerimeterExpansionClearance = DEFAULT_PERIMETER_EXPANSION_CLEARANCE
): ConceptualGrid {
  return getConceptualGridForTileField(getTileFieldRectangle(garage, clearance));
}

/** Produces a proportional conceptual grid from the inset tile field rather than outer walls. */
export function getConceptualGridForTileField(tileField: TileFieldRectangle): ConceptualGrid {
  const longerSide = Math.max(tileField.widthInches, tileField.lengthInches);
  const shorterSide = Math.min(tileField.widthInches, tileField.lengthInches);
  const shortAxisCells = clamp(
    Math.round((CONCEPTUAL_LONG_AXIS_CELLS * shorterSide) / longerSide),
    MINIMUM_CONCEPTUAL_SHORT_AXIS_CELLS,
    CONCEPTUAL_LONG_AXIS_CELLS
  );

  return tileField.widthInches >= tileField.lengthInches
    ? { columns: CONCEPTUAL_LONG_AXIS_CELLS, rows: shortAxisCells }
    : { columns: shortAxisCells, rows: CONCEPTUAL_LONG_AXIS_CELLS };
}

export function generateRoughDesignPreview(
  state: RoughDesignState,
  grid = getConceptualGrid(state.garage, state.expansionClearance)
): RoughDesignPreview {
  assertRoughDesignState(state);
  assertGrid(grid);

  const cells: RoughDesignCell[] = [];
  const roleCounts: Record<RoughDesignRole, number> = { base: 0, accent: 0, secondary: 0 };
  for (let row = 0; row < grid.rows; row++) {
    for (let column = 0; column < grid.columns; column++) {
      const role = getRoughCellRole(state, grid, column, row);
      roleCounts[role]++;
      cells.push({
        id: getRoughDesignCellId(column, row),
        column,
        row,
        role,
        displayColor: state.colors[role],
      });
    }
  }

  return { grid, cells, roleCounts };
}

export function buildRoughPreviewGeometry(
  state: RoughDesignState,
  grid = getConceptualGrid(state.garage, state.expansionClearance)
): RoughPreviewGeometry {
  assertRoughDesignState(state);
  assertGrid(grid);
  return {
    outerGarage: state.garage,
    tileField: getTileFieldRectangle(state.garage, state.expansionClearance),
    grid,
  };
}

export function paintRoughDesignCell(
  state: RoughDesignState,
  grid: ConceptualGrid,
  column: number,
  row: number,
  role: RoughDesignRole
): RoughDesignState {
  assertRoughDesignState(state);
  assertGrid(grid);
  assertCellPosition(grid, column, row);
  if (!ROUGH_DESIGN_ROLES.includes(role)) {
    throw new RangeError('Rough design role is invalid.');
  }
  if (state.type === 'custom' && !areGridsEqual(grid, state.customGrid!)) {
    throw new RangeError(
      'Custom rough-design cells must be painted on their saved conceptual grid.'
    );
  }

  return {
    ...state,
    type: 'custom',
    customBaseType: state.type === 'custom' ? state.customBaseType : state.type,
    customGrid: state.type === 'custom' ? state.customGrid : grid,
    customCells: {
      ...state.customCells,
      [getRoughDesignCellId(column, row)]: role,
    },
  };
}

export function getFrontRightEdgeFit(
  tileField: Pick<TileFieldRectangle, 'widthInches' | 'lengthInches'>,
  product: Pick<CatalogProduct, 'dimensions'>
): AnchoredEdgeFit {
  const tileGrid = calculateTileGrid(tileField, product.dimensions);
  const cutsRequired = tileGrid.widthRemainderInches > 0 || tileGrid.lengthRemainderInches > 0;

  return {
    placementPolicy: 'front-right-anchored',
    leftGapInches: tileGrid.widthRemainderInches,
    rightGapInches: 0,
    topGapInches: 0,
    bottomGapInches: tileGrid.lengthRemainderInches,
    cutsRequired,
    cutStrategy: cutsRequired ? 'back-left-edge-cuts' : 'no-cuts',
  };
}

export function mapRoughDesignToProduct(
  state: RoughDesignState,
  product: Pick<CatalogProduct, 'id' | 'dimensions'>
): RoughProductDesign {
  assertRoughDesignState(state);
  const tileField = getTileFieldRectangle(state.garage, state.expansionClearance);
  const tileGrid = calculateTileGrid(tileField, product.dimensions);
  const edgeFit = getFrontRightEdgeFit(tileField, product);
  const grid: ConceptualGrid = {
    columns: tileGrid.fullColumns + (tileGrid.widthRemainderInches === 0 ? 0 : 1),
    rows: tileGrid.fullRows + (tileGrid.lengthRemainderInches === 0 ? 0 : 1),
  };
  const roles: RoughDesignRole[] = [];
  for (let row = 0; row < grid.rows; row++) {
    for (let column = 0; column < grid.columns; column++) {
      roles.push(getProductBaseRole(state, grid, tileGrid, column, row));
    }
  }
  applyCustomOverridesToProductGrid(
    state,
    grid,
    tileGrid,
    edgeFit,
    product.dimensions,
    tileField,
    roles
  );
  const cells: RoughProductCell[] = [];
  const roleCounts: Record<RoughDesignRole, number> = { base: 0, accent: 0, secondary: 0 };

  for (let row = 0; row < grid.rows; row++) {
    for (let column = 0; column < grid.columns; column++) {
      const role = roles[row * grid.columns + column];
      const isCut =
        (tileGrid.widthRemainderInches > 0 && column === 0) ||
        (tileGrid.lengthRemainderInches > 0 && row === grid.rows - 1);
      roleCounts[role]++;
      cells.push({
        id: getRoughDesignCellId(column, row),
        column,
        row,
        role,
        displayColor: state.colors[role],
        isCut,
      });
    }
  }

  return {
    productId: product.id,
    tileField,
    materialTileGrid: tileGrid,
    edgeFit,
    grid,
    cells,
    roleCounts,
  };
}

export function mapRoughColorsToProduct(
  state: RoughDesignState,
  colors: readonly ProductColor[],
  preview = generateRoughDesignPreview(state)
): readonly RoughProductColorMapping[] {
  assertRoughDesignState(state);
  const usedRoles = new Set(ROUGH_DESIGN_ROLES.filter((role) => preview.roleCounts[role] > 0));

  return ROUGH_DESIGN_ROLES.map((role) => {
    const requested = state.colors[role];
    if (!usedRoles.has(role)) {
      return {
        role,
        requested,
        status: 'not-used',
        message: `The ${role} role is not used by this rough design.`,
      };
    }

    const exact = colors.find(
      (color) =>
        normalizeHexColor(color.swatchHex) === normalizeHexColor(requested.hex) ||
        (requested.label !== undefined &&
          normalizeColorName(color.name) === normalizeColorName(requested.label))
    );
    if (exact) {
      return {
        role,
        requested,
        status: 'matched',
        color: exact,
        message: `${describeRequestedColor(requested)} is available as ${exact.name}.`,
      };
    }

    const labelFamily = requested.label === undefined ? undefined : getColorFamily(requested.label);
    const familySubstitute = labelFamily
      ? findBestColorSubstitute(colors, COLOR_FAMILY_TOKENS[labelFamily])
      : undefined;
    const closestSubstitute =
      familySubstitute ?? findClosestDisplayColor(requested.hex, colors, 128);
    if (closestSubstitute) {
      return {
        role,
        requested,
        status: 'substituted',
        color: closestSubstitute,
        message: `${describeRequestedColor(requested)} is substituted with ${closestSubstitute.name}.`,
      };
    }

    return {
      role,
      requested,
      status: 'unavailable',
      message: `${describeRequestedColor(requested)} is unavailable for this product.`,
    };
  });
}

function getRoughCellRole(
  state: RoughDesignState,
  grid: ConceptualGrid,
  column: number,
  row: number
): RoughDesignRole {
  if (state.type === 'custom') {
    const customGrid = state.customGrid!;
    const sourceColumn = scaleCellPosition(column, grid.columns, customGrid.columns);
    const sourceRow = scaleCellPosition(row, grid.rows, customGrid.rows);
    return (
      state.customCells[getRoughDesignCellId(sourceColumn, sourceRow)] ??
      getPresetCellRole(state.customBaseType!, grid, column, row)
    );
  }

  return getPresetCellRole(state.type, grid, column, row);
}

function getProductBaseRole(
  state: RoughDesignState,
  grid: ConceptualGrid,
  tileGrid: TileGrid,
  column: number,
  row: number
): RoughDesignRole {
  const type = state.type === 'custom' ? state.customBaseType! : state.type;
  const roleGrid: ConceptualGrid = {
    columns: Math.max(1, grid.columns - (tileGrid.widthRemainderInches === 0 ? 0 : 1)),
    rows: Math.max(1, grid.rows - (tileGrid.lengthRemainderInches === 0 ? 0 : 1)),
  };
  const roleColumn =
    tileGrid.widthRemainderInches > 0
      ? Math.min(roleGrid.columns - 1, Math.max(0, column - 1))
      : column;
  const roleRow = tileGrid.lengthRemainderInches > 0 ? Math.min(roleGrid.rows - 1, row) : row;

  return getPresetCellRole(type, roleGrid, roleColumn, roleRow);
}

function getPresetCellRole(
  type: RoughPresetDesignType,
  grid: ConceptualGrid,
  column: number,
  row: number
): RoughDesignRole {
  const { columns, rows } = grid;
  const lastColumn = columns - 1;
  const lastRow = rows - 1;
  const centerColumn = lastColumn / 2;
  const centerRow = lastRow / 2;
  const edgeDistance = Math.min(column, row, lastColumn - column, lastRow - row);
  const cornerSize = Math.max(1, Math.min(3, Math.floor(Math.min(columns, rows) / 3)));
  const centerWidth = Math.max(1, Math.floor(columns / 2));
  const centerHeight = Math.max(1, Math.floor(rows / 2));
  const centerLeft = Math.floor((columns - centerWidth) / 2);
  const centerTop = Math.floor((rows - centerHeight) / 2);
  const inCenterPad =
    column >= centerLeft &&
    column < centerLeft + centerWidth &&
    row >= centerTop &&
    row < centerTop + centerHeight;
  const checker = (column + row) % 2 === 0;
  const minDimension = Math.min(columns, rows);
  const borderCheckerRole = getBorderCheckerPatternRole(type, grid, column, row);
  if (borderCheckerRole !== undefined) return borderCheckerRole;
  const automotiveRole = getAutomotivePatternRole(type, grid, column, row);
  if (automotiveRole !== undefined) return automotiveRole;

  switch (type) {
    case 'solid-field':
      return 'base';
    case 'perimeter-frame':
      return edgeDistance === 0 ? 'accent' : 'base';
    case 'inset-frame':
      return edgeDistance === 1 ? 'accent' : 'base';
    case 'broken-frame':
      return edgeDistance === 0 && !(row === 0 && Math.abs(column - centerColumn) < columns / 6)
        ? 'accent'
        : 'base';
    case 'corner-bracket-frame':
      return ((row === 0 || row === lastRow) &&
        (column < cornerSize || column >= columns - cornerSize)) ||
        ((column === 0 || column === lastColumn) && (row < cornerSize || row >= rows - cornerSize))
        ? 'accent'
        : 'base';
    case 'threshold-bands':
      return row === 0 || row === lastRow ? 'accent' : 'base';
    case 'side-rails':
      return column === 0 || column === lastColumn ? 'accent' : 'base';
    case 'stepped-frame':
      return edgeDistance === 0
        ? 'secondary'
        : edgeDistance === 1 && row < Math.ceil(rows / 2)
          ? 'accent'
          : 'base';
    case 'twin-bay-pads': {
      const bayWidth = Math.max(1, Math.floor(columns / 3));
      const bayHeight = Math.max(1, Math.floor(rows * 0.7));
      const bayTop = Math.floor((rows - bayHeight) / 2);
      const leftBay = column >= 1 && column < 1 + bayWidth;
      const rightBay = column >= columns - 1 - bayWidth && column < columns - 1;
      return row >= bayTop && row < bayTop + bayHeight && (leftBay || rightBay) ? 'accent' : 'base';
    }
    case 'bay-outline-pads': {
      const bayWidth = Math.max(1, Math.floor(columns / 3));
      const bayHeight = Math.max(1, Math.floor(rows * 0.7));
      const bayTop = Math.floor((rows - bayHeight) / 2);
      const inLeft = column >= 1 && column < 1 + bayWidth;
      const inRight = column >= columns - 1 - bayWidth && column < columns - 1;
      const onBayEdge =
        row === bayTop ||
        row === bayTop + bayHeight - 1 ||
        column === 1 ||
        column === bayWidth ||
        column === columns - 2 ||
        column === columns - 1 - bayWidth;
      return (inLeft || inRight) && row >= bayTop && row < bayTop + bayHeight && onBayEdge
        ? 'accent'
        : 'base';
    }
    case 'drip-apron':
      return row < Math.max(1, Math.ceil(rows / 4)) ? 'accent' : 'base';
    case 'wheel-tracks': {
      const trackColumns = new Set([
        Math.max(0, Math.floor(columns / 6)),
        Math.max(0, Math.floor(columns / 3)),
        Math.min(lastColumn, Math.ceil((columns * 2) / 3) - 1),
        Math.min(lastColumn, Math.ceil((columns * 5) / 6) - 1),
      ]);
      return trackColumns.has(column) ? 'accent' : 'base';
    }
    case 'bay-divider-rails':
      return column === Math.floor(columns / 2) ||
        (columns >= 8 && column === Math.floor(columns / 4)) ||
        (columns >= 8 && column === Math.floor((columns * 3) / 4))
        ? 'accent'
        : 'base';
    case 'bay-head-blocks': {
      const blockWidth = Math.max(1, Math.floor(columns / 4));
      return row >= rows - Math.max(1, Math.floor(rows / 4)) &&
        ((column >= 1 && column < 1 + blockWidth) ||
          (column >= columns - 1 - blockWidth && column < columns - 1))
        ? 'accent'
        : 'base';
    }
    case 'walk-aisle':
      return edgeDistance === 0
        ? 'secondary'
        : Math.abs(column - centerColumn) <= 0.5
          ? 'accent'
          : 'base';
    case 'twin-racing-stripes':
      return Math.round(Math.abs(column - centerColumn)) === 1 ? 'accent' : 'base';
    case 'offset-racing-stripes': {
      const offsetCenter = Math.floor(columns / 3);
      return column === offsetCenter || column === Math.min(lastColumn, offsetCenter + 2)
        ? 'accent'
        : 'base';
    }
    case 'transverse-bands':
      return row % Math.max(2, Math.floor(rows / 4)) === 0 ? 'accent' : 'base';
    case 'ribbon-wrap': {
      const inset = Math.min(1, edgeDistance);
      return column === inset || column === lastColumn - inset || row === lastRow - inset
        ? 'accent'
        : 'base';
    }
    case 'edge-pinstripes':
      return columns < 3
        ? column === 0
          ? 'accent'
          : 'base'
        : column === 1 || column === lastColumn - 1
          ? 'accent'
          : 'base';
    case 'horizontal-bands':
      return row % 2 === 0 ? 'base' : 'accent';
    case 'vertical-bands':
      return column % 2 === 0 ? 'base' : 'accent';
    case 'checker-grid':
      return checker ? 'base' : 'accent';
    case 'jumbo-checker':
      return (Math.floor(column / 2) + Math.floor(row / 2)) % 2 === 0 ? 'base' : 'accent';
    case 'checker-core':
      return edgeDistance === 0 ? 'secondary' : checker ? 'base' : 'accent';
    case 'checker-apron':
      return row < Math.max(1, Math.ceil(rows / 3)) && !checker ? 'accent' : 'base';
    case 'windowpane-grid':
      return column % Math.max(2, Math.floor(columns / 4)) === 0 ||
        row % Math.max(2, Math.floor(rows / 4)) === 0
        ? 'accent'
        : 'base';
    case 'tartan-grid': {
      const period = Math.max(3, Math.floor(Math.min(columns, rows) / 3));
      return column % period === 0 || row % period === 0
        ? column % (period * 2) === 0 || row % (period * 2) === 0
          ? 'secondary'
          : 'accent'
        : 'base';
    }
    case 'diagonal-checker':
      return (column + row) % 4 < 2 ? 'base' : 'secondary';
    case 'single-sweep':
      return column === Math.round((row * lastColumn) / Math.max(1, lastRow)) ? 'accent' : 'base';
    case 'chevron-split':
      return Math.abs(
        Math.abs(column - centerColumn) - (columns % 2 === 0 ? 0.5 : 0) - (lastRow - row)
      ) < Number.EPSILON
        ? 'accent'
        : 'base';
    case 'arrow-nose':
      return row < Math.ceil(rows / 2) && Math.abs(column - centerColumn) <= row
        ? 'accent'
        : 'base';
    case 'zigzag-runner': {
      const period = Math.max(2, Math.floor(rows / 3));
      const phase = row % (period * 2);
      const wave = phase <= period ? phase : period * 2 - phase;
      return column === Math.round((wave * lastColumn) / period) ? 'accent' : 'base';
    }
    case 'corner-wedge':
      return column + row < Math.max(1, Math.floor(Math.min(columns, rows) / 2))
        ? 'accent'
        : 'base';
    case 'gate-wedges': {
      const depth = Math.max(1, Math.floor(rows / 2));
      const width = Math.max(0, depth - row);
      return row < depth && (column < width || column > lastColumn - width) ? 'accent' : 'base';
    }
    case 'quad-corner-squares':
      return (column < cornerSize || column >= columns - cornerSize) &&
        (row < cornerSize || row >= rows - cornerSize)
        ? 'accent'
        : 'base';
    case 'door-corner-kickers':
      return row < cornerSize && (column < cornerSize || column >= columns - cornerSize)
        ? 'accent'
        : 'base';
    case 'notched-frame':
      return edgeDistance === 0 &&
        !((column === 0 || column === lastColumn) && (row === 0 || row === lastRow))
        ? 'accent'
        : 'base';
    case 'l-bracket-accents':
      return (column < cornerSize && row < 1) ||
        (column < 1 && row < cornerSize) ||
        (column >= columns - cornerSize && row < 1) ||
        (column >= lastColumn && row < cornerSize) ||
        (column < cornerSize && row >= lastRow) ||
        (column < 1 && row >= rows - cornerSize) ||
        (column >= columns - cornerSize && row >= lastRow) ||
        (column >= lastColumn && row >= rows - cornerSize)
        ? 'accent'
        : 'base';
    case 'corner-stairs':
      return column + row < cornerSize * 2 && Math.min(column, row) < cornerSize
        ? 'accent'
        : 'base';
    case 'center-pad':
      return inCenterPad ? 'accent' : 'base';
    case 'framed-center-pad': {
      const distanceToPad = Math.max(
        Math.max(centerLeft - column, 0, column - (centerLeft + centerWidth - 1)),
        Math.max(centerTop - row, 0, row - (centerTop + centerHeight - 1))
      );
      return inCenterPad ? 'accent' : distanceToPad === 1 ? 'secondary' : 'base';
    }
    case 'diamond-medallion':
      return Math.abs(column - centerColumn) + Math.abs(row - centerRow) <=
        Math.max(1, Math.floor(Math.min(columns, rows) / 4))
        ? 'accent'
        : 'base';
    case 'ring-medallion':
      return Math.round(Math.abs(column - centerColumn) + Math.abs(row - centerRow)) ===
        Math.max(1, Math.floor(Math.min(columns, rows) / 4))
        ? 'accent'
        : 'base';
    case 'cross-medallion':
      return Math.abs(column - centerColumn) <= 0.5 || Math.abs(row - centerRow) <= 0.5
        ? 'accent'
        : 'base';
    case 'start-finish-band':
      return row < Math.min(2, rows) && !checker ? 'accent' : 'base';
    case 'podium-steps': {
      const bandHeight = Math.min(rows, Math.max(3, Math.ceil(rows / 2)));
      const bandStart = rows - bandHeight;
      const tier = Math.min(2, Math.floor(((row - bandStart) * 3) / bandHeight));
      const width = Math.max(1, columns - (2 - tier) * Math.max(1, Math.floor(columns / 4)));
      return row >= bandStart && Math.abs(column - centerColumn) < width / 2 ? 'accent' : 'base';
    }
    case 'pit-box': {
      const left = Math.max(0, Math.floor(columns / 4));
      const right = Math.min(lastColumn, columns - 1 - left);
      const bottom = Math.max(1, Math.floor(rows * 0.75));
      return row > 0 &&
        row <= bottom &&
        column >= left &&
        column <= right &&
        (column === left || column === right || row === bottom)
        ? 'accent'
        : 'base';
    }
    case 'apex-curve': {
      const radius = Math.max(1, Math.floor(Math.min(columns, rows) / 2));
      return Math.abs(Math.hypot(column, row) - radius) < 0.5 ? 'accent' : 'base';
    }
    case 'speed-fade': {
      const spacing = Math.max(1, Math.floor(columns / 2));
      return column === 0 ||
        column === spacing ||
        column === Math.max(0, spacing - Math.floor(spacing / 2))
        ? 'accent'
        : 'base';
    }
    case 'double-border': {
      const innerRing = Math.max(2, Math.floor(minDimension / 3));
      return edgeDistance === 0 ? 'secondary' : edgeDistance === innerRing ? 'accent' : 'base';
    }
    case 'triple-border':
      return edgeDistance === 0
        ? 'secondary'
        : edgeDistance === 1
          ? minDimension < 5
            ? column <= centerColumn
              ? 'accent'
              : 'base'
            : 'accent'
          : edgeDistance === 2 && minDimension >= 7
            ? 'secondary'
            : 'base';
    case 'alternating-border':
      return edgeDistance === 0 ? (checker ? 'accent' : 'secondary') : 'base';
    case 'offset-nested-frame': {
      const left = Math.min(lastColumn, Math.max(1, Math.floor(columns / 6)));
      const right = Math.max(left, lastColumn - Math.max(1, Math.floor(columns / 5)));
      const top = Math.min(lastRow, Math.max(1, Math.floor(rows / 4)));
      const bottom = Math.max(top, lastRow - Math.max(1, Math.floor(rows / 6)));
      const onInnerFrame =
        columns >= 4 &&
        rows >= 4 &&
        column >= left &&
        column <= right &&
        row >= top &&
        row <= bottom &&
        (column === left || column === right || row === top || row === bottom);
      return edgeDistance === 0 ? 'secondary' : onInnerFrame ? 'accent' : 'base';
    }
    case 'split-rail-frame':
      return column === 0 || column === lastColumn
        ? 'accent'
        : row === 0 || row === lastRow
          ? 'secondary'
          : 'base';
    case 'broken-corner-frame': {
      const inCorner =
        (column < cornerSize || column >= columns - cornerSize) &&
        (row < cornerSize || row >= rows - cornerSize);
      return edgeDistance !== 0 ? 'base' : inCorner ? 'secondary' : 'accent';
    }
    case 'halo-frame': {
      const ellipticalRadius = Math.hypot(
        (column - centerColumn) / Math.max(1, columns / 2),
        (row - centerRow) / Math.max(1, rows / 2)
      );
      const thickness = Math.max(0.1, 1 / Math.max(1, minDimension));
      return edgeDistance === 0
        ? 'secondary'
        : Math.abs(ellipticalRadius - 0.62) <= thickness
          ? 'accent'
          : 'base';
    }
    case 'framed-parking-bays': {
      const bayWidth = Math.max(1, Math.floor((columns - 3) / 2));
      const bayTop = Math.min(lastRow, 1);
      const bayBottom = Math.max(bayTop, lastRow - 1);
      const leftStart = Math.min(lastColumn, 1);
      const leftEnd = Math.min(lastColumn, leftStart + bayWidth - 1);
      const rightStart = Math.max(leftStart, lastColumn - bayWidth);
      const rightEnd = lastColumn;
      const inLeft = column >= leftStart && column <= leftEnd && row >= bayTop && row <= bayBottom;
      const inRight =
        column >= rightStart && column <= rightEnd && row >= bayTop && row <= bayBottom;
      const onBayFrame =
        (inLeft &&
          (column === leftStart || column === leftEnd || row === bayTop || row === bayBottom)) ||
        (inRight &&
          (column === rightStart || column === rightEnd || row === bayTop || row === bayBottom));
      return edgeDistance === 0 ? 'secondary' : onBayFrame ? 'accent' : 'base';
    }
    case 'twin-vehicle-pads': {
      const bayWidth = Math.max(1, Math.floor((columns - 2) / 2));
      const bayTop = Math.min(lastRow, 1);
      const bayBottom = Math.max(bayTop, lastRow - 1);
      const leftStart = Math.min(lastColumn, 1);
      const rightStart = Math.max(leftStart, lastColumn - bayWidth);
      const inRows = row >= bayTop && row <= bayBottom;
      const inLeft = column >= leftStart && column < leftStart + bayWidth;
      const inRight = column >= rightStart && column < rightStart + bayWidth;
      return inRows && inLeft ? 'accent' : inRows && inRight ? 'secondary' : 'base';
    }
    case 'runway-lanes': {
      const laneStart = Math.floor(lastColumn / 3);
      const laneEnd = Math.max(laneStart, Math.ceil((columns * 2) / 3) - 1);
      return column === laneStart || column === laneEnd
        ? 'accent'
        : column > laneStart && column < laneEnd
          ? 'secondary'
          : 'base';
    }
    case 'pit-lane': {
      const laneColumn = Math.floor(lastColumn / 4);
      const markerColumn = Math.min(lastColumn, laneColumn + 1);
      const markerPeriod = Math.max(2, Math.floor(rows / 4));
      return column === laneColumn
        ? 'accent'
        : column === markerColumn && row % markerPeriod === 0
          ? 'secondary'
          : 'base';
    }
    case 'start-grid': {
      const gridDepth = Math.max(1, Math.floor(rows / 2));
      const slotWidth = Math.max(2, Math.floor(columns / 4));
      const marker = (column + Math.floor(row / 2)) % slotWidth;
      return row < gridDepth
        ? marker === 0
          ? 'accent'
          : marker === 1
            ? 'secondary'
            : 'base'
        : 'base';
    }
    case 'service-bay-pairs': {
      const bayTop = Math.floor(rows / 5);
      const bayBottom = Math.max(bayTop, lastRow - Math.floor(rows / 5));
      const leftEnd = Math.max(0, Math.floor(columns / 3) - 1);
      const rightStart = Math.min(lastColumn, Math.ceil((columns * 2) / 3));
      const inRows = row >= bayTop && row <= bayBottom;
      const onLeft =
        column <= leftEnd &&
        inRows &&
        (column === 0 || column === leftEnd || row === bayTop || row === bayBottom);
      const onRight =
        column >= rightStart &&
        inRows &&
        (column === rightStart || column === lastColumn || row === bayTop || row === bayBottom);
      return onLeft ? 'accent' : onRight ? 'secondary' : 'base';
    }
    case 'staggered-bay-markers': {
      const frontMarker = Math.floor(rows / 4);
      const rearMarker = Math.max(frontMarker, lastRow - frontMarker);
      const leftSide = column < columns / 2;
      return leftSide && row === frontMarker
        ? 'accent'
        : leftSide && row === rearMarker
          ? 'secondary'
          : !leftSide && row === frontMarker
            ? 'secondary'
            : !leftSide && row === rearMarker
              ? 'accent'
              : 'base';
    }
    case 'double-stripe': {
      const stripeStart = Math.max(0, Math.floor((columns - 2) / 2));
      return column === stripeStart || column === Math.min(lastColumn, stripeStart + 1)
        ? 'accent'
        : 'base';
    }
    case 'triple-stripe': {
      const stripeStart = Math.max(0, Math.floor((columns - 3) / 2));
      return column === stripeStart || column === Math.min(lastColumn, stripeStart + 2)
        ? 'accent'
        : column === Math.min(lastColumn, stripeStart + 1)
          ? 'secondary'
          : 'base';
    }
    case 'pulse-bands': {
      const period = Math.max(3, Math.floor(rows / 3));
      const phase = row % period;
      return phase === 0 ? 'secondary' : phase === 1 ? 'accent' : 'base';
    }
    case 'barcode-rhythm': {
      const phase = column % 7;
      return phase === 0 || phase === 5
        ? 'secondary'
        : phase === 1 || phase === 3
          ? 'accent'
          : 'base';
    }
    case 'tapered-speed-bands': {
      const bandWidth = Math.max(1, Math.floor(columns / 8));
      const lead = Math.floor(((row + 1) * columns) / (rows + 1));
      const distance = lead - column;
      return distance >= 0 && distance < bandWidth
        ? 'accent'
        : distance >= bandWidth * 2 && distance < bandWidth * 3
          ? 'secondary'
          : 'base';
    }
    case 'offset-speed-ribbon': {
      const start = Math.floor(lastColumn / 4);
      const end = Math.floor((lastColumn * 3) / 4);
      const ribbonColumn = Math.round(start + ((end - start) * row) / Math.max(1, lastRow));
      const distance = Math.abs(column - ribbonColumn);
      return distance === 0 ? 'accent' : distance === 1 ? 'secondary' : 'base';
    }
    case 'split-lane-stripes': {
      const leftLane = Math.floor(lastColumn / 4);
      const rightLane = Math.max(leftLane, Math.ceil((lastColumn * 3) / 4));
      const divider = Math.floor(lastColumn / 2);
      return column === divider
        ? 'secondary'
        : column === leftLane || column === rightLane
          ? 'accent'
          : 'base';
    }
    case 'checker-gradient': {
      const blockSize = Math.max(1, 1 + Math.floor((row * 3) / Math.max(1, lastRow)));
      return (Math.floor(column / blockSize) + Math.floor(row / blockSize)) % 2 === 0
        ? 'base'
        : 'accent';
    }
    case 'split-checker-field':
      return checker ? 'base' : column <= centerColumn ? 'accent' : 'secondary';
    case 'herringbone-field': {
      const blockSize = Math.max(2, Math.floor(minDimension / 4));
      const blockColumn = Math.floor(column / blockSize);
      const blockRow = Math.floor(row / blockSize);
      const isAccent = (blockColumn + blockRow) % 2 !== 0;
      return !isAccent ? 'base' : row % blockSize === 0 ? 'secondary' : 'accent';
    }
    case 'woven-lattice': {
      const period = Math.max(3, Math.floor(minDimension / 3));
      const vertical = column % period === 0;
      const horizontal = row % period === 0;
      return vertical && horizontal
        ? 'secondary'
        : vertical
          ? 'accent'
          : horizontal
            ? 'secondary'
            : 'base';
    }
    case 'tartan-weave': {
      const verticalPeriod = Math.max(3, Math.floor(columns / 4));
      const horizontalPeriod = Math.max(3, Math.floor(rows / 3));
      const vertical = column % verticalPeriod <= 1;
      const horizontal = row % horizontalPeriod === 0;
      return vertical && horizontal
        ? 'secondary'
        : vertical
          ? 'accent'
          : horizontal
            ? 'secondary'
            : 'base';
    }
    case 'double-windowpane': {
      const spacing = Math.max(4, Math.floor(minDimension / 2));
      const vertical = column % spacing <= 1;
      const horizontal = row % spacing <= 1;
      return vertical && horizontal
        ? 'secondary'
        : vertical
          ? 'accent'
          : horizontal
            ? 'secondary'
            : 'base';
    }
    case 'crosshatch-field': {
      const spacing = Math.max(4, Math.floor(minDimension / 2));
      const rising = (column + row) % spacing === 0;
      const falling = Math.abs(column - row) % spacing === 0;
      return rising && falling ? 'secondary' : rising ? 'accent' : falling ? 'secondary' : 'base';
    }
    case 'nested-chevrons': {
      const spacing = Math.max(3, Math.floor(minDimension / 2));
      const phase = (Math.round(Math.abs(column - centerColumn)) + row) % spacing;
      return phase === 0 ? 'accent' : phase === 1 ? 'secondary' : 'base';
    }
    case 'herringbone-run': {
      const segmentWidth = Math.max(2, Math.floor(columns / 3));
      const segment = Math.floor(column / segmentWidth);
      const localColumn = column % segmentWidth;
      const descending = segment % 2 === 0;
      const runRow = descending
        ? Math.round((localColumn * lastRow) / Math.max(1, segmentWidth - 1))
        : lastRow - Math.round((localColumn * lastRow) / Math.max(1, segmentWidth - 1));
      const distance = Math.abs(row - runRow);
      return distance === 0 ? 'accent' : distance === 1 ? 'secondary' : 'base';
    }
    case 'lightning-bolt': {
      const segmentHeight = Math.max(2, Math.floor(rows / 3));
      const phase = row % (segmentHeight * 2);
      const wave = phase <= segmentHeight ? phase : segmentHeight * 2 - phase;
      const boltColumn = Math.min(
        lastColumn,
        Math.max(
          0,
          Math.floor(columns / 4) +
            Math.round((wave * Math.max(1, Math.floor(columns / 3))) / segmentHeight)
        )
      );
      return column === boltColumn
        ? 'accent'
        : column === Math.min(lastColumn, boltColumn + 1)
          ? 'secondary'
          : 'base';
    }
    case 'opposing-sweeps': {
      const fromLeft = Math.round((row * lastColumn) / Math.max(1, lastRow));
      const fromRight = lastColumn - fromLeft;
      return column === fromLeft && column === fromRight
        ? 'secondary'
        : column === fromLeft
          ? 'accent'
          : column === fromRight
            ? 'secondary'
            : 'base';
    }
    case 'offset-zigzag': {
      const segmentHeight = Math.max(2, Math.floor(rows / 3));
      const phase = row % (segmentHeight * 2);
      const wave = phase <= segmentHeight ? phase : segmentHeight * 2 - phase;
      const zigzagColumn = Math.min(
        lastColumn,
        Math.max(
          0,
          Math.floor(columns / 4) +
            Math.round((wave * Math.max(1, Math.floor((columns * 2) / 5))) / segmentHeight)
        )
      );
      const distance = Math.abs(column - zigzagColumn);
      return distance === 0 ? 'accent' : distance === 1 ? 'secondary' : 'base';
    }
    case 'diagonal-ladder': {
      const spacing = Math.max(3, Math.floor(minDimension / 2));
      const diagonal = (column + row) % spacing;
      const rung = row % spacing === Math.floor(spacing / 2) && column % 2 === 0;
      return diagonal === 0 ? 'accent' : diagonal === 1 || rung ? 'secondary' : 'base';
    }
    case 'opposing-corners': {
      const depth = Math.max(1, Math.floor(minDimension / 3));
      return column + row < depth
        ? 'accent'
        : column + row > lastColumn + lastRow - depth
          ? 'secondary'
          : 'base';
    }
    case 'corner-to-corner': {
      const divider = Math.round((row * lastColumn) / Math.max(1, lastRow));
      const bandWidth = Math.max(1, Math.floor(minDimension / 7));
      return column < divider - bandWidth
        ? 'accent'
        : column > divider + bandWidth
          ? 'secondary'
          : 'base';
    }
    case 'stepped-corners': {
      const cornerDistance = Math.min(
        column + row,
        lastColumn - column + row,
        column + lastRow - row,
        lastColumn - column + lastRow - row
      );
      return cornerDistance < cornerSize * 2
        ? cornerDistance % 2 === 0
          ? 'accent'
          : 'secondary'
        : 'base';
    }
    case 'asymmetric-cascade': {
      const stepHeight = Math.max(1, Math.floor(rows / 4));
      const tier = Math.floor((lastRow - row) / stepHeight);
      const width = Math.max(1, Math.floor(columns / 5));
      const start = Math.max(0, lastColumn - (tier + 1) * width + 1);
      return column >= start ? (tier % 2 === 0 ? 'accent' : 'secondary') : 'base';
    }
    case 'offset-crosshair': {
      const crossColumn = Math.min(lastColumn, Math.max(0, Math.floor(columns * 0.35)));
      const crossRow = Math.min(lastRow, Math.max(0, Math.floor(rows * 0.65)));
      const opposingCorner =
        (column === 0 && row === lastRow) || (column === lastColumn && row === 0);
      return column === crossColumn && row === crossRow
        ? 'secondary'
        : column === crossColumn
          ? 'accent'
          : row === crossRow
            ? 'secondary'
            : opposingCorner
              ? 'accent'
              : 'base';
    }
    case 'nested-diamonds': {
      const diamondDistance = Math.round(
        Math.abs(column - centerColumn) + Math.abs(row - centerRow)
      );
      const ringStep = Math.max(1, Math.floor(minDimension / 5));
      return diamondDistance <= ringStep * 3 && diamondDistance % ringStep === 0
        ? Math.floor(diamondDistance / ringStep) % 2 === 0
          ? 'accent'
          : 'secondary'
        : 'base';
    }
    case 'octagon-medallion': {
      const radius = Math.max(2, Math.floor(minDimension / 3));
      const cornerCut = Math.max(1, Math.floor(radius / 2));
      const horizontal = Math.abs(column - centerColumn);
      const vertical = Math.abs(row - centerRow);
      const octagonLimit = radius * 2 - cornerCut;
      const inOctagon =
        Math.max(horizontal, vertical) <= radius && horizontal + vertical <= octagonLimit;
      const onEdge =
        Math.max(horizontal, vertical) >= radius - 1 || horizontal + vertical >= octagonLimit - 1;
      return !inOctagon ? 'base' : onEdge ? 'secondary' : 'accent';
    }
    case 'stepped-rings': {
      const ringDistance = Math.round(
        Math.max(Math.abs(column - centerColumn), Math.abs(row - centerRow))
      );
      const ringStep = Math.max(1, Math.floor(minDimension / 5));
      return ringDistance <= ringStep * 3 && ringDistance % ringStep === 0
        ? Math.floor(ringDistance / ringStep) % 2 === 0
          ? 'accent'
          : 'secondary'
        : 'base';
    }
    case 'compass-rose': {
      const horizontal = Math.abs(column - centerColumn);
      const vertical = Math.abs(row - centerRow);
      const cardinal = horizontal <= 0.5 || vertical <= 0.5;
      const diagonal = Math.abs(horizontal - vertical) <= 0.5;
      const reach = Math.max(horizontal, vertical) <= Math.max(2, Math.floor(minDimension / 3));
      return cardinal ? 'accent' : diagonal && reach ? 'secondary' : 'base';
    }
    case 'crosshair-halo': {
      const haloRadius = Math.hypot(
        (column - centerColumn) / Math.max(1, columns / 2),
        (row - centerRow) / Math.max(1, rows / 2)
      );
      const onHalo = Math.abs(haloRadius - 0.58) <= Math.max(0.1, 1 / Math.max(1, minDimension));
      const onCrosshair =
        Math.abs(column - centerColumn) <= 0.5 || Math.abs(row - centerRow) <= 0.5;
      return onHalo ? 'secondary' : onCrosshair ? 'accent' : 'base';
    }
    case 'showroom-island': {
      const islandWidth = Math.max(1, Math.floor(columns * 0.35));
      const islandHeight = Math.max(1, Math.floor(rows * 0.4));
      const islandLeft = Math.min(
        Math.max(0, Math.floor(columns * 0.55 - islandWidth / 2)),
        Math.max(0, lastColumn - islandWidth + 1)
      );
      const islandTop = Math.min(
        Math.max(0, Math.floor(rows * 0.45 - islandHeight / 2)),
        Math.max(0, lastRow - islandHeight + 1)
      );
      const islandRight = Math.min(lastColumn, islandLeft + islandWidth - 1);
      const islandBottom = Math.min(lastRow, islandTop + islandHeight - 1);
      const inIsland =
        column >= islandLeft && column <= islandRight && row >= islandTop && row <= islandBottom;
      const distanceToIsland = Math.max(
        islandLeft - column,
        0,
        column - islandRight,
        islandTop - row,
        0,
        row - islandBottom
      );
      return inIsland ? 'accent' : distanceToIsland === 1 ? 'secondary' : 'base';
    }
    case 'showroom-halo': {
      const padWidth = Math.max(1, Math.floor(columns / 3));
      const padHeight = Math.max(1, Math.floor(rows / 3));
      const padLeft = Math.floor((columns - padWidth) / 2);
      const padTop = Math.floor((rows - padHeight) / 2);
      const inPad =
        column >= padLeft &&
        column < padLeft + padWidth &&
        row >= padTop &&
        row < padTop + padHeight;
      const haloDistance = Math.round(Math.abs(column - centerColumn) + Math.abs(row - centerRow));
      const haloRadius = Math.max(2, Math.floor(minDimension / 3));
      return inPad ? 'accent' : haloDistance === haloRadius ? 'secondary' : 'base';
    }
    case 'finish-lane': {
      const laneWidth = Math.min(columns, Math.max(3, Math.floor(columns / 3)));
      const laneLeft = Math.floor((columns - laneWidth) / 2);
      const laneRight = laneLeft + laneWidth - 1;
      return column === laneLeft || column === laneRight
        ? 'secondary'
        : column > laneLeft && column < laneRight
          ? checker
            ? 'accent'
            : 'base'
          : 'base';
    }
    case 'pit-wall': {
      const wallColumn = Math.floor(lastColumn / 6);
      const markerColumn = Math.min(lastColumn, wallColumn + 1);
      const markerLength = Math.max(1, Math.floor(rows / 5));
      return column === wallColumn
        ? 'accent'
        : column === markerColumn && Math.floor(row / markerLength) % 2 === 0
          ? 'secondary'
          : 'base';
    }
    case 'grandstand-bands': {
      const stageTop = Math.floor(rows / 2);
      const tierHeight = Math.max(1, Math.floor(Math.max(1, rows - stageTop) / 3));
      const tier = Math.min(2, Math.floor((lastRow - row) / tierHeight));
      const halfWidth = Math.max(
        0,
        Math.floor(columns / 2) - tier * Math.max(1, Math.floor(columns / 6))
      );
      const inGrandstand = row >= stageTop && Math.abs(column - centerColumn) <= halfWidth;
      return !inGrandstand ? 'base' : tier % 2 === 0 ? 'accent' : 'secondary';
    }
    case 'launch-grid': {
      const launchColumn = Math.floor(lastColumn / 2);
      const gridDepth = Math.max(1, Math.floor(rows / 3));
      const slotWidth = Math.max(2, Math.floor(columns / 4));
      const startMarker = (column + Math.floor(row / 2)) % slotWidth === 0;
      return column === launchColumn || column === Math.min(lastColumn, launchColumn + 1)
        ? 'secondary'
        : row < gridDepth && startMarker
          ? 'accent'
          : 'base';
    }
    default:
      throw new RangeError(`Unknown rough pattern preset "${type}".`);
  }
}

function applyCustomOverridesToProductGrid(
  state: RoughDesignState,
  productGrid: ConceptualGrid,
  tileGrid: TileGrid,
  edgeFit: AnchoredEdgeFit,
  tile: Pick<CatalogProduct['dimensions'], 'widthInches' | 'lengthInches'>,
  tileField: TileFieldRectangle,
  roles: RoughDesignRole[]
): void {
  if (state.type !== 'custom') return;

  const customGrid = state.customGrid!;
  for (const [cellId, role] of Object.entries(state.customCells).sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    const { column, row } = parseRoughDesignCellId(cellId);
    const targetColumn = findProductGridPosition(
      ((column + 0.5) * tileField.widthInches) / customGrid.columns,
      tileGrid.fullColumns,
      productGrid.columns,
      edgeFit.leftGapInches,
      tile.widthInches
    );
    const targetRow = findProductGridPosition(
      ((row + 0.5) * tileField.lengthInches) / customGrid.rows,
      tileGrid.fullRows,
      productGrid.rows,
      edgeFit.topGapInches,
      tile.lengthInches
    );
    roles[targetRow * productGrid.columns + targetColumn] = role;
  }
}

function findClosestDisplayColor(
  requestedHex: string,
  colors: readonly ProductColor[],
  maximumDistance: number
): ProductColor | undefined {
  const requested = parseHexColor(requestedHex);
  const candidates = colors
    .map((color, index) => ({
      color,
      index,
      distance: rgbDistance(requested, parseHexColor(color.swatchHex)),
    }))
    .filter((candidate) => candidate.distance <= maximumDistance)
    .sort((left, right) => left.distance - right.distance || left.index - right.index);

  return candidates[0]?.color;
}

function getRoughDesignCellId(column: number, row: number): RoughDesignCellId {
  return `${column}-${row}`;
}

function scaleCellPosition(position: number, targetSize: number, sourceSize: number): number {
  return Math.min(sourceSize - 1, Math.floor(((position + 0.5) * sourceSize) / targetSize));
}

function findProductGridPosition(
  positionInches: number,
  fullTileCount: number,
  gridSize: number,
  leadingCutWidthInches: number,
  tileSizeInches: number
): number {
  if (leadingCutWidthInches > 0 && positionInches < leadingCutWidthInches) {
    return 0;
  }

  const fullTilesEnd = leadingCutWidthInches + fullTileCount * tileSizeInches;
  if (positionInches >= fullTilesEnd) {
    return gridSize - 1;
  }

  return Math.min(
    gridSize - 1,
    (leadingCutWidthInches > 0 ? 1 : 0) +
      Math.max(0, Math.floor((positionInches - leadingCutWidthInches) / tileSizeInches))
  );
}

function assertPracticalDimension(value: number, label: string): void {
  if (
    !Number.isFinite(value) ||
    value < MINIMUM_GARAGE_DIMENSION_INCHES ||
    value > MAXIMUM_GARAGE_DIMENSION_INCHES ||
    !isSixteenthInchIncrement(value)
  ) {
    throw new RangeError(
      `${label} must be a finite value from ${MINIMUM_GARAGE_DIMENSION_INCHES} to ${MAXIMUM_GARAGE_DIMENSION_INCHES} inches in 1/16-inch increments.`
    );
  }
}

function assertDisplayColor(color: RoughDisplayColor, label: string): void {
  if (!isHexColor(color.hex)) {
    throw new RangeError(`${label} must use a six-digit hexadecimal display color.`);
  }
  if (color.label !== undefined && color.label.trim().length === 0) {
    throw new RangeError(`${label} label cannot be blank.`);
  }
}

function assertGrid(grid: ConceptualGrid): void {
  if (
    !Number.isSafeInteger(grid.columns) ||
    !Number.isSafeInteger(grid.rows) ||
    grid.columns <= 0 ||
    grid.rows <= 0
  ) {
    throw new RangeError('Conceptual grid dimensions must be positive safe integers.');
  }
}

function assertCellPosition(grid: ConceptualGrid, column: number, row: number): void {
  if (
    !Number.isSafeInteger(column) ||
    !Number.isSafeInteger(row) ||
    column < 0 ||
    row < 0 ||
    column >= grid.columns ||
    row >= grid.rows
  ) {
    throw new RangeError('Rough design cell position is outside the conceptual grid.');
  }
}

function isRoughDesignCellId(value: string): value is RoughDesignCellId {
  return /^\d+-\d+$/.test(value);
}

function isRoughPresetDesignType(value: string): value is RoughPresetDesignType {
  return ROUGH_PATTERN_PRESETS.some((preset) => preset.id === value);
}

function isRoughDesignType(value: string): value is RoughDesignType {
  return value === 'custom' || isRoughPresetDesignType(value);
}

function normalizeRoughDesignType(type: RoughDesignType | LegacyRoughDesignType): RoughDesignType {
  return Object.prototype.hasOwnProperty.call(LEGACY_PRESET_IDS, type)
    ? LEGACY_PRESET_IDS[type as LegacyRoughDesignType]
    : (type as RoughDesignType);
}

function normalizeRoughPresetType(
  type: RoughPresetDesignType | LegacyRoughDesignType
): RoughPresetDesignType {
  const normalized = normalizeRoughDesignType(type);
  if (normalized === 'custom') {
    throw new RangeError('Custom rough designs require a preset base.');
  }
  return normalized;
}

function isCellIdWithinGrid(value: RoughDesignCellId, grid: ConceptualGrid): boolean {
  const { column, row } = parseRoughDesignCellId(value);
  return column < grid.columns && row < grid.rows;
}

function parseRoughDesignCellId(value: string): {
  readonly column: number;
  readonly row: number;
} {
  const [column, row] = value.split('-').map((part) => Number.parseInt(part, 10));
  return { column, row };
}

function areGridsEqual(left: ConceptualGrid, right: ConceptualGrid): boolean {
  return left.columns === right.columns && left.rows === right.rows;
}

function isSixteenthInchIncrement(value: number): boolean {
  return Math.abs(value * 16 - Math.round(value * 16)) <= Number.EPSILON * 128;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function normalizeHexColor(value: string): string {
  return value.toLowerCase();
}

function parseHexColor(value: string): readonly [number, number, number] {
  if (!isHexColor(value)) {
    throw new RangeError('Display colors must use six-digit hexadecimal values.');
  }
  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
}

function rgbDistance(
  left: readonly [number, number, number],
  right: readonly [number, number, number]
): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}

function describeRequestedColor(color: RoughDisplayColor): string {
  return color.label ?? color.hex;
}
