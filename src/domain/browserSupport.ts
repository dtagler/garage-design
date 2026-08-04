/**
 * Browser capability detection.
 *
 * The app is local-only: everything it does depends on the browser it is opened in. When a
 * capability is missing the affected feature has to say so up front instead of failing
 * silently at the moment the user clicks Save or Export.
 */

export type BrowserCapabilityId =
  'local-storage' | 'canvas-to-blob' | 'object-url' | 'svg-serializer' | 'css-grid';

export interface BrowserCapability {
  readonly id: BrowserCapabilityId;
  /** What the browser is missing, in the user's terms. */
  readonly label: string;
  /** What stops working because of it. */
  readonly impact: string;
}

/** Narrow view of `window` so tests can describe a browser without faking a whole global. */
export interface BrowserLike {
  readonly localStorage?: Pick<Storage, 'setItem' | 'removeItem'> | null;
  readonly HTMLCanvasElement?: { readonly prototype: { toBlob?: unknown } } | undefined;
  readonly URL?: { readonly createObjectURL?: unknown } | undefined;
  readonly XMLSerializer?: unknown;
  readonly CSS?: { readonly supports?: (property: string, value: string) => boolean } | undefined;
}

const PROBE_KEY = 'garage-floor-design::capability-probe';

/**
 * Lists the capabilities this browser does not provide. An empty list means every feature
 * of the app is usable.
 *
 * A check only reports a failure it is sure of: a browser that does not expose
 * `CSS.supports` at all is not evidence that grid layout is missing, so it is left alone.
 */
export function detectMissingCapabilities(browser: BrowserLike): readonly BrowserCapability[] {
  const missing: BrowserCapability[] = [];

  if (!hasWorkingLocalStorage(browser)) {
    missing.push({
      id: 'local-storage',
      label: 'Local storage is blocked or unavailable',
      impact:
        'Designs cannot be saved or recovered in this browser. Export a PNG or the printable report to keep a copy.',
    });
  }

  if (typeof browser.HTMLCanvasElement?.prototype.toBlob !== 'function') {
    missing.push({
      id: 'canvas-to-blob',
      label: 'Canvas image export is unavailable',
      impact: 'The high-resolution PNG download will not work. Use the printable report instead.',
    });
  }

  if (typeof browser.URL?.createObjectURL !== 'function') {
    missing.push({
      id: 'object-url',
      label: 'File downloads are unavailable',
      impact: 'The browser cannot hand a generated file to the download manager.',
    });
  }

  if (typeof browser.XMLSerializer !== 'function') {
    missing.push({
      id: 'svg-serializer',
      label: 'SVG serialization is unavailable',
      impact: 'Neither the PNG nor the printable report can include the floor drawing.',
    });
  }

  if (browser.CSS?.supports !== undefined && !browser.CSS.supports('display', 'grid')) {
    missing.push({
      id: 'css-grid',
      label: 'CSS grid layout is unsupported',
      impact: 'Panels and previews will stack in a single column and may be hard to read.',
    });
  }

  return missing;
}

function hasWorkingLocalStorage(browser: BrowserLike): boolean {
  try {
    // Sandboxed documents throw from the `localStorage` getter itself, not only from a write.
    const storage = browser.localStorage;
    if (!storage) return false;

    storage.setItem(PROBE_KEY, '1');
    storage.removeItem(PROBE_KEY);
    return true;
  } catch {
    // Private modes and blocked-cookie settings throw on write rather than hiding the API.
    return false;
  }
}
