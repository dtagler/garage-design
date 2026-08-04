import { useMemo } from 'react';
import {
  createRoughPatternThumbnail,
  filterRoughPatternPresets,
  ROUGH_DESIGN_ROLES,
  ROUGH_PATTERN_PRESETS,
  type RoughDesignColors,
  type RoughDesignRole,
  type RoughDesignType,
  type RoughPresetDesignType,
} from '../../rough-design';
import {
  ALL_PATTERN_CATEGORIES,
  PATTERN_CATEGORIES,
  PATTERN_CATEGORY_LABELS,
  type PatternCategoryFilter,
} from './plannerModel';

export interface PatternChooserProps {
  readonly selectedType: RoughDesignType;
  readonly colors: RoughDesignColors;
  readonly category: PatternCategoryFilter;
  readonly search: string;
  readonly onCategoryChange: (value: PatternCategoryFilter) => void;
  readonly onSearchChange: (value: string) => void;
  readonly onSelect: (type: RoughDesignType) => void;
}

const THUMBNAIL_GRID = { columns: 8, rows: 5 } as const;

interface ThumbnailPath {
  readonly role: RoughDesignRole;
  readonly d: string;
}

function buildThumbnailPaths(presetId: RoughPresetDesignType): readonly ThumbnailPath[] {
  const roles = createRoughPatternThumbnail(presetId, THUMBNAIL_GRID);

  return ROUGH_DESIGN_ROLES.map((role) => ({
    role,
    d: roles.reduce(
      (path, cellRole, index) =>
        cellRole === role
          ? `${path}M${String(index % THUMBNAIL_GRID.columns)},${String(
              Math.floor(index / THUMBNAIL_GRID.columns)
            )}h1v1h-1z`
          : path,
      ''
    ),
  })).filter((path) => path.d.length > 0);
}

const PRESET_THUMBNAIL_PATHS: ReadonlyMap<RoughPresetDesignType, readonly ThumbnailPath[]> =
  new Map(
    ROUGH_PATTERN_PRESETS.map((preset) => [preset.id, buildThumbnailPaths(preset.id)] as const)
  );

/**
 * The pattern library, browsable rather than dumped.
 *
 * Hundreds of presets as one unfiltered stack would bury the rest of the section, so the list is
 * filtered by category and by a free-text search over each preset's own name, description, and
 * curated search terms. Each row carries a generated thumbnail drawn from the same role logic the
 * main diagram uses, which is what makes a compact row readable at all.
 */
export function PatternChooser({
  selectedType,
  colors,
  category,
  search,
  onCategoryChange,
  onSearchChange,
  onSelect,
}: PatternChooserProps) {
  const categoryFilter = category === ALL_PATTERN_CATEGORIES ? undefined : category;
  const matches = useMemo(
    () => filterRoughPatternPresets(search, categoryFilter),
    [search, categoryFilter]
  );
  const clearSearchMatches = useMemo(
    () => filterRoughPatternPresets('', categoryFilter),
    [categoryFilter]
  );

  return (
    <fieldset className="planner__patterns">
      <legend>Rough design</legend>

      <div className="planner__field">
        <label htmlFor="planner-pattern-category">Pattern category</label>
        <select
          id="planner-pattern-category"
          onChange={(event) => {
            onCategoryChange(event.target.value as PatternCategoryFilter);
          }}
          value={category}
        >
          <option value={ALL_PATTERN_CATEGORIES}>
            {`All categories (${String(ROUGH_PATTERN_PRESETS.length)} designs)`}
          </option>
          {PATTERN_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {PATTERN_CATEGORY_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="planner__field">
        <label htmlFor="planner-pattern-search">Search designs</label>
        <input
          autoComplete="off"
          id="planner-pattern-search"
          onChange={(event) => {
            onSearchChange(event.target.value);
          }}
          placeholder="border, chevron, parking…"
          type="search"
          value={search}
        />
      </div>

      <p className="planner__hint" data-testid="planner-preset-count">
        {matches.length === 0
          ? `No design matches that search. Clear it to see all ${String(clearSearchMatches.length)}.`
          : `${String(matches.length)} of ${String(ROUGH_PATTERN_PRESETS.length)} designs shown.`}
      </p>

      <ul className="planner__preset-list" data-testid="planner-preset-list">
        {matches.map((preset) => (
          <li key={preset.id}>
            <label className="planner__preset">
              <input
                checked={selectedType === preset.id}
                name="planner-pattern"
                onChange={() => {
                  onSelect(preset.id as RoughPresetDesignType);
                }}
                type="radio"
                value={preset.id}
              />
              <PatternThumbnail colors={colors} presetId={preset.id as RoughPresetDesignType} />
              <span className="planner__preset-body">
                <span className="planner__preset-label">{preset.name}</span>
                <span className="planner__preset-category">
                  {PATTERN_CATEGORY_LABELS[preset.category]}
                </span>
                <span className="planner__preset-description">{preset.description}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <label className="planner__preset planner__preset--custom">
        <input
          checked={selectedType === 'custom'}
          name="planner-pattern"
          onChange={() => {
            onSelect('custom');
          }}
          type="radio"
          value="custom"
        />
        <span className="planner__preset-body">
          <span className="planner__preset-label">Custom</span>
          <span className="planner__preset-description">
            Keep the current shape as a starting point and paint the squares yourself.
          </span>
        </span>
      </label>
    </fieldset>
  );
}

interface PatternThumbnailProps {
  readonly presetId: RoughPresetDesignType;
  readonly colors: RoughDesignColors;
}

/** A generated preview of the preset in the user's own colors. Decorative: the label names it. */
function PatternThumbnail({ presetId, colors }: PatternThumbnailProps) {
  const paths = PRESET_THUMBNAIL_PATHS.get(presetId) ?? [];

  return (
    <svg
      aria-hidden="true"
      className="planner__preset-thumbnail"
      data-testid={`planner-preset-thumbnail-${presetId}`}
      viewBox={`0 0 ${String(THUMBNAIL_GRID.columns)} ${String(THUMBNAIL_GRID.rows)}`}
    >
      {paths.map((path) => (
        <path d={path.d} fill={colors[path.role].hex} key={path.role} />
      ))}
    </svg>
  );
}
