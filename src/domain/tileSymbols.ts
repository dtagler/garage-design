/**
 * Non-color cues.
 *
 * Swatch colors alone cannot carry meaning: two seeded greys differ by a few percent of
 * luminance, and a viewer with a color vision deficiency (or a greyscale print of the
 * exported report) sees no difference at all. Every place that paints a tile color also
 * shows the symbol assigned here, so the floor, the legends, and the material table can be
 * read without relying on hue.
 */

export interface TileSymbol {
  /** Glyph drawn on the tile and repeated in the legend. */
  readonly char: string;
  /** Spoken name used for assistive technology and tooltips. */
  readonly name: string;
}

/** Shapes chosen to stay distinguishable at small sizes and in print. */
export const TILE_SYMBOLS: readonly TileSymbol[] = [
  { char: '●', name: 'circle' },
  { char: '▲', name: 'triangle' },
  { char: '■', name: 'square' },
  { char: '◆', name: 'diamond' },
  { char: '✚', name: 'cross' },
  { char: '★', name: 'star' },
  { char: '◐', name: 'half circle' },
  { char: '▬', name: 'bar' },
  { char: '⬟', name: 'pentagon' },
  { char: '✖', name: 'saltire' },
];

/** Symbol shown for a painted cell whose product or color is no longer in the catalog. */
export const UNKNOWN_TILE_SYMBOL: TileSymbol = { char: '?', name: 'unknown' };

/**
 * Identity of a painted tile for legend purposes: the same product in two colors is two
 * legend entries, and the same color of two products is two entries as well.
 */
export function layoutColorKey(productId: string, colorId: string | undefined): string {
  return `${productId}::${colorId ?? ''}`;
}

/**
 * Assigns a symbol to every key in a stable, order-independent way.
 *
 * Keys are sorted before assignment so any component that starts from the same set of
 * painted colors derives the same legend without threading state through the tree. Past
 * the tenth color the shapes repeat with a numeric suffix, which stays unambiguous.
 */
export function buildTileSymbolLegend(keys: Iterable<string>): ReadonlyMap<string, TileSymbol> {
  const unique = [...new Set(keys)].sort((left, right) => left.localeCompare(right));

  return new Map(
    unique.map((key, index) => {
      const base = TILE_SYMBOLS[index % TILE_SYMBOLS.length] ?? UNKNOWN_TILE_SYMBOL;
      const cycle = Math.floor(index / TILE_SYMBOLS.length);
      return [
        key,
        cycle === 0
          ? base
          : { char: `${base.char}${String(cycle + 1)}`, name: `${base.name} ${String(cycle + 1)}` },
      ];
    })
  );
}

const DARK_INK = '#101418';
const LIGHT_INK = '#ffffff';

/**
 * Picks black or white ink for text drawn on top of a swatch. A fixed translucent black
 * disappears on the dark colors most of the seeded brands sell, so the choice has to follow
 * the background.
 */
export function readableInkColor(backgroundHex: string): string {
  const luminance = relativeLuminance(backgroundHex);
  return contrastRatio(luminance, relativeLuminance(DARK_INK)) >=
    contrastRatio(luminance, relativeLuminance(LIGHT_INK))
    ? DARK_INK
    : LIGHT_INK;
}

function contrastRatio(left: number, right: number): number {
  const lighter = Math.max(left, right);
  const darker = Math.min(left, right);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG relative luminance of a `#rgb` or `#rrggbb` color; unparseable input reads as mid grey. */
export function relativeLuminance(hex: string): number {
  const parsed = parseHex(hex);
  if (parsed === null) return 0.5;

  const [red, green, blue] = parsed.map((channel) => {
    const value = channel / 255;
    return value <= 0.040_45 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function parseHex(hex: string): readonly [number, number, number] | null {
  const value = hex.trim().replace(/^#/, '');
  const expanded =
    value.length === 3 ? [...value].map((character) => `${character}${character}`).join('') : value;

  if (!/^[0-9a-f]{6}$/i.test(expanded)) return null;

  return [
    Number.parseInt(expanded.slice(0, 2), 16),
    Number.parseInt(expanded.slice(2, 4), 16),
    Number.parseInt(expanded.slice(4, 6), 16),
  ];
}
