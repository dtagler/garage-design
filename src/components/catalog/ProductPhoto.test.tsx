import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GeneratedTileArtwork, ProductPhoto } from './ProductPhoto';
import { findSeedProduct, findSeedProductImage, listSeedProducts } from '../../data';
import { createPrintReportHtml } from '../../export/printReport';
import { buildMaterialSummary, listDrainableCatalogEntries } from './catalogModel';

function requireImage(productId: string) {
  const image = findSeedProductImage(productId);

  if (image === undefined) {
    throw new Error(`expected a seeded image for "${productId}"`);
  }

  return image;
}

describe('ProductPhoto', () => {
  it('renders the remote photo lazily, decoded async, with the browser-default referrer policy', () => {
    render(
      <ProductPhoto
        image={requireImage('racedeck-free-flow')}
        productName="RaceDeck Free-Flow"
        sellerName="RaceDeck"
        surfaceOpenness="open-drainable"
      />
    );

    const photo = screen.getByRole('img', { name: /RaceDeck Free-Flow open-grid tiles/i });

    expect(photo).toHaveAttribute(
      'src',
      'https://racedeck.com/wp-content/uploads/2020/08/free-flow-garage.webp'
    );
    expect(photo).toHaveAttribute('loading', 'lazy');
    expect(photo).toHaveAttribute('decoding', 'async');
    expect(photo).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    expect(photo).not.toHaveAttribute('crossorigin');
  });

  it('shows the attribution as visible text and links the photo back to the seller page', () => {
    const image = requireImage('swisstrax-ribtrax-pro');

    render(
      <ProductPhoto
        image={image}
        productName="Ribtrax PRO"
        sellerName="Swisstrax"
        surfaceOpenness="open-drainable"
      />
    );

    expect(screen.getByText(image.attributionText)).toBeVisible();
    expect(screen.getByText(`checked ${image.checkedDate}`)).toBeVisible();

    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveAttribute('href', image.sourcePageUrl);
      expect(link).toHaveAttribute('rel', 'noreferrer noopener');
      expect(link).toHaveAttribute('target', '_blank');
    }

    expect(screen.getByRole('link', { name: 'View on Swisstrax' })).toBeVisible();
  });

  it('falls back to generated artwork and a seller link when the remote photo fails', () => {
    const image = requireImage('modutile-perforated-garage-tile');

    render(
      <ProductPhoto
        image={image}
        productName="Perforated Garage Floor Tiles"
        sellerName="ModuTile"
        surfaceOpenness="open-drainable"
        swatchHex="#8D9195"
      />
    );

    fireEvent.error(screen.getByRole('img', { name: image.altText }));

    expect(screen.queryByRole('img', { name: image.altText })).not.toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: /Illustration of a perforated, self-draining Perforated Garage Floor Tiles tile/i,
      })
    ).toBeVisible();
    expect(screen.getByText(/Photo unavailable/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'view on ModuTile' })).toHaveAttribute(
      'href',
      image.sourcePageUrl
    );
  });

  it('retries for a different product rendered into the same slot', () => {
    const first = requireImage('racedeck-garageflow');
    const second = requireImage('greatmats-turbotile-perforated');

    const { rerender } = render(
      <ProductPhoto
        image={first}
        productName="GarageFlow"
        sellerName="RaceDeck"
        surfaceOpenness="open-drainable"
      />
    );

    fireEvent.error(screen.getByRole('img', { name: first.altText }));
    expect(screen.getByText(/Photo unavailable/)).toBeVisible();

    rerender(
      <ProductPhoto
        image={second}
        productName="TurboTile Perforated"
        sellerName="Greatmats"
        surfaceOpenness="open-drainable"
      />
    );

    expect(screen.getByRole('img', { name: second.altText })).toHaveAttribute(
      'src',
      second.imageUrl
    );
    expect(screen.queryByText(/Photo unavailable/)).not.toBeInTheDocument();
  });

  it('draws generated artwork with no remote request when a product has no verified photo', () => {
    const { container } = render(
      <ProductPhoto
        image={undefined}
        productName="RaceDeck Diamond"
        sellerName="RaceDeck"
        surfaceOpenness="closed"
        swatchHex="#1A1A1A"
      />
    );

    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(
      screen.getByRole('img', { name: /Illustration of a closed-surface RaceDeck Diamond tile/i })
    ).toBeVisible();
    expect(screen.getByText(/No product photo was verified/)).toBeVisible();
  });
});

describe('GeneratedTileArtwork', () => {
  it('draws perforations only for an open surface, so the classification is visible', () => {
    const open = render(
      <GeneratedTileArtwork
        productName="Open tile"
        surfaceOpenness="open-drainable"
        swatchHex="#8D9195"
      />
    );
    const openHoles = open.container.querySelectorAll('svg rect').length;
    open.unmount();

    const closed = render(
      <GeneratedTileArtwork
        productName="Closed tile"
        surfaceOpenness="closed"
        swatchHex="#1A1A1A"
      />
    );
    const closedHoles = closed.container.querySelectorAll('svg rect').length;

    expect(openHoles).toBeGreaterThan(closedHoles);
    expect(closedHoles).toBe(1);
  });

  it('repeats the non-color symbol so artwork reads in greyscale', () => {
    const { container } = render(
      <GeneratedTileArtwork
        productName="Open tile"
        surfaceOpenness="open-drainable"
        swatchHex="#8D9195"
        symbolChar="▲"
      />
    );

    expect(within(container).getByText('▲')).toBeInTheDocument();
  });

  it('uses contrasting artwork ink on both dark and light tile swatches', () => {
    const dark = render(
      <GeneratedTileArtwork
        productName="Dark tile"
        surfaceOpenness="open-drainable"
        swatchHex="#1A1A1A"
        symbolChar="▲"
      />
    );
    expect(dark.container.querySelector('svg > rect')).toHaveAttribute('stroke', '#ffffff');
    expect(within(dark.container).getByText('▲')).toHaveAttribute('fill', '#ffffff');
    dark.unmount();

    const light = render(
      <GeneratedTileArtwork
        productName="Light tile"
        surfaceOpenness="open-drainable"
        swatchHex="#F2F2F0"
        symbolChar="▲"
      />
    );
    expect(light.container.querySelector('svg > rect')).toHaveAttribute('stroke', '#101418');
    expect(within(light.container).getByText('▲')).toHaveAttribute('fill', '#101418');
  });
});

describe('exports stay photo-free', () => {
  it('never writes a remote photo URL into the printable report', () => {
    const entry = listDrainableCatalogEntries()[0];

    if (entry === undefined) {
      throw new Error('expected at least one drainable catalog entry');
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 240 240');
    const html = createPrintReportHtml({
      garage: { widthInches: 240, lengthInches: 240 },
      selectedEntry: entry,
      summary: buildMaterialSummary({
        layout: { cellsById: {} },
        wasteAllowancePercent: 5,
        overrides: { priceOverridesById: {} },
        offerIdBySelection: {},
      }),
      svg,
    });

    for (const product of listSeedProducts()) {
      if (product.image === undefined) {
        continue;
      }

      expect(html).not.toContain(product.image.imageUrl);
    }

    expect(html).toContain(entry.seedProduct.product.name);
  });

  it('keeps the photo out of the seeded product record the export renderer reads', () => {
    const product = findSeedProduct('racedeck-free-flow');

    expect(product?.image).toBeDefined();
    expect(JSON.stringify(product?.product)).not.toContain('wp-content');
  });
});
