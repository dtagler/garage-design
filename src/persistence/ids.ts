/**
 * Deterministic stable-identifier and display-name helpers for saved designs.
 *
 * Identifiers are derived from a design name and made unique against the set of
 * ids already in use, so the same inputs always yield the same output. Every id
 * produced here satisfies the lowercase kebab-case rule enforced by the domain
 * parsers in `../domain/persistence`.
 */

/**
 * Converts arbitrary text into a lowercase kebab-case slug. Diacritics are
 * stripped, runs of non-alphanumeric characters collapse to a single hyphen, and
 * an empty result falls back to `"design"` so the value is always a valid id.
 */
export function slugify(input: string): string {
  const slug = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug.length > 0 ? slug : 'design';
}

/**
 * Produces a kebab-case id derived from `name` that does not collide with any
 * value in `taken`. Collisions get a numeric suffix (`base-2`, `base-3`, ...).
 */
export function uniqueDesignId(name: string, taken: ReadonlySet<string>): string {
  const base = slugify(name);
  if (!taken.has(base)) {
    return base;
  }

  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}

/** Normalizes a name for case-insensitive duplicate detection. */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Produces a display name based on `base` that is not already present (case
 * insensitively) in `takenNames`. Collisions get a numeric suffix (`base 2`, ...).
 */
export function uniqueName(base: string, takenNames: ReadonlySet<string>): string {
  const normalizedTaken = new Set(Array.from(takenNames, normalizeName));
  if (!normalizedTaken.has(normalizeName(base))) {
    return base;
  }

  let suffix = 2;
  while (normalizedTaken.has(normalizeName(`${base} ${suffix}`))) {
    suffix += 1;
  }
  return `${base} ${suffix}`;
}
