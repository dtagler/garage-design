import { describe, expect, it } from 'vitest';
import { detectMissingCapabilities, type BrowserLike } from './browserSupport';

function supportedBrowser(overrides: Partial<BrowserLike> = {}): BrowserLike {
  return {
    localStorage: {
      setItem: () => undefined,
      removeItem: () => undefined,
    },
    HTMLCanvasElement: { prototype: { toBlob: () => undefined } },
    URL: { createObjectURL: () => 'blob:x' },
    XMLSerializer: function XMLSerializerStub() {
      return undefined;
    },
    CSS: { supports: () => true },
    ...overrides,
  };
}

describe('detectMissingCapabilities', () => {
  it('reports nothing for a browser that supports every feature', () => {
    expect(detectMissingCapabilities(supportedBrowser())).toEqual([]);
  });

  it('treats a localStorage that throws on write as unavailable', () => {
    const missing = detectMissingCapabilities(
      supportedBrowser({
        localStorage: {
          setItem: () => {
            throw new DOMException('denied', 'SecurityError');
          },
          removeItem: () => undefined,
        },
      })
    );

    expect(missing.map((capability) => capability.id)).toEqual(['local-storage']);
    expect(missing[0]?.impact).toMatch(/cannot be saved/i);
  });

  it('reports a missing localStorage object', () => {
    const missing = detectMissingCapabilities(supportedBrowser({ localStorage: null }));

    expect(missing.map((capability) => capability.id)).toEqual(['local-storage']);
  });

  it('survives a localStorage getter that throws in a sandboxed document', () => {
    const browser = supportedBrowser();
    const sandboxed: BrowserLike = {
      ...browser,
      get localStorage(): never {
        throw new DOMException('denied', 'SecurityError');
      },
    };

    expect(detectMissingCapabilities(sandboxed).map((capability) => capability.id)).toEqual([
      'local-storage',
    ]);
  });

  it('reports the export capabilities separately', () => {
    const missing = detectMissingCapabilities(
      supportedBrowser({
        HTMLCanvasElement: { prototype: {} },
        URL: {},
        XMLSerializer: undefined,
      })
    );

    expect(missing.map((capability) => capability.id)).toEqual([
      'canvas-to-blob',
      'object-url',
      'svg-serializer',
    ]);
  });

  it('flags missing grid support but stays quiet when CSS.supports itself is absent', () => {
    expect(
      detectMissingCapabilities(supportedBrowser({ CSS: { supports: () => false } })).map(
        (capability) => capability.id
      )
    ).toEqual(['css-grid']);

    expect(detectMissingCapabilities(supportedBrowser({ CSS: undefined }))).toEqual([]);
  });
});
