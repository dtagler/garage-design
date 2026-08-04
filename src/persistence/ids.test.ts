import { describe, expect, it } from 'vitest';
import { normalizeName, slugify, uniqueDesignId, uniqueName } from './ids';

describe('slugify', () => {
  it('produces a kebab-case slug from arbitrary text', () => {
    expect(slugify('July Garage 2026!')).toBe('july-garage-2026');
  });

  it('strips diacritics and collapses separators', () => {
    expect(slugify('  Café  --  Déjà ')).toBe('cafe-deja');
  });

  it('falls back to "design" for empty slugs', () => {
    expect(slugify('!!!')).toBe('design');
    expect(slugify('   ')).toBe('design');
  });
});

describe('uniqueDesignId', () => {
  it('returns the base slug when unused', () => {
    expect(uniqueDesignId('Garage', new Set())).toBe('garage');
  });

  it('appends numeric suffixes when the slug collides', () => {
    const taken = new Set(['garage', 'garage-2']);
    expect(uniqueDesignId('Garage', taken)).toBe('garage-3');
  });
});

describe('uniqueName', () => {
  it('keeps the base name when unused', () => {
    expect(uniqueName('Garage (copy)', new Set(['Garage']))).toBe('Garage (copy)');
  });

  it('appends a numeric suffix on case-insensitive collision', () => {
    expect(uniqueName('Garage (copy)', new Set(['garage (COPY)']))).toBe('Garage (copy) 2');
  });
});

describe('normalizeName', () => {
  it('trims and lowercases', () => {
    expect(normalizeName('  July Garage ')).toBe('july garage');
  });
});
