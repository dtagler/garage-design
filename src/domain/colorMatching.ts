export interface NamedColor {
  readonly name: string;
}

export const COLOR_FAMILY_TOKENS: Readonly<Record<string, readonly string[]>> = {
  black: ['black'],
  blue: ['blue'],
  red: ['red'],
  orange: ['orange'],
  green: ['green'],
  white: ['white', 'arctic', 'chalk'],
  silver: ['silver', 'alloy', 'grey', 'gray'],
  brown: ['brown', 'mocha', 'espresso', 'chocolate'],
  yellow: ['yellow'],
};

export function normalizeColorName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function getColorFamily(name: string): string | undefined {
  const normalized = normalizeColorName(name);
  return Object.entries(COLOR_FAMILY_TOKENS).find(([, tokens]) =>
    tokens.some((token) => normalized.includes(token))
  )?.[0];
}

export function findBestColorSubstitute<T extends NamedColor>(
  colors: readonly T[],
  preferredTokens: readonly string[] | undefined
): T | undefined {
  if (!preferredTokens) return undefined;

  return colors
    .map((color, index) => ({
      color,
      index,
      preference: preferredTokens.findIndex((token) =>
        normalizeColorName(color.name).includes(token)
      ),
    }))
    .filter((candidate) => candidate.preference >= 0)
    .sort((left, right) => left.preference - right.preference || left.index - right.index)[0]
    ?.color;
}
