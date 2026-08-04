import { useId } from 'react';
import type { RoughGarageDimensions } from '../../rough-design';
import { formatInches as formatFrontInches, type GarageFrontGeometry } from '../../garage-front';
import { isRampPlan, type RampResult } from '../../calculations/ramps';
import { formatInches } from '../catalog';
import {
  buildExactPreviewGeometry,
  formatGap,
  listEdgeGaps,
  ROLE_LABELS,
  type ProductPlan,
} from './plannerModel';

export interface ExactFloorPreviewProps {
  readonly garage: RoughGarageDimensions;
  readonly plan: ProductPlan;
  /** `compact` is the small product preview; `detailed` is the exportable main stage. */
  readonly variant: 'compact' | 'detailed';
  /** Wall and opening run along the front (top) edge. */
  readonly front?: GarageFrontGeometry;
  /** Ramps are drawn across door openings only, never across a wall. */
  readonly ramp?: RampResult | null;
  /** Extra facts printed under the legend so an exported PNG carries them too. */
  readonly legendExtras?: readonly string[];
  readonly svgRef?: (svg: SVGSVGElement | null) => void;
  readonly testId?: string;
}

const DISPLAY_FONT = "Bahnschrift, 'DIN Alternate', 'Roboto Condensed', sans-serif";
const INK = '#dce6eb';
const PAPER = '#080d11';
const CLEARANCE = '#514631';
const RAMP = '#e88b22';

/**
 * The product-specific floor, drawn true to scale: whole tiles at their real size and cut edge
 * strips at their real width. The detailed variant carries its own title, legend, edge notes, door
 * openings, ramps, and expansion clearance so an exported PNG explains itself without the
 * surrounding page. No remote product photo is ever drawn into it.
 */
export function ExactFloorPreview({
  garage,
  plan,
  variant,
  front,
  ramp,
  legendExtras = [],
  svgRef,
  testId,
}: ExactFloorPreviewProps) {
  const rawId = useId();
  // `useId` values can contain characters that are awkward inside `url(#…)`. Replacing them keeps
  // every id distinct, which stripping them would not.
  const hatchId = `cut-hatch-${rawId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const geometry = buildExactPreviewGeometry(garage, plan);
  const unit = Math.max(garage.widthInches, garage.lengthInches) / 100;
  const isDetailed = variant === 'detailed';
  const margin = isDetailed ? unit * 15 : unit * 1.5;
  const frontBandDepth = unit * 5;
  const product = plan.entry.seedProduct.product;
  const grid = plan.design.materialTileGrid;
  const clearance = plan.design.tileField.clearance;
  const edgeGaps = listEdgeGaps(plan.design);
  const rampDepthInches = Math.max(unit * 2.5, 3);
  const legendLines = [
    `${plan.entry.manufacturer.name} ${product.name}`,
    `${formatInches(product.dimensions.widthInches)} × ${formatInches(product.dimensions.lengthInches)} tiles · ` +
      `${String(grid.fullColumns)} × ${String(grid.fullRows)} whole tiles`,
    plan.roleColors
      .map(
        (roleColor) =>
          `${ROLE_LABELS[roleColor.role]}: ${roleColor.mapping.color?.name ?? 'unavailable'} (${String(roleColor.tileCount)})`
      )
      .join('   '),
    `Edge gaps: ${edgeGaps.map((gap) => `${gap.edge} ${formatGap(gap.inches)}`).join(', ')}`,
    `Outer walls ${formatInches(garage.widthInches)} × ${formatInches(garage.lengthInches)} · ` +
      `expansion clearance ${formatInches(clearance.leftInches)} left, ${formatInches(clearance.rightInches)} right, ` +
      `${formatInches(clearance.frontInches)} front, ${formatInches(clearance.backInches)} back · ` +
      `tile field ${formatInches(plan.design.tileField.widthInches)} × ${formatInches(plan.design.tileField.lengthInches)}`,
    ...(front === undefined ? [] : [`Front: ${describeFrontRun(front)}`]),
    ...legendExtras,
  ].filter((line) => line.length > 0);
  // Keep the longest legend line inside the drawing width instead of letting it run off the sheet.
  const longestLine = Math.max(...legendLines.map((line) => line.length));
  const legendFontSize = Math.min(unit * 5, garage.widthInches / (0.55 * longestLine));
  const legendLeading = legendFontSize * 1.7;
  const legendHeight = isDetailed ? legendLeading * legendLines.length + unit * 8 : 0;
  const totalWidth = garage.widthInches + margin * 2;
  const totalHeight = garage.lengthInches + margin * 2 + legendHeight;
  const label =
    `${plan.entry.manufacturer.name} ${product.name} laid out on a ` +
    `${formatInches(garage.widthInches)} by ${formatInches(garage.lengthInches)} floor: ` +
    `${String(grid.fullColumns)} whole tile columns by ` +
    `${String(grid.fullRows)} whole tile rows` +
    (geometry.hasCuts ? ', with cut edge strips shown hatched.' : ', with no cut edges.') +
    (front === undefined ? '' : ` ${front.description}`);

  return (
    <svg
      aria-label={label}
      className={`exact-preview exact-preview--${variant}`}
      data-testid={testId ?? 'exact-floor-preview'}
      ref={svgRef}
      role="img"
      viewBox={`0 0 ${String(totalWidth)} ${String(totalHeight)}`}
    >
      <defs>
        <pattern
          height={unit * 3}
          id={hatchId}
          patternTransform="rotate(45)"
          patternUnits="userSpaceOnUse"
          width={unit * 3}
        >
          <line
            stroke="#ffffff"
            strokeOpacity={0.5}
            strokeWidth={unit * 1.5}
            x1={0}
            x2={0}
            y1={0}
            y2={unit * 3}
          />
          <line
            stroke="#101418"
            strokeOpacity={0.72}
            strokeWidth={unit * 0.8}
            x1={0}
            x2={0}
            y1={0}
            y2={unit * 3}
          />
        </pattern>
      </defs>

      <rect fill={PAPER} height={totalHeight} width={totalWidth} x={0} y={0} />

      <g transform={`translate(${String(margin)} ${String(margin)})`}>
        <rect
          data-testid="exact-preview-clearance"
          fill={CLEARANCE}
          height={garage.lengthInches}
          width={garage.widthInches}
          x={0}
          y={0}
        />
        {geometry.rects.map((rect) => (
          <rect
            data-cut={rect.isCut ? 'true' : 'false'}
            data-role={rect.role}
            fill={rect.fill}
            height={rect.height}
            key={rect.key}
            width={rect.width}
            x={rect.x}
            y={rect.y}
          />
        ))}
        {geometry.rects
          .filter((rect) => rect.isCut)
          .map((rect) => (
            <rect
              fill={`url(#${hatchId})`}
              height={rect.height}
              key={`hatch-${rect.key}`}
              width={rect.width}
              x={rect.x}
              y={rect.y}
            />
          ))}

        {geometry.columnEdges.map((edge) => (
          <g key={`column-${String(edge)}`}>
            <line
              stroke="#ffffff"
              strokeOpacity={0.32}
              strokeWidth={unit * 0.24}
              x1={edge}
              x2={edge}
              y1={geometry.tileField.yInches}
              y2={geometry.tileField.yInches + geometry.tileField.lengthInches}
            />
            <line
              stroke="#101418"
              strokeOpacity={0.55}
              strokeWidth={unit * 0.1}
              x1={edge}
              x2={edge}
              y1={geometry.tileField.yInches}
              y2={geometry.tileField.yInches + geometry.tileField.lengthInches}
            />
          </g>
        ))}
        {geometry.rowEdges.map((edge) => (
          <g key={`row-${String(edge)}`}>
            <line
              stroke="#ffffff"
              strokeOpacity={0.32}
              strokeWidth={unit * 0.24}
              x1={geometry.tileField.xInches}
              x2={geometry.tileField.xInches + geometry.tileField.widthInches}
              y1={edge}
              y2={edge}
            />
            <line
              stroke="#101418"
              strokeOpacity={0.55}
              strokeWidth={unit * 0.1}
              x1={geometry.tileField.xInches}
              x2={geometry.tileField.xInches + geometry.tileField.widthInches}
              y1={edge}
              y2={edge}
            />
          </g>
        ))}

        {/* Ramps sit across the door openings only; a wall segment never carries one. */}
        {front === undefined || ramp === undefined || ramp === null || !isRampPlan(ramp)
          ? null
          : front.openings.map((opening) => (
              <rect
                data-testid={`exact-preview-ramp-${opening.id}`}
                fill={RAMP}
                fillOpacity={0.75}
                height={rampDepthInches}
                key={opening.id}
                stroke={INK}
                strokeWidth={unit * 0.2}
                width={opening.lengthInches}
                x={opening.startInches}
                y={0}
              >
                <title>
                  {`${opening.label}: ${String(
                    ramp.openings.find((entry) => entry.openingId === opening.id)
                      ?.segmentsRequired ?? 0
                  )} ${ramp.accessory.name} pieces`}
                </title>
              </rect>
            ))}

        <rect
          fill="none"
          height={garage.lengthInches}
          stroke={INK}
          strokeWidth={unit * 0.7}
          width={garage.widthInches}
          x={0}
          y={0}
        />

        {front === undefined || !isDetailed
          ? null
          : front.segments.map((segment) => (
              <g key={segment.id}>
                <rect
                  data-segment-kind={segment.kind}
                  data-testid={`exact-preview-front-${segment.id}`}
                  fill={segment.kind === 'opening' ? '#2a241b' : '#26333d'}
                  fillOpacity={segment.kind === 'opening' ? 1 : 0.82}
                  height={frontBandDepth}
                  stroke={INK}
                  strokeWidth={unit * 0.3}
                  width={segment.lengthInches}
                  x={segment.startInches}
                  y={-frontBandDepth - unit * 1.2}
                >
                  <title>{segment.accessibleDescription}</title>
                </rect>
                {isDetailed && segment.lengthInches >= unit * 20 ? (
                  <text
                    fill={INK}
                    fontFamily={DISPLAY_FONT}
                    fontSize={unit * 3.6}
                    textAnchor="middle"
                    x={segment.startInches + segment.lengthInches / 2}
                    y={-frontBandDepth * 0.4 - unit * 1.2}
                  >
                    {`${formatFrontInches(segment.lengthInches)} in`}
                  </text>
                ) : null}
              </g>
            ))}
      </g>

      {isDetailed ? (
        <>
          <text
            fill={INK}
            fontFamily={DISPLAY_FONT}
            fontSize={unit * 6}
            textAnchor="middle"
            x={margin + garage.widthInches / 2}
            y={margin * 0.35}
          >
            {`${formatInches(garage.widthInches)} wide · front edge`}
          </text>
          <text
            fill={INK}
            fontFamily={DISPLAY_FONT}
            fontSize={unit * 6}
            textAnchor="middle"
            transform={`rotate(-90 ${String(margin * 0.55)} ${String(margin + garage.lengthInches / 2)})`}
            x={margin * 0.55}
            y={margin + garage.lengthInches / 2}
          >
            {`${formatInches(garage.lengthInches)} long`}
          </text>

          <g
            transform={`translate(${String(margin)} ${String(margin + garage.lengthInches + unit * 9)})`}
          >
            {legendLines.map((line, index) => (
              <text
                fill={INK}
                fontFamily={DISPLAY_FONT}
                fontSize={index === 0 ? legendFontSize * 1.15 : legendFontSize}
                key={`${String(index)}-${line}`}
                x={0}
                y={index * legendLeading}
              >
                {line}
              </text>
            ))}
          </g>
        </>
      ) : null}
    </svg>
  );
}

function describeFrontRun(front: GarageFrontGeometry): string {
  return front.segments
    .map((segment) => `${segment.label} ${formatFrontInches(segment.lengthInches)} in`)
    .join(' · ');
}
