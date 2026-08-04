import { useState } from 'react';
import type { CatalogEntry, MaterialSummary } from '../catalog';
import type { GarageDimensions } from '../../domain/persistence';
import {
  DesignExportError,
  downloadFloorPng,
  exportFilename,
  openPrintReport,
  type PrintReportSection,
  type PrintReportSource,
} from '../../export';
import './ExportControls.css';

export interface ExportControlsProps {
  readonly garage: GarageDimensions;
  readonly selectedEntry: CatalogEntry | null;
  readonly summary: MaterialSummary;
  readonly getLayoutSvg: () => SVGSVGElement | null;
  /** Extra dated fact blocks: door configuration, clearance, ramps, packages, leftovers. */
  readonly reportSections?: readonly PrintReportSection[];
  readonly reportSources?: readonly PrintReportSource[];
}

export function ExportControls({
  garage,
  selectedEntry,
  summary,
  getLayoutSvg,
  reportSections = [],
  reportSources = [],
}: ExportControlsProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [isExportingPng, setExportingPng] = useState(false);
  const productLabel = selectedEntry?.seedProduct.product.name ?? 'garage-floor-layout';

  const requireLayout = (): SVGSVGElement | null => {
    const svg = getLayoutSvg();
    if (svg === null) {
      setStatus(
        'The floor layout is not ready to export. Try again after the workspace finishes loading.'
      );
    }
    return svg;
  };

  return (
    <section aria-labelledby="design-export-heading" className="export-controls">
      <div>
        <h2 id="design-export-heading">Export design</h2>
        <p>
          PNG renders the floor SVG with 3,000 pixels on its longest side, sized for a 10 inch print
          at 300 pixels per inch. The report opens locally for Save as PDF and lists each seeded
          product and ramp source with its checked date. Prices remain estimates only.
        </p>
      </div>
      <div className="export-controls__actions">
        <button
          disabled={isExportingPng}
          onClick={() => {
            const svg = requireLayout();
            if (svg === null) return;

            setExportingPng(true);
            setStatus(null);
            void downloadFloorPng(svg, {
              filename: exportFilename(`garage-floor-layout-${productLabel}`, 'png'),
            })
              .then(({ width, height }) => {
                setStatus(`Downloaded ${String(width)} × ${String(height)} PNG.`);
              })
              .catch((error: unknown) => {
                setStatus(describeExportError(error));
              })
              .finally(() => {
                setExportingPng(false);
              });
          }}
          type="button"
        >
          {isExportingPng ? 'Preparing PNG…' : 'Download high-resolution PNG'}
        </button>
        <button
          onClick={() => {
            const svg = requireLayout();
            if (svg === null) return;

            setStatus(null);
            void openPrintReport({
              garage,
              selectedEntry,
              summary,
              svg,
              sections: reportSections,
              extraSources: reportSources,
            })
              .then(() => {
                setStatus('Opened a printable report. Use your browser’s Save as PDF option.');
              })
              .catch((error: unknown) => {
                setStatus(describeExportError(error));
              });
          }}
          type="button"
        >
          Open printable report
        </button>
      </div>
      {status === null ? null : (
        <p aria-live="polite" className="export-controls__status" role="status">
          {status}
        </p>
      )}
    </section>
  );
}

function describeExportError(error: unknown): string {
  return error instanceof DesignExportError
    ? error.message
    : `Export failed: ${error instanceof Error ? error.message : 'unknown browser error.'}`;
}
