import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DesignExportError,
  downloadFloorPng,
  exportFilename,
  sanitizeFilename,
  serializeFloorSvg,
} from './designExport';

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 228 240');
  svg.innerHTML =
    '<rect width="228" height="240" fill="#f8f9fa"/><text x="12" y="12" fill="#000">^</text>';
  return svg;
}

describe('design export helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates safe, descriptive filenames', () => {
    expect(sanitizeFilename('  RaceDeck: Diamond / Black  ')).toBe('racedeck-diamond-black');
    expect(sanitizeFilename('***')).toBe('garage-floor-layout');
    expect(exportFilename('Garage Floor Layout: VEVOR', 'png')).toBe(
      'garage-floor-layout-vevor.png'
    );
  });

  it('serializes the actual SVG with its geometry, colors, and indicators', () => {
    const serialized = serializeFloorSvg(makeSvg());

    expect(serialized).toMatchObject({ width: 228, height: 240 });
    expect(serialized.markup).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(serialized.markup).toContain('fill="#f8f9fa"');
    expect(serialized.markup).toContain('<text x="12" y="12" fill="#000">^</text>');
  });

  it('converts the dark on-screen preview palette to a paper-safe export palette', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.innerHTML =
      '<rect fill="#080d11" width="100" height="100"/><path fill="#26333d" stroke="#dce6eb"/>';

    const serialized = serializeFloorSvg(svg);

    expect(serialized.markup).toContain('fill="#ffffff"');
    expect(serialized.markup).toContain('fill="#d4dde3"');
    expect(serialized.markup).toContain('stroke="#101418"');
    expect(serialized.markup).not.toContain('#080d11');
  });

  it('renders and downloads a PNG with mocked browser APIs', async () => {
    const drawImage = vi.fn();
    const context = {
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage,
    } as unknown as CanvasRenderingContext2D;
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toBlob: (callback: BlobCallback) => callback(new Blob(['png'], { type: 'image/png' })),
    } as unknown as HTMLCanvasElement;
    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'canvas') return canvas;
      return document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const objectUrls = ['blob:svg', 'blob:png'];
    const url = {
      createObjectURL: vi.fn(() => objectUrls.shift() ?? 'blob:unexpected'),
      revokeObjectURL: vi.fn(),
    };
    const image = {} as HTMLImageElement;
    Object.defineProperty(image, 'src', {
      set: () => {
        image.onload?.(new Event('load'));
      },
    });

    await expect(
      downloadFloorPng(makeSvg(), {
        filename: 'garage-floor-layout.png',
        document,
        url,
        imageFactory: () => image,
      })
    ).resolves.toEqual({ width: 2850, height: 3000 });

    expect(drawImage).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(url.revokeObjectURL).toHaveBeenCalledWith('blob:svg');
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(url.revokeObjectURL).toHaveBeenCalledWith('blob:png');
  });

  it('reports a browser canvas failure instead of claiming PNG success', async () => {
    const canvas = {
      getContext: vi.fn(() => null),
    } as unknown as HTMLCanvasElement;
    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'canvas') return canvas;
      return document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
    });
    const url = {
      createObjectURL: vi.fn(() => 'blob:svg'),
      revokeObjectURL: vi.fn(),
    };

    await expect(
      downloadFloorPng(makeSvg(), { filename: 'layout.png', document, url })
    ).rejects.toThrow('cannot create a canvas');
    expect(url.createObjectURL).not.toHaveBeenCalled();
  });

  it('rejects invalid layout geometry explicitly', () => {
    const svg = makeSvg();
    svg.setAttribute('viewBox', '0 0 0 100');

    expect(() => serializeFloorSvg(svg)).toThrow(DesignExportError);
  });
});
