import { describe, expect, it } from 'vitest';
import {
  TILE_SYMBOLS,
  buildTileSymbolLegend,
  layoutColorKey,
  readableInkColor,
  relativeLuminance,
} from './tileSymbols';

describe('layoutColorKey', () => {
  it('separates the same product in two colors and treats a missing color as its own key', () => {
    expect(layoutColorKey('p1', 'red')).not.toBe(layoutColorKey('p1', 'blue'));
    expect(layoutColorKey('p1', undefined)).toBe('p1::');
  });
});

describe('buildTileSymbolLegend', () => {
  it('assigns the same symbol to a key no matter what order the keys arrive in', () => {
    const forward = buildTileSymbolLegend(['b::2', 'a::1', 'c::3']);
    const backward = buildTileSymbolLegend(['c::3', 'a::1', 'b::2']);

    for (const key of ['a::1', 'b::2', 'c::3']) {
      expect(forward.get(key)?.char).toBe(backward.get(key)?.char);
    }
  });

  it('gives distinct symbols to distinct keys and ignores duplicates', () => {
    const legend = buildTileSymbolLegend(['a', 'b', 'a', 'c']);

    expect(legend.size).toBe(3);
    expect(new Set([...legend.values()].map((symbol) => symbol.char)).size).toBe(3);
  });

  it('keeps symbols unambiguous past the end of the shape list by adding a cycle number', () => {
    const keys = Array.from(
      { length: TILE_SYMBOLS.length + 2 },
      (_, index) => `key-${String(index).padStart(2, '0')}`
    );
    const legend = buildTileSymbolLegend(keys);
    const chars = [...legend.values()].map((symbol) => symbol.char);

    expect(new Set(chars).size).toBe(keys.length);
    expect(legend.get('key-10')?.char).toBe(`${TILE_SYMBOLS[0]?.char ?? ''}2`);
    expect(legend.get('key-10')?.name).toContain('2');
  });
});

describe('readableInkColor', () => {
  it('draws dark ink on a pale swatch and light ink on a dark one', () => {
    expect(readableInkColor('#ffffff')).toBe('#101418');
    expect(readableInkColor('#C6C8CA')).toBe('#101418');
    expect(readableInkColor('#000000')).toBe('#ffffff');
    expect(readableInkColor('#1a1c1f')).toBe('#ffffff');
  });

  it('still returns a usable ink for an unparseable swatch', () => {
    expect(['#101418', '#ffffff']).toContain(readableInkColor('not-a-color'));
  });
});

describe('relativeLuminance', () => {
  it('follows the WCAG scale and accepts short hex', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
    expect(relativeLuminance('#fff')).toBeCloseTo(1, 5);
  });
});
