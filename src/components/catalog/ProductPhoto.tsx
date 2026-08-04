import { useState } from 'react';
import type { ProductImageRef, SurfaceOpenness } from '../../data';
import { readableInkColor } from '../../domain/tileSymbols';
import './ProductPhoto.css';

export interface ProductPhotoProps {
  /** Verified remote photo, or `undefined` when none was found for the product. */
  readonly image: ProductImageRef | undefined;
  readonly productName: string;
  /** Named in the fallback caption so the reader still knows who to check the product with. */
  readonly sellerName: string;
  /** Drives the generated artwork: an open surface is drawn with visible perforations. */
  readonly surfaceOpenness: SurfaceOpenness;
  /** Approximate swatch for the generated artwork; falls back to a neutral grey. */
  readonly swatchHex?: string;
  /** Non-color cue repeated from the tile legend, so artwork is readable in greyscale. */
  readonly symbolChar?: string;
}

const FALLBACK_SWATCH_HEX = '#8a9099';

/**
 * A product photo loaded straight from the seller.
 *
 * Three rules hold this component together, and none of them are cosmetic:
 *
 * 1. **Nothing is copied.** The bytes stay on the seller's host. This project never downloads,
 *    caches, bundles, or re-serves someone else's product photography, which is what keeps its
 *    copyright posture the same as its text-only-facts posture.
 * 2. **Attribution is visible and linked.** The credit renders as real text, never as a tooltip,
 *    and the photo is always wrapped in a link back to the page it was read from.
 * 3. **Display only, never exported.** No caller may draw this into a canvas. Remote bitmaps taint
 *    an export canvas, so `toDataURL`/`toBlob` would throw; more to the point, a PNG or PDF the
 *    user shares must not carry someone else's photograph inside it. Exports use only the
 *    generated geometry in `src/export`.
 *
 * The remote URL can break at any time - most of the seeded hosts are plain WordPress upload paths
 * and one answers 406 to anything that does not look like a browser - so a failed load is a normal
 * outcome, not an error state. It falls back to generated tile artwork plus a link to the seller.
 */
export function ProductPhoto({
  image,
  productName,
  sellerName,
  surfaceOpenness,
  swatchHex,
  symbolChar,
}: ProductPhotoProps) {
  // Keyed by URL rather than a bare boolean: a new product rendered into the same slot deserves
  // its own attempt, and deriving that during render avoids a reset effect entirely.
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const hasFailed = image !== undefined && failedImageUrl === image.imageUrl;

  const artwork = (
    <GeneratedTileArtwork
      productName={productName}
      surfaceOpenness={surfaceOpenness}
      swatchHex={swatchHex ?? FALLBACK_SWATCH_HEX}
      symbolChar={symbolChar}
    />
  );

  if (image === undefined) {
    return (
      <figure className="product-photo product-photo--generated">
        {artwork}
        <figcaption className="product-photo__caption">
          Illustration only. No product photo was verified for this tile.
        </figcaption>
      </figure>
    );
  }

  if (hasFailed) {
    return (
      <figure className="product-photo product-photo--generated">
        {artwork}
        <figcaption className="product-photo__caption">
          Photo unavailable —{' '}
          <a href={image.sourcePageUrl} rel="noreferrer noopener" target="_blank">
            view on {sellerName}
          </a>
        </figcaption>
      </figure>
    );
  }

  return (
    <figure className="product-photo">
      <a
        className="product-photo__link"
        href={image.sourcePageUrl}
        rel="noreferrer noopener"
        target="_blank"
      >
        <img
          alt={image.altText}
          className="product-photo__image"
          decoding="async"
          // Matches the browser default. Leaving it off entirely is the same policy, but several
          // of these hosts key hotlink protection on the Referer header, so stripping it with
          // `no-referrer` would be the change that breaks them.
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
          onError={() => {
            setFailedImageUrl(image.imageUrl);
          }}
          src={image.imageUrl}
        />
      </a>
      <figcaption className="product-photo__caption">
        <span className="product-photo__attribution">{image.attributionText}</span>{' '}
        <a href={image.sourcePageUrl} rel="noreferrer noopener" target="_blank">
          View on {sellerName}
        </a>{' '}
        <span className="product-photo__date">checked {image.checkedDate}</span>
      </figcaption>
    </figure>
  );
}

export interface GeneratedTileArtworkProps {
  readonly productName: string;
  readonly surfaceOpenness: SurfaceOpenness;
  readonly swatchHex: string;
  readonly symbolChar?: string;
}

/**
 * Original artwork for a tile, drawn from the seeded swatch and surface classification. This is
 * the zero-risk default: it is this project's own geometry, so it is safe in exports, in print,
 * and offline, and it is what a failed photo falls back to.
 *
 * An open surface is drawn with real holes through the tile face, so the drainable classification
 * is legible without reading the label.
 */
export function GeneratedTileArtwork({
  productName,
  surfaceOpenness,
  swatchHex,
  symbolChar,
}: GeneratedTileArtworkProps) {
  const isOpen = surfaceOpenness === 'open-drainable';
  const holes = isOpen ? buildHoleGrid() : [];
  const artworkInk = readableInkColor(swatchHex);

  return (
    <svg
      aria-label={`Illustration of a ${
        isOpen ? 'perforated, self-draining' : 'closed-surface'
      } ${productName} tile`}
      className="product-photo__artwork"
      role="img"
      viewBox="0 0 100 100"
    >
      <rect
        fill={swatchHex}
        height="96"
        rx="6"
        stroke={artworkInk}
        strokeWidth="1.5"
        width="96"
        x="2"
        y="2"
      />
      {holes.map((hole) => (
        <rect
          fill={artworkInk}
          fillOpacity="0.55"
          height="7"
          key={`${String(hole.x)}-${String(hole.y)}`}
          rx="1.5"
          width="7"
          x={hole.x}
          y={hole.y}
        />
      ))}
      {symbolChar === undefined ? null : (
        <text
          dominantBaseline="central"
          fontSize="26"
          fill={artworkInk}
          fillOpacity="0.75"
          textAnchor="middle"
          x="50"
          y="50"
        >
          {symbolChar}
        </text>
      )}
    </svg>
  );
}

function buildHoleGrid(): readonly { readonly x: number; readonly y: number }[] {
  const holes: { x: number; y: number }[] = [];

  for (let row = 0; row < 6; row += 1) {
    for (let column = 0; column < 6; column += 1) {
      holes.push({ x: 12 + column * 13, y: 12 + row * 13 });
    }
  }

  return holes;
}
