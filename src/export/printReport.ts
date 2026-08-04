import {
  AFFILIATION_DISCLAIMER,
  findSeedProduct,
  PRICING_DISCLAIMER,
  type SeedProduct,
} from '../data';
import type { GarageDimensions } from '../domain/persistence';
import type { CatalogEntry, MaterialLine, MaterialSummary } from '../components/catalog';
import {
  describePurchaseUnits,
  effectivePurchaseTileCostCents,
  formatInches,
  formatMoney,
  formatUnitMoney,
} from '../components/catalog';
import { DesignExportError, svgDataUrl } from './designExport';

export interface PrintReportFactRow {
  readonly label: string;
  readonly value: string;
}

/** An extra dated fact block, for example door configuration, ramps, or purchased packages. */
export interface PrintReportSection {
  readonly heading: string;
  readonly rows: readonly PrintReportFactRow[];
}

export interface PrintReportSource {
  readonly label: string;
  readonly url: string;
  readonly checkedDate: string;
}

export interface PrintReportInput {
  readonly garage: GarageDimensions;
  readonly selectedEntry: CatalogEntry | null;
  readonly summary: MaterialSummary;
  readonly svg: SVGSVGElement;
  /**
   * Planner facts printed above the material table. They are plain text by contract: a report
   * carries this project's own geometry and figures, never a remote product photograph.
   */
  readonly sections?: readonly PrintReportSection[];
  readonly extraSources?: readonly PrintReportSource[];
}

export function createPrintReportHtml({
  garage,
  selectedEntry,
  summary,
  svg,
  sections = [],
  extraSources = [],
}: PrintReportInput): string {
  const selected = selectedEntry?.seedProduct;
  const sources = [
    ...(selected === undefined ? [] : reportSources(selected, summary)),
    ...extraSources,
  ].filter(
    (source, index, values) =>
      values.findIndex(
        (candidate) =>
          candidate.label === source.label &&
          candidate.url === source.url &&
          candidate.checkedDate === source.checkedDate
      ) === index
  );
  const productFacts =
    selected === undefined
      ? '<p>No product is currently selected.</p>'
      : `<dl><dt>Manufacturer</dt><dd>${escapeHtml(selectedEntry?.manufacturer.name ?? 'Unknown')}</dd>
          <dt>Product</dt><dd>${escapeHtml(selected.product.name)}</dd>
          <dt>Style</dt><dd>${escapeHtml(selected.surfaceStyle?.label ?? 'Not published by the source')}</dd>
          <dt>Tile dimensions</dt><dd>${formatInches(selected.product.dimensions.widthInches)} × ${formatInches(selected.product.dimensions.lengthInches)} × ${formatInches(selected.product.dimensions.thicknessInches)} thick</dd></dl>`;

  const materialRows =
    summary.lines.length === 0
      ? '<tr><td colspan="8">No tiles have been placed in this design.</td></tr>'
      : summary.lines
          .map(
            (line) => `<tr>
              <th><span class="swatch" style="background:${escapeAttribute(line.swatchHex)}"></span>${escapeHtml(line.colorName)}</th>
              <td>${String(line.tileCount)}</td>
              <td>${line.purchase ? String(line.purchase.requiredTileCount) : 'Unavailable'}</td>
              <td>${purchaseSellers(line).map(escapeHtml).join(', ') || 'Unavailable'}</td>
              <td>${purchaseSaleBases(line).map(escapeHtml).join(', ') || 'Unavailable'}</td>
              <td>${escapeHtml(describePurchaseUnits(line.purchase))}</td>
              <td>${effectivePurchaseTileCostCents(line.purchase) === undefined ? 'Unavailable' : `${escapeHtml(formatUnitMoney(effectivePurchaseTileCostCents(line.purchase)!))} / purchased tile`}</td>
              <td>${line.purchase?.totalCostCents === null || line.purchase === undefined ? 'Unavailable' : escapeHtml(formatMoney(line.purchase.totalCostCents))}</td>
            </tr>`
          )
          .join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>GarageDesign project report</title>
<style>
@page { margin: 0.55in; } body { color: #171717; font: 11pt/1.35 Arial, sans-serif; } h1 { margin: 0; } h2 { border-bottom: 1px solid #aaa; margin-top: 1.25rem; padding-bottom: .2rem; } dl { display:grid; grid-template-columns: 10rem 1fr; gap:.25rem .75rem; } dt { font-weight:bold; } dd { margin:0; } table { border-collapse:collapse; width:100%; } th,td { border:1px solid #aaa; padding:.35rem; text-align:left; vertical-align:top; } .layout { max-height:7.5in; max-width:100%; width:100%; } .swatch { border:1px solid #555; display:inline-block; height:.8rem; margin-right:.35rem; vertical-align:middle; width:.8rem; } .disclaimer { font-size:9pt; } a { overflow-wrap:anywhere; } @media print { .no-print { display:none; } }
</style></head><body>
<p class="no-print">Use your browser's Print command and choose Save as PDF.</p>
<h1>GarageDesign project report</h1>
<h2>Garage and selected product</h2>
<dl><dt>Garage dimensions</dt><dd>${formatInches(garage.widthInches)} × ${formatInches(garage.lengthInches)}</dd></dl>
${productFacts}
${sections.map(renderSection).join('')}
<h2>Layout</h2><img class="layout" alt="Garage floor layout" src="${svgDataUrl(svg)}">
<h2>Color legend and materials</h2>
<table><thead><tr><th>Color</th><th>Placed</th><th>With waste</th><th>Seller</th><th>Sale basis</th><th>Purchase units</th><th>Normalized price</th><th>Estimate</th></tr></thead>
<tbody>${materialRows}</tbody><tfoot><tr><th>Total</th><td>${String(summary.placedTileCount)}</td><td>${String(summary.requiredTileCount)}</td><td colspan="4">${String(summary.wasteAllowancePercent)}% waste allowance</td><td>${summary.totalCostCents === null ? 'Unavailable' : escapeHtml(formatMoney(summary.totalCostCents))}</td></tr></tfoot></table>
${summary.issues.length === 0 ? '' : `<p><strong>Estimate warnings:</strong> ${escapeHtml(summary.issues.join(' '))}</p>`}
<h2>Sources and checked dates</h2><ul>${sources.map(renderSource).join('')}</ul>
<h2>Pricing and affiliation</h2><p class="disclaimer">${escapeHtml(PRICING_DISCLAIMER)}</p><p class="disclaimer">${escapeHtml(AFFILIATION_DISCLAIMER)}</p>
</body></html>`;
}

type WindowOpener = (url?: string | URL, target?: string, features?: string) => Window | null;

export async function openPrintReport(
  input: PrintReportInput,
  opener: WindowOpener = (url, target, features) => window.open(url, target, features)
): Promise<void> {
  const reportWindow = opener('', '_blank');
  if (reportWindow === null) {
    throw new DesignExportError(
      'The printable report was blocked by this browser. Allow pop-ups and try again.'
    );
  }

  try {
    reportWindow.opener = null;
    reportWindow.document.open();
    reportWindow.document.write(createPrintReportHtml(input));
    reportWindow.document.close();
    reportWindow.focus();
    await waitForLayoutImage(reportWindow);
    reportWindow.print();
  } catch (error) {
    reportWindow.close();
    throw new DesignExportError(
      `The printable report could not be opened: ${error instanceof Error ? error.message : 'unknown browser error.'}`
    );
  }
}

interface ReportSource {
  readonly label: string;
  readonly url: string;
  readonly checkedDate: string;
}

function reportSources(selected: SeedProduct, summary: MaterialSummary): readonly ReportSource[] {
  const sources: ReportSource[] = [
    {
      label: 'Product dimensions',
      url: selected.dimensionsSource.url,
      checkedDate: selected.dimensionsSource.checkedDate,
    },
    {
      label: 'Product colors',
      url: selected.colorsSource.url,
      checkedDate: selected.colorsSource.checkedDate,
    },
  ];

  for (const line of summary.lines) {
    const lineProduct = findSeedProduct(line.productId);
    if (lineProduct !== undefined) {
      sources.push(
        {
          label: `${line.manufacturerName} ${line.productName} dimensions`,
          url: lineProduct.dimensionsSource.url,
          checkedDate: lineProduct.dimensionsSource.checkedDate,
        },
        {
          label: `${line.manufacturerName} ${line.productName} colors`,
          url: lineProduct.colorsSource.url,
          checkedDate: lineProduct.colorsSource.checkedDate,
        }
      );
    }
    const purchasedOffers = purchaseOffers(line);
    for (const offer of purchasedOffers) {
      sources.push({
        label: `${line.manufacturerName} ${line.productName}, ${line.colorName} ${offer.isOverridden ? 'user-entered price' : 'price'} from ${offer.seller}`,
        url: offer.price.sourceUrl,
        checkedDate: offer.price.checkedDate,
      });
    }
  }

  return sources.filter(
    (source, index, values) =>
      values.findIndex(
        (candidate) =>
          candidate.label === source.label &&
          candidate.url === source.url &&
          candidate.checkedDate === source.checkedDate
      ) === index
  );
}

function purchaseOffers(line: MaterialLine) {
  return [
    ...(line.purchase?.packPurchases.map((purchase) => purchase.offer) ?? []),
    ...(line.purchase?.individualPurchases.map((purchase) => purchase.offer) ?? []),
  ];
}

function purchaseSellers(line: MaterialLine): readonly string[] {
  return distinct(purchaseOffers(line).map((offer) => offer.seller));
}

function purchaseSaleBases(line: MaterialLine): readonly string[] {
  return distinct(
    purchaseOffers(line).map(
      (offer) => `${offer.basisLabel}${offer.isOverridden ? ' (user-entered price)' : ''}`
    )
  );
}

function distinct(values: readonly string[]): readonly string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function waitForLayoutImage(reportWindow: Window): Promise<void> {
  const image = reportWindow.document.querySelector<HTMLImageElement>('img.layout');
  if (image === null) {
    return Promise.reject(new DesignExportError('The printable report has no layout image.'));
  }
  if (image.complete) {
    return image.naturalWidth === 0
      ? Promise.reject(new DesignExportError('The printable report layout could not be loaded.'))
      : Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () =>
      reject(new DesignExportError('The printable report layout could not be loaded.'));
  });
}

function renderSource(source: ReportSource): string {
  const url = escapeAttribute(source.url);
  return `<li>${escapeHtml(source.label)}: <a href="${url}">${escapeHtml(source.url)}</a> (checked ${escapeHtml(source.checkedDate)})</li>`;
}

function renderSection(section: PrintReportSection): string {
  const rows = section.rows
    .map((row) => `<dt>${escapeHtml(row.label)}</dt><dd>${escapeHtml(row.value)}</dd>`)
    .join('');
  return `<h2>${escapeHtml(section.heading)}</h2><dl>${rows}</dl>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character] ?? character;
  });
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
