export const PRINT_DPI = 300;
export const PRINT_LONGEST_SIDE_INCHES = 10;
export const MAX_CANVAS_DIMENSION = 16_384;
export const MAX_CANVAS_PIXELS = 268_000_000;

export class DesignExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DesignExportError';
  }
}

export interface SvgExport {
  readonly markup: string;
  readonly width: number;
  readonly height: number;
}

export interface PngExportOptions {
  readonly filename: string;
  readonly document?: Document;
  readonly url?: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>;
  readonly imageFactory?: () => HTMLImageElement;
}

export function sanitizeFilename(value: string, fallback = 'garage-floor-layout'): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  return (normalized || fallback).slice(0, 80);
}

export function exportFilename(label: string, extension: 'png' | 'pdf'): string {
  return `${sanitizeFilename(label)}.${extension}`;
}

export function serializeFloorSvg(
  svg: SVGSVGElement,
  intrinsicPixelDimensions?: { readonly width: number; readonly height: number }
): SvgExport {
  if (typeof XMLSerializer === 'undefined') {
    throw new DesignExportError(
      'SVG export is unavailable because this browser cannot serialize SVG.'
    );
  }

  const viewBox = parseViewBox(svg.getAttribute('viewBox'));
  const clone = svg.cloneNode(true) as SVGSVGElement;
  applyPaperExportPalette(clone);
  clone.setAttribute('version', '1.1');
  clone.setAttribute('viewBox', `0 0 ${String(viewBox.width)} ${String(viewBox.height)}`);
  clone.setAttribute('width', String(intrinsicPixelDimensions?.width ?? viewBox.width));
  clone.setAttribute('height', String(intrinsicPixelDimensions?.height ?? viewBox.height));

  return {
    markup: new XMLSerializer().serializeToString(clone),
    width: viewBox.width,
    height: viewBox.height,
  };
}

function applyPaperExportPalette(svg: SVGSVGElement): void {
  const replacements = new Map([
    ['#080d11', '#ffffff'],
    ['#dce6eb', '#101418'],
    ['#514631', '#e3dccb'],
    ['#2a241b', '#f8ead8'],
    ['#26333d', '#d4dde3'],
  ]);

  for (const element of svg.querySelectorAll<SVGElement>('[fill], [stroke]')) {
    for (const attribute of ['fill', 'stroke'] as const) {
      const value = element.getAttribute(attribute)?.toLowerCase();
      const replacement = value === undefined ? undefined : replacements.get(value);
      if (replacement !== undefined) element.setAttribute(attribute, replacement);
    }
  }
}

export function svgDataUrl(svg: SVGSVGElement): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serializeFloorSvg(svg).markup)}`;
}

export async function downloadFloorPng(
  svg: SVGSVGElement,
  {
    filename,
    document = globalThis.document,
    url = URL,
    imageFactory = () => new Image(),
  }: PngExportOptions
): Promise<{ readonly width: number; readonly height: number }> {
  if (!document?.createElement || !url?.createObjectURL || !url?.revokeObjectURL) {
    throw new DesignExportError('PNG export is unavailable in this browser.');
  }

  const source = serializeFloorSvg(svg);
  const dimensions = printablePixelDimensions(source.width, source.height);
  const serialized = serializeFloorSvg(svg, dimensions);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new DesignExportError(
      'PNG export is unavailable because this browser cannot create a canvas.'
    );
  }

  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  if (canvas.width !== dimensions.width || canvas.height !== dimensions.height) {
    throw new DesignExportError(
      `The ${String(dimensions.width)} × ${String(dimensions.height)} PNG exceeds this browser's canvas limit. Use the printable report instead.`
    );
  }

  const svgUrl = url.createObjectURL(new Blob([serialized.markup], { type: 'image/svg+xml' }));
  try {
    const image = imageFactory();
    await loadImage(image, svgUrl);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, dimensions.width, dimensions.height);
    context.drawImage(image, 0, 0, dimensions.width, dimensions.height);
    const blob = await canvasToBlob(canvas);
    triggerDownload(document, url, blob, filename);
    return dimensions;
  } catch (error) {
    if (error instanceof DesignExportError) throw error;
    throw new DesignExportError(
      `PNG export failed: ${error instanceof Error ? error.message : 'the browser could not render the layout.'}`
    );
  } finally {
    url.revokeObjectURL(svgUrl);
  }
}

export function printablePixelDimensions(
  svgWidth: number,
  svgHeight: number
): { readonly width: number; readonly height: number } {
  if (
    !Number.isFinite(svgWidth) ||
    !Number.isFinite(svgHeight) ||
    svgWidth <= 0 ||
    svgHeight <= 0
  ) {
    throw new DesignExportError('The floor layout has invalid dimensions and cannot be exported.');
  }

  const longestSide = PRINT_DPI * PRINT_LONGEST_SIDE_INCHES;
  const scale = longestSide / Math.max(svgWidth, svgHeight);
  const width = Math.max(1, Math.round(svgWidth * scale));
  const height = Math.max(1, Math.round(svgHeight * scale));

  if (
    width > MAX_CANVAS_DIMENSION ||
    height > MAX_CANVAS_DIMENSION ||
    width * height > MAX_CANVAS_PIXELS
  ) {
    throw new DesignExportError(
      `The ${String(width)} × ${String(height)} PNG exceeds this browser's safe canvas limit. Use the printable report instead.`
    );
  }

  return { width, height };
}

function parseViewBox(value: string | null): { readonly width: number; readonly height: number } {
  const parts = value
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (
    parts === undefined ||
    parts.length !== 4 ||
    !parts.every(Number.isFinite) ||
    parts[2] === undefined ||
    parts[3] === undefined ||
    parts[2] <= 0 ||
    parts[3] <= 0
  ) {
    throw new DesignExportError(
      'The floor layout has no valid SVG viewBox and cannot be exported.'
    );
  }

  return { width: parts[2], height: parts[3] };
}

function loadImage(image: HTMLImageElement, source: string): Promise<void> {
  return new Promise((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () =>
      reject(
        new DesignExportError(
          'PNG export failed because the browser could not load the SVG layout.'
        )
      );
    image.src = source;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) {
        reject(
          new DesignExportError('PNG export failed because the browser could not encode the image.')
        );
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

function triggerDownload(
  document: Document,
  url: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>,
  blob: Blob,
  filename: string
): void {
  const anchor = document.createElement('a');
  const downloadUrl = url.createObjectURL(blob);
  anchor.href = downloadUrl;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Browsers may begin a programmatic download on the next task, after this handler returns.
  // Keep the Blob URL alive through that handoff instead of revoking it before the download starts.
  setTimeout(() => {
    url.revokeObjectURL(downloadUrl);
  }, 0);
}
