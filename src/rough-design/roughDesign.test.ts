import { describe, expect, it } from 'vitest';
import type { CatalogProduct, ProductColor } from '../domain/catalog';
import {
  DEFAULT_ROUGH_GARAGE_DIMENSIONS,
  DEFAULT_PERIMETER_EXPANSION_CLEARANCE,
  assertRoughDesignState,
  assertRoughGarageDimensions,
  assertPerimeterExpansionClearance,
  buildRoughPreviewGeometry,
  createRoughDesignState,
  createRoughPatternThumbnail,
  filterRoughPatternPresets,
  generateRoughDesignPreview,
  getFrontRightEdgeFit,
  getConceptualGrid,
  getTileFieldRectangle,
  mapRoughColorsToProduct,
  mapRoughDesignToProduct,
  migrateRoughDesignType,
  paintRoughDesignCell,
  ROUGH_DESIGN_ROLES,
  ROUGH_PATTERN_PRESETS,
  type ConceptualGrid,
  type LegacyRoughDesignType,
  type RoughDesignType,
  type RoughDesignRole,
  type RoughPresetDesignType,
} from './index';

const grid: ConceptualGrid = { columns: 4, rows: 4 };

const ORIGINAL_PRESET_IDS = [
  'perimeter-frame',
  'inset-frame',
  'broken-frame',
  'corner-bracket-frame',
  'threshold-bands',
  'side-rails',
  'stepped-frame',
  'twin-bay-pads',
  'bay-outline-pads',
  'drip-apron',
  'wheel-tracks',
  'bay-divider-rails',
  'bay-head-blocks',
  'walk-aisle',
  'twin-racing-stripes',
  'offset-racing-stripes',
  'transverse-bands',
  'ribbon-wrap',
  'edge-pinstripes',
  'horizontal-bands',
  'vertical-bands',
  'checker-grid',
  'jumbo-checker',
  'checker-core',
  'checker-apron',
  'windowpane-grid',
  'tartan-grid',
  'diagonal-checker',
  'single-sweep',
  'chevron-split',
  'arrow-nose',
  'zigzag-runner',
  'corner-wedge',
  'gate-wedges',
  'quad-corner-squares',
  'door-corner-kickers',
  'notched-frame',
  'l-bracket-accents',
  'corner-stairs',
  'solid-field',
  'center-pad',
  'framed-center-pad',
  'diamond-medallion',
  'ring-medallion',
  'cross-medallion',
  'start-finish-band',
  'podium-steps',
  'pit-box',
  'apex-curve',
  'speed-fade',
] as const;

const colors: readonly ProductColor[] = [
  {
    id: 'black',
    productId: 'product',
    name: 'Jet Black',
    swatchHex: '#000000',
  },
  {
    id: 'red',
    productId: 'product',
    name: 'Racing Red',
    swatchHex: '#ff0000',
  },
  {
    id: 'silver',
    productId: 'product',
    name: 'Silver',
    swatchHex: '#c0c0c0',
  },
];

function product(id: string, size: number): CatalogProduct {
  return {
    id,
    manufacturerId: 'example',
    name: id,
    dimensions: { widthInches: size, lengthInches: size, thicknessInches: 0.5 },
    rotationRule: 'fixed',
  };
}

function rolesFor(type: RoughDesignType | LegacyRoughDesignType): RoughDesignRole[] {
  return generateRoughDesignPreview(createRoughDesignState({ type }), grid).cells.map(
    (cell) => cell.role
  );
}

describe('rough design state and conceptual preview', () => {
  it('publishes two hundred fifty searchable presets with compact deterministic thumbnails', () => {
    expect(ROUGH_PATTERN_PRESETS).toHaveLength(250);
    expect(new Set(ROUGH_PATTERN_PRESETS.map((preset) => preset.id)).size).toBe(250);
    expect(new Set(ROUGH_PATTERN_PRESETS.map((preset) => preset.name)).size).toBe(250);
    expect(new Set(ROUGH_PATTERN_PRESETS.map((preset) => preset.category))).toEqual(
      new Set([
        'frames',
        'parking-bays',
        'stripes-bands',
        'checkers-grids',
        'diagonals-chevrons',
        'corners-accents',
        'center-fields',
        'racing-showroom',
      ])
    );
    const roleMismatches: string[] = [];
    for (const preset of ROUGH_PATTERN_PRESETS) {
      expect(preset.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(preset.name).not.toHaveLength(0);
      expect(preset.description).not.toHaveLength(0);
      expect(preset.searchTerms.length).toBeGreaterThan(0);
      expect(preset.roles.length).toBeGreaterThan(0);
      expect(preset.roles.every((role) => ROUGH_DESIGN_ROLES.includes(role))).toBe(true);
      const thumbnail = createRoughPatternThumbnail(preset.id);
      expect(thumbnail).toEqual(createRoughPatternThumbnail(preset.id));
      const thumbnailRoles = [...new Set(thumbnail)].sort();
      const declaredRoles = [...preset.roles].sort();
      if (thumbnailRoles.join(',') !== declaredRoles.join(',')) {
        roleMismatches.push(`${preset.id}: ${thumbnailRoles.join(',')}`);
      }
    }
    expect(roleMismatches).toEqual([]);
    expect(ORIGINAL_PRESET_IDS).toHaveLength(50);
    for (const originalId of ORIGINAL_PRESET_IDS) {
      expect(migrateRoughDesignType(originalId)).toBe(originalId);
    }
    expect(filterRoughPatternPresets('checker').map((preset) => preset.id)).toContain(
      'checker-grid'
    );
    expect(filterRoughPatternPresets('triple border').map((preset) => preset.id)).toContain(
      'triple-border'
    );
    const borderCheckerPresets = ROUGH_PATTERN_PRESETS.filter((preset) =>
      /^(?:single-ring|layered-ring|checker-scale|checker-border|framed-checker)-/.test(preset.id)
    );
    expect(borderCheckerPresets).toHaveLength(50);
    expect(borderCheckerPresets.filter((preset) => preset.category === 'frames')).toHaveLength(20);
    expect(
      borderCheckerPresets.filter((preset) => preset.category === 'checkers-grids')
    ).toHaveLength(30);
    const borderCheckerSignatures = borderCheckerPresets.map((preset) =>
      [
        { columns: 8, rows: 5 },
        { columns: 13, rows: 9 },
      ]
        .map((grid) =>
          generateRoughDesignPreview(createRoughDesignState({ type: preset.id }), grid)
            .cells.map((cell) => cell.role)
            .join('')
        )
        .join('|')
    );
    const duplicateBorderCheckerPresets = borderCheckerPresets
      .map((preset, index) => ({
        id: preset.id,
        matches: borderCheckerPresets
          .filter(
            (_, candidateIndex) =>
              borderCheckerSignatures[candidateIndex] === borderCheckerSignatures[index]
          )
          .map((candidate) => candidate.id),
      }))
      .filter(({ id, matches }) => matches[0] !== id);
    expect(duplicateBorderCheckerPresets).toEqual([]);
    const establishedPresets = ROUGH_PATTERN_PRESETS.filter(
      (preset) =>
        !/^(?:single-ring|layered-ring|checker-scale|checker-border|framed-checker)-/.test(
          preset.id
        )
    );
    const establishedSignatures = new Map(
      establishedPresets.map((preset) => [
        [
          { columns: 8, rows: 5 },
          { columns: 13, rows: 9 },
        ]
          .map((grid) =>
            generateRoughDesignPreview(createRoughDesignState({ type: preset.id }), grid)
              .cells.map((cell) => cell.role)
              .join('')
          )
          .join('|'),
        preset.id,
      ])
    );
    expect(
      borderCheckerPresets
        .map((preset, index) => ({
          id: preset.id,
          matches: establishedSignatures.get(borderCheckerSignatures[index]),
        }))
        .filter(({ matches }) => matches !== undefined)
    ).toEqual([]);
    expect(filterRoughPatternPresets('', 'frames')).toHaveLength(44);
    expect(filterRoughPatternPresets('', 'parking-bays')).toHaveLength(34);
    expect(filterRoughPatternPresets('', 'stripes-bands')).toHaveLength(24);
    expect(filterRoughPatternPresets('', 'checkers-grids')).toHaveLength(54);
    expect(filterRoughPatternPresets('', 'diagonals-chevrons')).toHaveLength(22);
    expect(filterRoughPatternPresets('', 'corners-accents')).toHaveLength(20);
    expect(filterRoughPatternPresets('', 'center-fields')).toHaveLength(22);
    expect(filterRoughPatternPresets('', 'racing-showroom')).toHaveLength(30);
    expect(migrateRoughDesignType('checkerboard')).toBe('checker-grid');
    expect(migrateRoughDesignType('interlocking-nd-block')).toBe('turbine-medallion-5');
    expect(migrateRoughDesignType('interlocking-nd-outline')).toBe('circuit-frame-2');
    expect(migrateRoughDesignType('interlocking-nd-medallion')).toBe('turbine-medallion-7');
    expect(migrateRoughDesignType('interlocking-nd-twin-bays')).toBe('pit-bay-2');
    expect(migrateRoughDesignType('woven-nd-slab')).toBe('turbine-medallion-5');
    expect(migrateRoughDesignType('nd-door-pair')).toBe('pit-bay-2');
    expect(
      ROUGH_PATTERN_PRESETS.some((preset) =>
        `${preset.id} ${preset.name} ${preset.searchTerms.join(' ')}`.match(
          /\b(?:nd|notre|dame|monogram|collegiate)\b/i
        )
      )
    ).toBe(false);
    expect(
      ROUGH_PATTERN_PRESETS.some((preset) =>
        `${preset.name} ${preset.searchTerms.join(' ')}`.match(
          /\b(?:monaco|le mans|silverstone|daytona|spa|laguna|suzuka|road america|sebring|nurburgring|mach one|grand prix|route 66|autobahn)\b/i
        )
      )
    ).toBe(false);
    expect(migrateRoughDesignType('toString')).toBeNull();
  });

  it('insets the tile field from outer walls with the front on the top width edge', () => {
    const tileField = getTileFieldRectangle(DEFAULT_ROUGH_GARAGE_DIMENSIONS);
    const geometry = buildRoughPreviewGeometry(createRoughDesignState());

    expect(tileField).toMatchObject({
      xInches: 1,
      yInches: 1,
      widthInches: 228,
      lengthInches: 244,
    });
    expect(geometry.tileField).toEqual(tileField);
    expect(geometry.outerGarage).toEqual({ widthInches: 230, lengthInches: 246 });
  });

  it('accepts custom clearance and rejects clearance that consumes the tile field', () => {
    const clearance = { leftInches: 2, rightInches: 3, frontInches: 4, backInches: 5 };
    expect(getTileFieldRectangle(DEFAULT_ROUGH_GARAGE_DIMENSIONS, clearance)).toMatchObject({
      xInches: 2,
      yInches: 4,
      widthInches: 225,
      lengthInches: 237,
    });
    expect(() =>
      assertPerimeterExpansionClearance(
        { leftInches: 230, rightInches: 0, frontInches: 1, backInches: 1 },
        DEFAULT_ROUGH_GARAGE_DIMENSIONS
      )
    ).toThrow(RangeError);
    expect(() =>
      createRoughDesignState({
        expansionClearance: { leftInches: -1, rightInches: 0, frontInches: 0, backInches: 0 },
      })
    ).toThrow(RangeError);
  });

  it('generates every preset deterministically on small, odd, even, wide, and tall grids', () => {
    const grids: readonly ConceptualGrid[] = [
      { columns: 1, rows: 1 },
      { columns: 2, rows: 3 },
      { columns: 3, rows: 5 },
      { columns: 4, rows: 4 },
      { columns: 17, rows: 7 },
      { columns: 7, rows: 17 },
    ];
    for (const preset of ROUGH_PATTERN_PRESETS) {
      const state = createRoughDesignState({ type: preset.id });
      for (const candidateGrid of grids) {
        const preview = generateRoughDesignPreview(state, candidateGrid);
        expect(preview.cells).toHaveLength(candidateGrid.columns * candidateGrid.rows);
        expect(
          preview.cells.every((cell) => cell.column >= 0 && cell.column < candidateGrid.columns)
        ).toBe(true);
        expect(preview.cells.every((cell) => cell.row >= 0 && cell.row < candidateGrid.rows)).toBe(
          true
        );
        expect(preview.cells.every((cell) => ROUGH_DESIGN_ROLES.includes(cell.role))).toBe(true);
        expect(generateRoughDesignPreview(state, candidateGrid)).toEqual(preview);
      }
      const mapped = mapRoughDesignToProduct(state, product(`product-${preset.id}`, 12));
      expect(mapped.cells).toHaveLength(mapped.grid.columns * mapped.grid.rows);
      expect(
        mapped.cells.every((cell) => cell.column >= 0 && cell.column < mapped.grid.columns)
      ).toBe(true);
      expect(mapped.cells.every((cell) => cell.row >= 0 && cell.row < mapped.grid.rows)).toBe(true);
    }
  });

  it('keeps representative geometry recognizable in every original and new pattern family', () => {
    const roleAt = (id: RoughDesignType, column: number, row: number): RoughDesignRole =>
      generateRoughDesignPreview(createRoughDesignState({ type: id }), { columns: 9, rows: 9 })
        .cells[row * 9 + column].role;

    expect(roleAt('perimeter-frame', 0, 4)).toBe('accent');
    expect(roleAt('corner-bracket-frame', 4, 0)).toBe('base');
    expect(roleAt('twin-bay-pads', 1, 4)).toBe('accent');
    expect(roleAt('walk-aisle', 4, 4)).toBe('accent');
    expect(roleAt('twin-racing-stripes', 3, 4)).toBe('accent');
    expect(roleAt('checker-grid', 0, 0)).not.toBe(roleAt('checker-grid', 1, 0));
    expect(roleAt('single-sweep', 4, 4)).toBe('accent');
    expect(roleAt('chevron-split', 4, 8)).toBe('accent');
    expect(roleAt('quad-corner-squares', 0, 0)).toBe('accent');
    expect(roleAt('diamond-medallion', 4, 4)).toBe('accent');
    expect(roleAt('start-finish-band', 1, 0)).toBe('accent');
    expect(roleAt('podium-steps', 1, 8)).toBe('accent');
    expect(roleAt('podium-steps', 1, 4)).toBe('base');

    expect(roleAt('triple-border', 0, 4)).toBe('secondary');
    expect(roleAt('triple-border', 1, 4)).toBe('accent');
    expect(roleAt('runway-lanes', 3, 4)).toBe('secondary');
    expect(roleAt('triple-stripe', 4, 4)).toBe('secondary');
    expect(roleAt('split-checker-field', 3, 0)).toBe('accent');
    expect(roleAt('split-checker-field', 5, 0)).toBe('secondary');
    expect(roleAt('nested-chevrons', 4, 0)).toBe('accent');
    expect(roleAt('nested-chevrons', 4, 1)).toBe('secondary');
    expect(roleAt('opposing-corners', 0, 0)).toBe('accent');
    expect(roleAt('opposing-corners', 8, 8)).toBe('secondary');
    expect(roleAt('nested-diamonds', 4, 4)).toBe('accent');
    expect(roleAt('nested-diamonds', 5, 4)).toBe('secondary');
    expect(roleAt('finish-lane', 3, 0)).toBe('secondary');
    expect(roleAt('finish-lane', 4, 0)).toBe('accent');

    const automotiveRepresentatives = [
      'circuit-frame-1',
      'pit-bay-2',
      'velocity-stripe-3',
      'flag-wave-4',
      'apex-chevron-5',
      'corner-aero-6',
      'turbine-medallion-7',
      'endurance-track-8',
      'boulevard-lane-9',
      'telemetry-grid-10',
    ] as const;
    for (const presetId of automotiveRepresentatives) {
      const roles = createRoughPatternThumbnail(presetId, { columns: 15, rows: 24 });
      expect(roles, presetId).toContain('accent');
      expect(roles, presetId).toContain('secondary');
    }
    const automotivePresets = ROUGH_PATTERN_PRESETS.filter((preset) =>
      /^(?:circuit-frame|pit-bay|velocity-stripe|flag-wave|apex-chevron|corner-aero|turbine-medallion|endurance-track|boulevard-lane|telemetry-grid)-/.test(
        preset.id
      )
    );
    expect(automotivePresets).toHaveLength(100);
    const supportedGrids = [
      { columns: 8, rows: 5 },
      ...Array.from({ length: 17 }, (_, index) => index + 8).flatMap((shortAxis) => [
        { columns: shortAxis, rows: 24 },
        { columns: 24, rows: shortAxis },
      ]),
    ];
    for (const grid of supportedGrids) {
      const designsByThumbnail = new Map<string, string[]>();
      for (const preset of automotivePresets) {
        const thumbnail = createRoughPatternThumbnail(preset.id, grid).join(',');
        designsByThumbnail.set(thumbnail, [
          ...(designsByThumbnail.get(thumbnail) ?? []),
          preset.id,
        ]);
      }
      expect(
        [...designsByThumbnail.values()].filter((ids) => ids.length > 1),
        `${grid.columns}x${grid.rows}`
      ).toEqual([]);
    }
  });

  it('uses practical default dimensions and rejects impractical values', () => {
    expect(DEFAULT_ROUGH_GARAGE_DIMENSIONS).toEqual({ widthInches: 230, lengthInches: 246 });
    expect(DEFAULT_PERIMETER_EXPANSION_CLEARANCE).toEqual({
      leftInches: 1,
      rightInches: 1,
      frontInches: 1,
      backInches: 1,
    });
    expect(() => assertRoughGarageDimensions({ widthInches: 47, lengthInches: 246 })).toThrow(
      RangeError
    );
    expect(() => assertRoughGarageDimensions({ widthInches: 230.01, lengthInches: 246 })).toThrow(
      RangeError
    );
    expect(() => assertRoughGarageDimensions({ widthInches: 230, lengthInches: 1_001 })).toThrow(
      RangeError
    );
  });

  it('generates every brand-neutral pattern deterministically', () => {
    expect(rolesFor('solid')).toEqual(Array<RoughDesignRole>(16).fill('base'));
    expect(rolesFor('checkerboard')).toEqual([
      'base',
      'accent',
      'base',
      'accent',
      'accent',
      'base',
      'accent',
      'base',
      'base',
      'accent',
      'base',
      'accent',
      'accent',
      'base',
      'accent',
      'base',
    ]);
    expect(rolesFor('horizontal-stripes')).toEqual([
      'base',
      'base',
      'base',
      'base',
      'accent',
      'accent',
      'accent',
      'accent',
      'base',
      'base',
      'base',
      'base',
      'accent',
      'accent',
      'accent',
      'accent',
    ]);
    expect(rolesFor('vertical-stripes')).toEqual([
      'base',
      'accent',
      'base',
      'accent',
      'base',
      'accent',
      'base',
      'accent',
      'base',
      'accent',
      'base',
      'accent',
      'base',
      'accent',
      'base',
      'accent',
    ]);
    expect(rolesFor('border')).toEqual([
      'accent',
      'accent',
      'accent',
      'accent',
      'accent',
      'base',
      'base',
      'accent',
      'accent',
      'base',
      'base',
      'accent',
      'accent',
      'accent',
      'accent',
      'accent',
    ]);
    expect(rolesFor('custom')).toEqual(Array<RoughDesignRole>(16).fill('base'));
  });

  it('preserves custom-painted roles without coupling them to tile cells', () => {
    const painted = paintRoughDesignCell(createRoughDesignState(), grid, 2, 1, 'secondary');
    const preview = generateRoughDesignPreview(painted, grid);

    expect(painted).toMatchObject({
      version: 3,
      type: 'custom',
      customCells: { '2-1': 'secondary' },
    });
    expect(preview.cells.find((cell) => cell.id === '2-1')).toMatchObject({
      role: 'secondary',
      displayColor: painted.colors.secondary,
    });
  });

  it('preserves a preset pattern underneath a custom paint override', () => {
    const painted = paintRoughDesignCell(
      createRoughDesignState({ type: 'checkerboard' }),
      grid,
      2,
      1,
      'secondary'
    );
    const preview = generateRoughDesignPreview(painted, grid);

    expect(painted).toMatchObject({
      type: 'custom',
      customBaseType: 'checker-grid',
      customGrid: grid,
      customCells: { '2-1': 'secondary' },
    });
    expect(preview.cells.map((cell) => cell.role)).toEqual([
      'base',
      'accent',
      'base',
      'accent',
      'accent',
      'base',
      'secondary',
      'base',
      'base',
      'accent',
      'base',
      'accent',
      'accent',
      'base',
      'accent',
      'base',
    ]);
  });

  it('keeps a moderate, proportional conceptual grid for odd and even aspect ratios', () => {
    expect(getConceptualGrid({ widthInches: 230, lengthInches: 246 })).toEqual({
      columns: 22,
      rows: 24,
    });
    expect(getConceptualGrid({ widthInches: 200, lengthInches: 230 })).toEqual({
      columns: 21,
      rows: 24,
    });
  });

  it('rejects invalid serialized custom bases and out-of-grid custom cells', () => {
    const custom = createRoughDesignState({ type: 'custom' });

    expect(() =>
      assertRoughDesignState({
        ...custom,
        customBaseType: 'custom' as unknown as RoughPresetDesignType,
      })
    ).toThrow(RangeError);
    expect(() =>
      createRoughDesignState({
        type: 'custom',
        customCells: { '22-0': 'accent' },
      })
    ).toThrow(RangeError);
  });
});

describe('rough design product mapping and edge fits', () => {
  it('maps a checkerboard recognizably to 12, 15.75, and 20.2 inch products', () => {
    const state = createRoughDesignState({ type: 'checkerboard' });
    const mappings = [
      mapRoughDesignToProduct(state, product('twelve', 12)),
      mapRoughDesignToProduct(state, product('fifteen', 15.75)),
      mapRoughDesignToProduct(state, product('twenty', 20.2)),
    ];

    expect(mappings.map((mapping) => mapping.grid)).toEqual([
      { columns: 19, rows: 21 },
      { columns: 15, rows: 16 },
      { columns: 12, rows: 13 },
    ]);
    for (const mapping of mappings) {
      expect(mapping.roleCounts.base).toBeGreaterThan(0);
      expect(mapping.roleCounts.accent).toBeGreaterThan(0);
      expect(mapping.cells.some((cell) => cell.isCut)).toBe(true);
      expect(
        mapping.cells
          .filter((cell) => !cell.isCut)
          .every(
            (cell) =>
              cell.role ===
              ((cell.column -
                (mapping.edgeFit.leftGapInches > 0 ? 1 : 0) +
                cell.row -
                (mapping.edgeFit.topGapInches > 0 ? 1 : 0)) %
                2 ===
              0
                ? 'base'
                : 'accent')
          )
      ).toBe(true);
    }
  });

  it('keeps a custom paint visible when mapping to a coarser product grid', () => {
    const state = paintRoughDesignCell(
      createRoughDesignState({ type: 'checkerboard' }),
      { columns: 22, rows: 24 },
      1,
      0,
      'secondary'
    );
    const mapped = mapRoughDesignToProduct(state, product('twenty', 20.2));

    expect(mapped.cells.some((cell) => cell.role === 'secondary')).toBe(true);
    expect(mapped.cells.filter((cell) => !cell.isCut && cell.role === 'accent')).not.toHaveLength(
      0
    );
  });

  it('keeps a border on full perimeter tiles instead of restricting it to edge cuts', () => {
    const mapped = mapRoughDesignToProduct(
      createRoughDesignState({ type: 'border' }),
      product('twelve', 12)
    );

    expect(mapped.cells.some((cell) => cell.role === 'accent' && !cell.isCut)).toBe(true);
  });

  it('keeps full tiles at the front and right, moving cut strips to the back and left', () => {
    expect(getFrontRightEdgeFit(DEFAULT_ROUGH_GARAGE_DIMENSIONS, product('twelve', 12))).toEqual({
      placementPolicy: 'front-right-anchored',
      leftGapInches: 2,
      rightGapInches: 0,
      topGapInches: 0,
      bottomGapInches: 6,
      cutsRequired: true,
      cutStrategy: 'back-left-edge-cuts',
    });
  });

  it('reports no cuts and no gaps for an exact fit', () => {
    const state = createRoughDesignState({ garage: { widthInches: 242, lengthInches: 242 } });
    const mapped = mapRoughDesignToProduct(state, product('exact', 12));

    expect(mapped.edgeFit).toEqual({
      placementPolicy: 'front-right-anchored',
      leftGapInches: 0,
      rightGapInches: 0,
      topGapInches: 0,
      bottomGapInches: 0,
      cutsRequired: false,
      cutStrategy: 'no-cuts',
    });
    expect(mapped.cells.some((cell) => cell.isCut)).toBe(false);
  });
});

describe('rough display color mapping', () => {
  it('reports exact matches, substitutions, unavailable roles, and unused roles explicitly', () => {
    const checkerboard = createRoughDesignState({
      type: 'checkerboard',
      colors: {
        base: { hex: '#000000', label: 'Black' },
        accent: { hex: '#e80010', label: 'Red' },
      },
    });
    const mappings = mapRoughColorsToProduct(checkerboard, colors);

    expect(mappings).toEqual([
      expect.objectContaining({ role: 'base', status: 'matched', color: colors[0] }),
      expect.objectContaining({ role: 'accent', status: 'substituted', color: colors[1] }),
      expect.objectContaining({ role: 'secondary', status: 'not-used' }),
    ]);

    const unavailable = mapRoughColorsToProduct(
      createRoughDesignState({
        colors: { base: { hex: '#ff00ff', label: 'Magenta' } },
      }),
      colors
    );
    expect(unavailable[0]).toMatchObject({ role: 'base', status: 'unavailable' });
  });
});
