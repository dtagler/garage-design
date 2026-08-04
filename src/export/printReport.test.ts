import { describe, expect, it, vi } from 'vitest';
import { listCatalogEntries, buildMaterialSummary } from '../components/catalog';
import { DEFAULT_CATALOG_OVERRIDES, DEFAULT_GARAGE_DIMENSIONS } from '../domain/persistence';
import { createPrintReportHtml, openPrintReport, type PrintReportInput } from './printReport';

function makeInput(productId: string): PrintReportInput {
  const entry = listCatalogEntries().find(
    (candidate) => candidate.seedProduct.product.id === productId
  );
  if (entry === undefined) throw new Error(`Missing catalog product ${productId}.`);
  const color = entry.seedProduct.colors[0]?.color;
  if (color === undefined) throw new Error(`Missing color for ${productId}.`);
  const summary = buildMaterialSummary({
    layout: {
      cellsById: {
        '0-0': {
          id: '0-0',
          column: 0,
          row: 0,
          productId,
          colorId: color.id,
          orientation: 0,
        },
      },
    },
    wasteAllowancePercent: 10,
    overrides: DEFAULT_CATALOG_OVERRIDES,
    offerIdBySelection: {},
  });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 228 240');
  svg.innerHTML = '<rect width="228" height="240" fill="#112233"/><text x="2" y="2">^</text>';

  return { garage: DEFAULT_GARAGE_DIMENSIONS, selectedEntry: entry, summary, svg };
}

describe('printable design report', () => {
  it('includes premium product facts, estimates, sources, dates, and disclaimers', () => {
    const html = createPrintReportHtml(makeInput('racedeck-diamond'));

    expect(html).toContain('RaceDeck');
    expect(html).toContain('Garage dimensions');
    expect(html).toContain('Color legend and materials');
    expect(html).toContain('10% waste allowance');
    expect(html).toContain('Sources and checked dates');
    expect(html).toContain('checked 2026-07-28');
    expect(html).toContain('Prices are estimates for planning only.');
    expect(html).toContain('not affiliated with');
    expect(html).toContain('data:image/svg+xml');
  });

  it('renders the optimized VEVOR purchase plan rather than a normalized pack price', () => {
    const html = createPrintReportHtml(makeInput('vevor-garage-tiles-interlocking-12in'));

    expect(html).toContain('VEVOR');
    expect(html).toContain('per pack of 25 tiles');
    expect(html).toContain('Purchase units');
    expect(html).toContain('/ purchased tile');
  });

  it('reports VEVOR drainage-mat packages without an individual-tile claim', () => {
    const html = createPrintReportHtml(makeInput('vevor-interlocking-drainage-mat-12in'));

    expect(html).toContain('VEVOR');
    expect(html).toContain('per pack of 12 tiles');
    expect(html).toContain('Purchase units');
    expect(html).not.toContain('individual tiles verified');
  });

  it('renders planner fact sections and their extra dated sources', () => {
    const html = createPrintReportHtml({
      ...makeInput('racedeck-free-flow'),
      sections: [
        {
          heading: 'Garage front and door openings',
          rows: [
            { label: 'Configuration', value: 'Two single doors separated by a center wall' },
            {
              label: 'Segments',
              value: 'Left wall 15 in, Door opening 1 94 in, Center wall 12 in',
            },
          ],
        },
        {
          heading: 'Expansion clearance and tile field',
          rows: [
            { label: 'Expansion clearance', value: '1 in left, 1 in right, 1 in front, 1 in back' },
            { label: 'Tile field', value: '228 in × 244 in' },
          ],
        },
        {
          heading: 'Packages, leftovers, and ramps',
          rows: [
            { label: 'Base Alloy', value: '439 tiles with waste · 439 purchased · 0 left over' },
            { label: 'Ramps', value: '16 ramp pieces are needed, bought as 16 pieces' },
          ],
        },
      ],
      extraSources: [
        {
          label: 'RaceDeck Edges ramp price from RaceDeck',
          url: 'https://racedeck.com/racedeck-garage-floors-and-tiles/edges/',
          checkedDate: '2026-07-29',
        },
      ],
    });

    expect(html).toContain('Garage front and door openings');
    expect(html).toContain('Door opening 1 94 in');
    expect(html).toContain('Expansion clearance');
    expect(html).toContain('228 in × 244 in');
    expect(html).toContain('0 left over');
    expect(html).toContain('16 ramp pieces are needed');
    expect(html).toContain('checked 2026-07-29');
  });

  it('never embeds a remote product photograph, only the generated layout', () => {
    const html = createPrintReportHtml(makeInput('racedeck-free-flow'));
    const images = [...html.matchAll(/<img[^>]*>/g)].map((match) => match[0]);

    expect(images).toHaveLength(1);
    expect(images[0]).toContain('data:image/svg+xml');
    expect(html).not.toContain('free-flow-garage.webp');
    expect(html).not.toContain('wp-content/uploads');
  });

  it('opens the print dialog after the layout image is ready', async () => {
    const write = vi.fn();
    const print = vi.fn();
    const popup = {
      document: {
        open: vi.fn(),
        write,
        close: vi.fn(),
        querySelector: vi.fn(() => ({ complete: true, naturalWidth: 1 })),
      },
      focus: vi.fn(),
      print,
      close: vi.fn(),
    };
    const opener = vi.fn(() => popup);

    await openPrintReport(
      makeInput('racedeck-diamond'),
      opener as unknown as (url?: string | URL, target?: string, features?: string) => Window | null
    );

    expect(write).toHaveBeenCalledOnce();
    expect(write.mock.calls[0]?.[0]).toContain('GarageDesign project report');
    expect(print).toHaveBeenCalledOnce();
  });
});
