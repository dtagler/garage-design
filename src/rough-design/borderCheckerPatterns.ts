import type { ConceptualGrid, RoughDesignRole, RoughPatternCategory } from './roughDesign';

const VARIANTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

type Variant = (typeof VARIANTS)[number];

export type BorderCheckerPatternFamily =
  'single-ring' | 'layered-ring' | 'checker-scale' | 'checker-border' | 'framed-checker';

export type BorderCheckerPatternId = `${BorderCheckerPatternFamily}-${Variant}`;

export interface BorderCheckerPatternPreset {
  readonly id: BorderCheckerPatternId;
  readonly name: string;
  readonly category: RoughPatternCategory;
  readonly description: string;
  readonly roles: readonly RoughDesignRole[];
  readonly searchTerms: readonly string[];
}

interface FamilyDefinition {
  readonly id: BorderCheckerPatternFamily;
  readonly category: 'frames' | 'checkers-grids';
  readonly description: string;
  readonly roles: readonly RoughDesignRole[];
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

const FAMILIES: readonly FamilyDefinition[] = [
  {
    id: 'single-ring',
    category: 'frames',
    description: 'A single clean border changes its openings, inset, corners, and rhythm.',
    roles: ['base', 'accent'],
    searchTerms: ['single border', 'border', 'frame', 'perimeter', 'popular'],
    names: [
      'Classic Single Border',
      'Open-Door Border',
      'Corner-Notch Border',
      'Rear U Border',
      'Front U Border',
      'Dash-Line Border',
      'Wide Single Border',
      'Twin-Gate Border',
      'Corner-Block Border',
      'Inset Single Border',
    ],
  },
  {
    id: 'layered-ring',
    category: 'frames',
    description: 'Two contrasting border layers create double, offset, gated, and nested frames.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['double border', 'triple border', 'layered frame', 'nested border', 'popular'],
    names: [
      'Classic Double Border',
      'Alternating Double Border',
      'Open Double Border',
      'Side-Rail Double Frame',
      'Segmented Double Ring',
      'Inset Double Border',
      'Corner-Lock Double Frame',
      'Threshold Double Frame',
      'Wide-Gap Double Border',
      'Grand Entrance Frame',
    ],
  },
  {
    id: 'checker-scale',
    category: 'checkers-grids',
    description: 'Classic checkerboards vary block scale, offset, direction, and cadence.',
    roles: ['base', 'accent'],
    searchTerms: ['checkerboard', 'checker', 'grid', 'classic', 'popular'],
    names: [
      'Classic Small Checker',
      'Two-Tile Checker',
      'Three-Tile Checker',
      'Offset Checker',
      'Staggered Checker',
      'Tall Checker Blocks',
      'Wide Checker Blocks',
      'Diagonal Step Checker',
      'Quarter-Turn Checker',
      'Showroom Checker Field',
    ],
  },
  {
    id: 'checker-border',
    category: 'checkers-grids',
    description: 'Checker fields meet solid borders, entry aprons, and framed center zones.',
    roles: ['base', 'accent'],
    searchTerms: ['checker border', 'checkerboard', 'border', 'frame', 'popular'],
    names: [
      'Checker with Single Border',
      'Checker with Wide Border',
      'Checker Entry Gate',
      'Checker Rear Frame',
      'Checker Side Rails',
      'Checker Center Carpet',
      'Checker Corner Frame',
      'Checker Threshold Band',
      'Checker Display Island',
      'Checker Perimeter Pulse',
    ],
  },
  {
    id: 'framed-checker',
    category: 'checkers-grids',
    description: 'Three-color layouts combine a checker field with a contrasting outer frame.',
    roles: ['base', 'accent', 'secondary'],
    searchTerms: ['framed checker', 'three color checker', 'double border checker', 'popular'],
    names: [
      'Three-Color Framed Checker',
      'Double-Line Checker Frame',
      'Open-Front Checker Frame',
      'Inset Checker Gallery',
      'Checker Frame with Corners',
      'Alternating Frame Checker',
      'Checker Pit-Lane Frame',
      'Checker Showroom Mat',
      'Checker Halo Frame',
      'Grand Checker Border',
    ],
  },
] as const;

export const BORDER_CHECKER_PATTERN_PRESETS: readonly BorderCheckerPatternPreset[] =
  FAMILIES.flatMap((family) =>
    VARIANTS.map((variant, index) => ({
      id: `${family.id}-${variant}`,
      name: family.names[index],
      category: family.category,
      description: family.description,
      roles: family.roles,
      searchTerms: [...family.searchTerms, family.names[index].toLowerCase()],
    }))
  );

export function getBorderCheckerPatternRole(
  type: string,
  grid: ConceptualGrid,
  column: number,
  row: number
): RoughDesignRole | undefined {
  const match =
    /^(single-ring|layered-ring|checker-scale|checker-border|framed-checker)-([1-9]|10)$/.exec(
      type
    );
  if (match === null) return undefined;

  const family = match[1] as BorderCheckerPatternFamily;
  const variant = Number(match[2]);
  const { columns, rows } = grid;
  const lastColumn = columns - 1;
  const lastRow = rows - 1;
  const edgeDistance = Math.min(column, row, lastColumn - column, lastRow - row);
  const centerColumn = lastColumn / 2;
  const checker = (column + row) % 2 === 0;
  const block = (width: number, height = width, shift = 0): boolean =>
    (Math.floor((column + shift) / width) + Math.floor(row / height)) % 2 === 0;
  const frontGate = Math.abs(column - centerColumn) <= Math.max(0.5, variant % 3);

  switch (family) {
    case 'single-ring':
      switch (variant) {
        case 1:
          return edgeDistance === 0 || (row === 1 && frontGate) ? 'accent' : 'base';
        case 2:
          return edgeDistance === 0 && !(row === 0 && frontGate) ? 'accent' : 'base';
        case 3:
          return edgeDistance === 0 &&
            !isNearCorner(
              column,
              row,
              lastColumn,
              lastRow,
              Math.max(1, Math.floor(Math.min(columns, rows) / 4))
            )
            ? 'accent'
            : 'base';
        case 4:
          return (column === 0 || column === lastColumn || row === lastRow) && row > 0
            ? 'accent'
            : 'base';
        case 5:
          return (column === 0 || column === lastColumn || row === 0) && row < lastRow
            ? 'accent'
            : 'base';
        case 6:
          return edgeDistance === 0 && (column + row) % 2 === 0 ? 'accent' : 'base';
        case 7:
          return edgeDistance <= 1 ? 'accent' : 'base';
        case 8:
          return edgeDistance === 0 && !((row === 0 || row === lastRow) && frontGate)
            ? 'accent'
            : 'base';
        case 9:
          return edgeDistance === 0 &&
            (isCorner(column, row, lastColumn, lastRow) || (column + row) % 3 !== 0)
            ? 'accent'
            : 'base';
        default:
          return edgeDistance === 1 && !(row === 1 && frontGate) ? 'accent' : 'base';
      }

    case 'layered-ring': {
      const outer = edgeDistance === 0;
      const inner = edgeDistance === 1;
      switch (variant) {
        case 1:
          return outer ? 'accent' : inner ? 'secondary' : 'base';
        case 2:
          return outer ? 'secondary' : inner ? 'accent' : 'base';
        case 3:
          return outer && !(row === 0 && frontGate)
            ? 'accent'
            : inner && !(row <= 1 && frontGate)
              ? 'secondary'
              : 'base';
        case 4:
          return (column === 0 || column === lastColumn) && outer
            ? 'accent'
            : (column === 1 || column === lastColumn - 1) && inner
              ? 'secondary'
              : 'base';
        case 5:
          return outer && (column + row) % 2 === 0
            ? 'accent'
            : inner && (column + row) % 2 !== 0
              ? 'secondary'
              : 'base';
        case 6:
          return edgeDistance === 1 ? 'accent' : edgeDistance === 2 ? 'secondary' : 'base';
        case 7:
          return outer
            ? 'accent'
            : inner && isNearCorner(column, row, lastColumn, lastRow, 2)
              ? 'secondary'
              : 'base';
        case 8:
          return row === 0 || row === lastRow
            ? 'accent'
            : row === 1 || row === lastRow - 1
              ? 'secondary'
              : 'base';
        case 9:
          return outer ? 'secondary' : edgeDistance === 2 ? 'accent' : 'base';
        default:
          return outer && !(row === 0 && frontGate) ? 'secondary' : inner ? 'accent' : 'base';
      }
    }

    case 'checker-scale':
      switch (variant) {
        case 1:
          return checker ? 'accent' : 'base';
        case 2:
          return block(2) ? 'accent' : 'base';
        case 3:
          return block(3) ? 'accent' : 'base';
        case 4:
          return block(2, 2, row % 2) ? 'accent' : 'base';
        case 5:
          return block(2, 1, Math.floor(row / 2)) ? 'accent' : 'base';
        case 6:
          return block(2, 3) ? 'accent' : 'base';
        case 7:
          return block(3, 2) ? 'accent' : 'base';
        case 8:
          return (Math.floor((column + row) / 2) + row) % 2 === 0 ? 'accent' : 'base';
        case 9:
          return block(2, 2, Math.floor(row / 2) % 2) ? 'accent' : 'base';
        default:
          return (Math.floor((column + Math.floor(row / 2)) / 2) + Math.floor(row / 2)) % 2 === 0
            ? 'accent'
            : 'base';
      }

    case 'checker-border': {
      const borderWidth = variant === 2 || variant === 6 || variant === 9 ? 2 : 1;
      const inBorder = edgeDistance < borderWidth;
      if (variant === 3 && row === 0 && frontGate) return 'base';
      if (variant === 4 && row === 0) return 'base';
      if (variant === 5) {
        return column === 0 || column === lastColumn || checker ? 'accent' : 'base';
      }
      if (variant === 6) {
        const inCenter =
          column >= Math.floor(columns / 4) &&
          column < Math.ceil((columns * 3) / 4) &&
          row >= Math.floor(rows / 4) &&
          row < Math.ceil((rows * 3) / 4);
        return inBorder || (inCenter && checker) ? 'accent' : 'base';
      }
      if (variant === 7 && inBorder && !isNearCorner(column, row, lastColumn, lastRow, 2)) {
        return 'base';
      }
      if (variant === 8 && row === 0) return checker ? 'accent' : 'base';
      if (variant === 9) {
        const inIsland =
          column >= Math.floor(columns / 3) &&
          column < Math.ceil((columns * 2) / 3) &&
          row >= Math.floor(rows / 3) &&
          row < Math.ceil((rows * 2) / 3);
        return inBorder || (inIsland && block(2)) ? 'accent' : 'base';
      }
      if (variant === 10 && inBorder) {
        return (column + row) % 3 === 0 ? 'base' : 'accent';
      }
      return inBorder || block(variant % 3 === 0 ? 2 : 1) ? 'accent' : 'base';
    }

    case 'framed-checker': {
      const outer = edgeDistance === 0;
      const inner = edgeDistance === 1;
      if (variant === 2 && inner) return 'secondary';
      if (variant === 3 && row === 0 && frontGate) return checker ? 'accent' : 'base';
      if (variant === 4) {
        if (outer) return 'base';
        if (inner) return 'secondary';
      }
      if (variant === 5 && outer && isNearCorner(column, row, lastColumn, lastRow, 2)) {
        return 'accent';
      }
      if (variant === 6 && outer) return (column + row) % 2 === 0 ? 'secondary' : 'accent';
      if (variant === 7 && row === 0) return column % 3 === 0 ? 'accent' : 'secondary';
      if (variant === 8) {
        if (outer) return 'accent';
        if (inner) return 'secondary';
      }
      if (variant === 9 && edgeDistance === 1) return 'accent';
      if (variant === 10 && outer) return frontGate && row === 0 ? 'accent' : 'secondary';
      if (outer) return 'secondary';
      return block(variant % 3 === 0 ? 2 : 1) ? 'accent' : 'base';
    }
  }
}

function isCorner(column: number, row: number, lastColumn: number, lastRow: number): boolean {
  return (column === 0 || column === lastColumn) && (row === 0 || row === lastRow);
}

function isNearCorner(
  column: number,
  row: number,
  lastColumn: number,
  lastRow: number,
  size: number
): boolean {
  return (column < size || column > lastColumn - size) && (row < size || row > lastRow - size);
}
