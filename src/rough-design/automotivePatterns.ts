import type { RoughPatternCategory, RoughDesignRole, ConceptualGrid } from './roughDesign';

/**
 * Original tile-native layouts informed by recurring motifs in public customer galleries and
 * highly rated owner installations, checked 2026-07-30. Sources include RaceDeck's photo gallery
 * and testimonials, ModuTile's gallery and reviews, Garage Flooring LLC's 302-post customer
 * gallery, Greatmats' design guidance, and long-term owner projects published by All Garage Floors
 * and Garage Journal. The implementation uses only generic geometry and does not reproduce logos.
 */
const AUTOMOTIVE_VARIANTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

type AutomotiveVariant = (typeof AUTOMOTIVE_VARIANTS)[number];

export type AutomotivePatternFamily =
  | 'circuit-frame'
  | 'pit-bay'
  | 'velocity-stripe'
  | 'flag-wave'
  | 'apex-chevron'
  | 'corner-aero'
  | 'turbine-medallion'
  | 'endurance-track'
  | 'boulevard-lane'
  | 'telemetry-grid';

export type AutomotivePatternId = `${AutomotivePatternFamily}-${AutomotiveVariant}`;

export interface AutomotivePatternPreset {
  readonly id: AutomotivePatternId;
  readonly name: string;
  readonly category: RoughPatternCategory;
  readonly description: string;
  readonly roles: readonly RoughDesignRole[];
  readonly searchTerms: readonly string[];
}

interface AutomotiveFamilyDefinition {
  readonly id: AutomotivePatternFamily;
  readonly category: RoughPatternCategory;
  readonly description: string;
  readonly searchTerms: readonly string[];
  readonly names: readonly [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
}

const AUTOMOTIVE_FAMILIES: readonly AutomotiveFamilyDefinition[] = [
  {
    id: 'circuit-frame',
    category: 'frames',
    description: 'Layered borders use gates, chicanes, and contrasting curbs like a circuit map.',
    searchTerms: ['border', 'circuit', 'track', 'curb', 'double border', 'racing'],
    names: [
      'Double Curb Circuit',
      'Endurance Gate Frame',
      'Technical Chicane',
      'Tri-Oval Frame',
      'Climbing S-Curve Border',
      'Corkscrew Frame',
      'Flowing Esses Border',
      'High-Speed Kink',
      'Night-Race Frame',
      'Long-Course Ring',
    ],
  },
  {
    id: 'pit-bay',
    category: 'parking-bays',
    description:
      'Parking pads combine pit boxes, service lanes, wheel guides, and numbered stalls.',
    searchTerms: ['parking', 'pit', 'bay', 'service', 'wheel', 'garage', 'stall'],
    names: [
      'Twin Pit Boxes',
      'Crew Chief Bays',
      'Grid Walk Stalls',
      'Hot-Pit Service Pads',
      'Parc Ferme Pair',
      'Endurance Triple Bay',
      'Detailing Lane Bays',
      'Track-Day Paddock',
      'Front-Row Pads',
      'Victory Lane Garage',
    ],
  },
  {
    id: 'velocity-stripe',
    category: 'stripes-bands',
    description:
      'Offset racing stripes, speed trails, and staggered bands stretch through the room.',
    searchTerms: ['stripe', 'racing', 'speed', 'band', 'offset', 'centerline', 'trail'],
    names: [
      'Heritage Twin Stripe',
      'Offset GT Stripe',
      'Triple Apex Bands',
      'Supersonic Runner',
      'Turbo Fade Lines',
      'Endurance Centerline',
      'Slingshot Stripes',
      'Velocity Split',
      'Drafting Trails',
      'Redline Quartet',
    ],
  },
  {
    id: 'flag-wave',
    category: 'checkers-grids',
    description: 'Checkered fields bend, taper, and break apart like a flag moving at speed.',
    searchTerms: ['checker', 'flag', 'finish', 'grid', 'wave', 'racing', 'pixel'],
    names: [
      'Flying Finish Flag',
      'Pixel Flag Sweep',
      'Victory Checker Arc',
      'Broken Checkered Ribbon',
      'Finish-Line Burst',
      'Diagonal Flag Fold',
      'Race-Day Pennant',
      'Checker Vapor Trail',
      'Podium Flag Wall',
      'Midnight Finish Grid',
    ],
  },
  {
    id: 'apex-chevron',
    category: 'diagonals-chevrons',
    description: 'Chevron sequences mark braking zones, turn-in points, and fast directional flow.',
    searchTerms: ['chevron', 'apex', 'arrow', 'diagonal', 'braking', 'racing', 'direction'],
    names: [
      'Late Apex Arrows',
      'Double Yellow Chevron',
      'Braking Zone V',
      'Turn-In Cascade',
      'Hairpin Arrowhead',
      'Slipstream Chevron',
      'Switchback Spear',
      'Esses Directionals',
      'Launch-Control V',
      'Full-Throttle Arrow',
    ],
  },
  {
    id: 'corner-aero',
    category: 'corners-accents',
    description:
      'Asymmetric corner blocks suggest splitters, wings, vents, and aerodynamic flicks.',
    searchTerms: ['corner', 'aero', 'splitter', 'wing', 'vent', 'asymmetric', 'automotive'],
    names: [
      'Carbon Splitter Corners',
      'Rear Wing Endplates',
      'Brake-Duct Blocks',
      'Canard Corner Set',
      'Diffuser Fins',
      'Aero Blade Pair',
      'Quarter-Panel Vents',
      'Downforce Brackets',
      'Widebody Corner Caps',
      'Active Aero Sweep',
    ],
  },
  {
    id: 'turbine-medallion',
    category: 'center-fields',
    description:
      'Geometric centerpieces evoke wheels, rotors, turbines, gauges, and mechanical hubs.',
    searchTerms: ['center', 'wheel', 'rotor', 'turbine', 'gauge', 'hub', 'medallion'],
    names: [
      'Forged Wheel Hub',
      'Cross-Drilled Rotor',
      'Turbo Impeller',
      'Tachometer Dial',
      'Five-Spoke Centerpiece',
      'Knock-Off Spinner',
      'Brake Rotor Halo',
      'Turbofan Medallion',
      'Rev-Counter Ring',
      'Centerlock Star',
    ],
  },
  {
    id: 'endurance-track',
    category: 'racing-showroom',
    description: 'A continuous tile-native course loops around a display field with racing curbs.',
    searchTerms: ['track', 'course', 'circuit', 'loop', 'curb', 'showroom', 'racing'],
    names: [
      'Endurance Circuit',
      'Club Course Loop',
      'Infield Road Course',
      'Night-Race Circuit',
      'Technical Esses Loop',
      'High-Speed Ring',
      'Grand Touring Course',
      'Paddock Test Track',
      'Coastal Raceway',
      'Mountain Pass Circuit',
    ],
  },
  {
    id: 'boulevard-lane',
    category: 'parking-bays',
    description:
      'Road-inspired lanes use center dashes, shoulders, crosswalks, and parking markers.',
    searchTerms: ['road', 'lane', 'highway', 'centerline', 'crosswalk', 'parking', 'street'],
    names: [
      'Pit-Lane Boulevard',
      'Open-Road Centerline',
      'Midnight Expressway',
      'Garage Crosswalk',
      'Two-Lane Roadway',
      'Passing-Zone Dashes',
      'Paddock Access Road',
      'Boulevard Turn Pocket',
      'Service-Road Shoulders',
      'Unlimited Highway Lane',
    ],
  },
  {
    id: 'telemetry-grid',
    category: 'racing-showroom',
    description:
      'Data-like traces turn lap timing, shift lights, and waveform graphics into tile art.',
    searchTerms: ['telemetry', 'data', 'wave', 'shift light', 'timing', 'grid', 'digital'],
    names: [
      'Telemetry Trace',
      'Shift-Light Ladder',
      'Lap-Time Matrix',
      'Dyno Graph Floor',
      'Rev-Limiter Pulse',
      'Sector-Time Grid',
      'Digital Dash Sweep',
      'Boost Curve',
      'ECU Signal Path',
      'Race-Control Matrix',
    ],
  },
] as const;

export const AUTOMOTIVE_PATTERN_PRESETS: readonly AutomotivePatternPreset[] =
  AUTOMOTIVE_FAMILIES.flatMap((family) =>
    AUTOMOTIVE_VARIANTS.map((variant, index) => ({
      id: `${family.id}-${variant}`,
      name: family.names[index],
      category: family.category,
      description: family.description,
      roles: ['base', 'accent', 'secondary'] as const,
      searchTerms: [...family.searchTerms, family.names[index].toLowerCase()],
    }))
  );

export function getAutomotivePatternRole(
  type: string,
  grid: ConceptualGrid,
  column: number,
  row: number
): RoughDesignRole | undefined {
  const match = /^(.*)-([1-9]|10)$/.exec(type);
  if (match === null) return undefined;

  const family = match[1] as AutomotivePatternFamily;
  const familyIndex = AUTOMOTIVE_FAMILIES.findIndex((candidate) => candidate.id === family);
  if (familyIndex === -1) return undefined;

  const variant = Number(match[2]);
  const { columns, rows } = grid;
  const lastColumn = columns - 1;
  const lastRow = rows - 1;
  const centerColumn = lastColumn / 2;
  const centerRow = lastRow / 2;
  const minDimension = Math.max(1, Math.min(columns, rows));
  const edgeDistance = Math.min(column, row, lastColumn - column, lastRow - row);
  const checker = (column + row + variant) % 2 === 0;
  const normalizedX = (column + 0.5) / columns;
  const normalizedY = (row + 0.5) / rows;
  const signatureRole = getTelemetrySignatureRole(
    familyIndex * AUTOMOTIVE_VARIANTS.length + variant - 1,
    grid,
    column,
    row
  );
  if (signatureRole !== undefined) return signatureRole;

  switch (family) {
    case 'circuit-frame': {
      const outerRing = (variant - 1) % 2;
      const innerRing = outerRing === 0 ? 1 : 0;
      const gateSize = Math.max(1, Math.floor(columns / (4 + (variant % 3))));
      const gateStart = (variant * 3) % Math.max(1, columns - gateSize + 1);
      const inFrontGate = row === outerRing && column >= gateStart && column < gateStart + gateSize;
      const chicane =
        edgeDistance === innerRing &&
        (column + Math.floor(row / Math.max(1, variant % 4))) % (3 + (variant % 3)) === 0;
      if (edgeDistance === outerRing && !inFrontGate) return 'accent';
      return edgeDistance === innerRing || chicane ? 'secondary' : 'base';
    }
    case 'pit-bay': {
      const bayCount = 2 + ((variant - 1) % 3);
      const bay = Math.min(bayCount - 1, Math.floor((column * bayCount) / columns));
      const bayLeft = Math.floor((bay * columns) / bayCount);
      const bayRight = Math.ceil(((bay + 1) * columns) / bayCount) - 1;
      const inset = bayRight - bayLeft >= 4 && variant % 2 === 1 ? 2 : 1;
      const top = Math.max(1, Math.floor(rows * (0.12 + (variant % 3) * 0.04)));
      const bottom = Math.min(lastRow - 1, Math.ceil(rows * (0.72 + (variant % 2) * 0.08)));
      const outline =
        (column === bayLeft + inset || column === bayRight - inset) && row >= top && row <= bottom;
      const stopBox =
        row === top + Math.floor((bottom - top) * (0.25 + (variant % 4) * 0.12)) &&
        column > bayLeft + inset &&
        column < bayRight - inset;
      const serviceLane = row >= bottom + 1 && (column + variant) % Math.max(3, bayCount + 2) === 0;
      const stallMarkerRow = top + ((variant * 2) % Math.max(1, bottom - top + 1));
      const stallMarker = row === stallMarkerRow && column === Math.floor((bayLeft + bayRight) / 2);
      const pitNumberMarker = row === lastRow && column === Math.min(lastColumn, variant);
      const serviceMarker = row === 0 && column === 0;
      return outline || stopBox || pitNumberMarker
        ? 'accent'
        : serviceLane || stallMarker || serviceMarker
          ? 'secondary'
          : 'base';
    }
    case 'velocity-stripe': {
      const vertical = variant % 3 !== 0;
      const position = vertical ? column : row;
      const length = vertical ? columns : rows;
      const crossPosition = vertical ? row : column;
      const crossLength = vertical ? rows : columns;
      const drift =
        variant >= 4 ? Math.floor((crossPosition * (1 + (variant % 2))) / crossLength) : 0;
      const primary = positiveModulo(
        Math.floor((length - 1) / 2) + (variant % 3) - 1 + drift,
        length
      );
      const secondary = positiveModulo(primary + 2 + (variant % 2), length);
      if (
        position === primary ||
        (variant >= 7 && position === positiveModulo(primary + 1, length))
      ) {
        return 'accent';
      }
      return position === secondary ? 'secondary' : 'base';
    }
    case 'flag-wave': {
      const wave = Math.round(
        Math.sin((normalizedY * (2 + (variant % 3)) + variant) * Math.PI) * 2
      );
      const boundary = Math.floor(columns * (0.35 + (variant % 4) * 0.08)) + wave;
      const inFlag = variant % 2 === 0 ? column <= boundary : column >= lastColumn - boundary;
      const ribbon =
        Math.abs(
          row - Math.round(centerRow + Math.sin(normalizedX * Math.PI * 2) * (variant % 4))
        ) <= 1;
      if (inFlag && checker) return 'accent';
      return (inFlag && !checker) || ribbon ? 'secondary' : 'base';
    }
    case 'apex-chevron': {
      const apexRow = Math.floor(rows * (0.18 + (variant % 5) * 0.12));
      const spread = 1 + (variant % 3);
      const chevronDistance = Math.abs(column - centerColumn) - Math.abs(row - apexRow) / spread;
      const first = Math.abs(chevronDistance) < 0.65;
      const second = Math.abs(chevronDistance - (2 + (variant % 3))) < 0.65;
      const centerDash =
        variant >= 6 &&
        Math.abs(column - centerColumn) < 0.7 &&
        Math.floor(row / Math.max(1, variant % 4)) % 2 === 0;
      return first ? 'accent' : second || centerDash ? 'secondary' : 'base';
    }
    case 'corner-aero': {
      const size = Math.max(2, Math.floor(minDimension * (0.18 + (variant % 4) * 0.04)));
      const mirror = variant % 2 === 0;
      const inPrimary =
        column + row < size ||
        (variant >= 6 && lastColumn - column + lastRow - row < Math.max(2, size - 1));
      const inSecondary = mirror ? lastColumn - column + row < size : column + lastRow - row < size;
      const vent =
        (inPrimary || inSecondary) &&
        (column * 2 + row + variant) % Math.max(2, 3 + (variant % 3)) === 0;
      return inPrimary && !vent ? 'accent' : inSecondary || vent ? 'secondary' : 'base';
    }
    case 'turbine-medallion': {
      const dx = column - centerColumn;
      const dy = row - centerRow;
      const distance = Math.hypot(dx, dy);
      const radius = minDimension * (0.2 + (variant % 4) * 0.035);
      const angle = Math.atan2(dy, dx) + Math.PI;
      const spokeCount = 4 + ((variant - 1) % 6);
      const spoke =
        Math.floor((angle / (Math.PI * 2)) * spokeCount + distance * 0.35 + variant) % 2;
      const onRing = Math.abs(distance - radius) < 0.8;
      const inHub = distance <= Math.max(1, minDimension * 0.08);
      if (onRing || (distance < radius && spoke === 0)) return 'accent';
      return inHub || Math.abs(distance - radius * 1.35) < 0.65 ? 'secondary' : 'base';
    }
    case 'endurance-track': {
      const margin = 1 + (variant % 3);
      const trackWidth = 1 + (variant % 2);
      const horizontalStraight =
        row >= margin &&
        row <= margin + trackWidth &&
        column >= margin &&
        column <= lastColumn - margin;
      const returnStraight =
        row >= lastRow - margin - trackWidth &&
        row <= lastRow - margin &&
        column >= margin &&
        column <= lastColumn - margin;
      const leftTurn =
        column >= margin &&
        column <= margin + trackWidth &&
        row >= margin &&
        row <= lastRow - margin;
      const rightOffset = Math.max(margin, margin + ((variant % 4) - 1));
      const rightTurn =
        column >= lastColumn - rightOffset - trackWidth &&
        column <= lastColumn - rightOffset &&
        row >= margin &&
        row <= lastRow - margin;
      const onTrack = horizontalStraight || returnStraight || leftTurn || rightTurn;
      const curb = onTrack && (column + row + variant) % (3 + (variant % 3)) === 0;
      return onTrack && !curb ? 'accent' : curb ? 'secondary' : 'base';
    }
    case 'boulevard-lane': {
      const laneCenter = centerColumn + ((variant % 3) - 1);
      const laneHalfWidth = Math.max(2, Math.floor(columns * (0.16 + (variant % 2) * 0.04)));
      const shoulder = Math.abs(Math.abs(column - laneCenter) - laneHalfWidth) < 0.6;
      const outerGuide = Math.abs(Math.abs(column - laneCenter) - laneHalfWidth - 1) < 0.6;
      const centerDash =
        Math.abs(column - laneCenter) < 0.6 &&
        Math.floor(row / Math.max(1, 1 + (variant % 4))) % 2 === 0;
      const crosswalk =
        variant >= 4 &&
        Math.abs(row - Math.floor(rows * (0.25 + (variant % 5) * 0.1))) <= 1 &&
        Math.floor(column / 2) % 2 === 0;
      return shoulder || centerDash ? 'accent' : outerGuide || crosswalk ? 'secondary' : 'base';
    }
    case 'telemetry-grid': {
      const traceRow = Math.round(
        centerRow +
          Math.sin(normalizedX * Math.PI * (2 + (variant % 5))) *
            Math.max(1, rows * (0.12 + (variant % 3) * 0.03))
      );
      const secondTrace = Math.round(
        centerRow + Math.cos(normalizedX * Math.PI * (1 + (variant % 4))) * Math.max(1, rows * 0.22)
      );
      const timingLine = (column + variant) % Math.max(3, 4 + (variant % 4)) === 0;
      const shiftLight =
        row <= Math.max(0, Math.floor(rows * 0.12)) &&
        column >= Math.floor(columns * 0.2) &&
        column <= Math.ceil(columns * 0.8) &&
        (column + variant) % 2 === 0;
      if (row === traceRow || shiftLight) return 'accent';
      return row === secondTrace || (timingLine && row > Math.floor(rows * 0.7))
        ? 'secondary'
        : 'base';
    }
  }
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

/**
 * Five rear-edge cells encode the preset number in base three. The subtle timing-board signature
 * prevents parametric variants from collapsing into identical picker thumbnails or garage grids.
 */
function getTelemetrySignatureRole(
  patternIndex: number,
  grid: ConceptualGrid,
  column: number,
  row: number
): RoughDesignRole | undefined {
  if (grid.columns < 5 || grid.rows < 2 || row !== grid.rows - 1 || column >= 5) return undefined;

  const digit = Math.floor(patternIndex / 3 ** column) % 3;
  return ROUGH_DESIGN_ROLES_BY_DIGIT[digit];
}

const ROUGH_DESIGN_ROLES_BY_DIGIT = ['base', 'accent', 'secondary'] as const;
