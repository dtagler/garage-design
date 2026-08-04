import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import {
  generateRoughDesignPreview,
  getTileFieldRectangle,
  type ConceptualGrid,
  type RoughDesignRole,
  type RoughDesignState,
} from '../../rough-design';
import { formatInches as formatFrontInches, type GarageFrontGeometry } from '../../garage-front';
import { ROLE_LABELS } from './plannerModel';

export interface GarageDesignCanvasProps {
  readonly state: RoughDesignState;
  readonly grid: ConceptualGrid;
  /** Wall and opening run along the front edge, always drawn as the horizontal top edge. */
  readonly front: GarageFrontGeometry;
  /** Painting turns the canvas into an editable surface for the custom pattern. */
  readonly isPaintEnabled: boolean;
  readonly activeRole: RoughDesignRole;
  readonly onPaintCell?: (column: number, row: number) => void;
  readonly cursor?: { readonly column: number; readonly row: number };
  readonly onCursorChange?: (cursor: { readonly column: number; readonly row: number }) => void;
}

const INK = '#dce6eb';
const PAPER = '#080d11';
const DISPLAY_FONT = "Bahnschrift, 'DIN Alternate', 'Roboto Condensed', sans-serif";
/** Conservative average glyph advance, in ems, for the condensed display font and its fallbacks. */
const GLYPH_ADVANCE_RATIO = 0.5;

/**
 * The one diagram for the garage-and-design section.
 *
 * It carries every decision made in that section at once: outer wall dimensions, the mandatory
 * expansion clearance ring, the rough pattern drawn inside the resulting tile field, and the run
 * of walls and door openings along the front. Drawing them together is the point - a door width
 * or a clearance change is meaningless without the floor it eats into.
 *
 * Everything is drawn in inches, so the clearance band and the door openings sit exactly where
 * they would be built rather than at a convenient pixel size.
 */
export function GarageDesignCanvas({
  state,
  grid,
  front,
  isPaintEnabled,
  activeRole,
  onPaintCell,
  cursor = { column: 0, row: 0 },
  onCursorChange,
}: GarageDesignCanvasProps) {
  const activePointerIdRef = useRef<number | null>(null);
  const paintedCellIndexesRef = useRef<Set<number>>(new Set());
  const preview = generateRoughDesignPreview(state, grid);
  const tileField = getTileFieldRectangle(state.garage, state.expansionClearance);
  const { widthInches, lengthInches } = state.garage;
  const unit = Math.max(widthInches, lengthInches) / 100;
  const margin = unit * 16;
  const bandDepth = unit * 6;
  const cellWidth = tileField.widthInches / grid.columns;
  const cellHeight = tileField.lengthInches / grid.rows;
  const totalWidth = widthInches + margin * 2;
  const totalHeight = lengthInches + margin * 2;
  // A grid can shrink when the garage proportions change, so a stored cursor is clamped back
  // inside it before it is drawn or painted.
  const safeCursor = {
    column: clamp(cursor.column, 0, grid.columns - 1),
    row: clamp(cursor.row, 0, grid.rows - 1),
  };
  const cursorRole =
    preview.cells[safeCursor.row * grid.columns + safeCursor.column]?.role ?? 'base';

  const paintCell = (cell: Readonly<{ column: number; row: number }>): void => {
    onCursorChange?.(cell);
    const index = cell.row * grid.columns + cell.column;
    if (paintedCellIndexesRef.current.has(index)) return;

    paintedCellIndexesRef.current.add(index);
    onPaintCell?.(cell.column, cell.row);
  };

  const finishPainting = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (activePointerIdRef.current !== event.pointerId) return;

    activePointerIdRef.current = null;
    paintedCellIndexesRef.current.clear();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const cellAtPointer = (
    event: ReactPointerEvent<SVGSVGElement>
  ): Readonly<{ column: number; row: number }> | null => {
    const matrix = event.currentTarget.getScreenCTM();
    if (matrix === null) return null;

    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const column = Math.floor((point.x - margin - tileField.xInches) / cellWidth);
    const row = Math.floor((point.y - margin - tileField.yInches) / cellHeight);
    if (column < 0 || column >= grid.columns || row < 0 || row >= grid.rows) return null;

    return { column, row };
  };

  const continuePainting = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (activePointerIdRef.current !== event.pointerId) return;
    if (event.pointerType === 'mouse' && (event.buttons & 1) === 0) {
      finishPainting(event);
      return;
    }

    const cell = cellAtPointer(event);
    if (cell !== null) paintCell(cell);
  };

  const moveCursor = (columnDelta: number, rowDelta: number): void => {
    onCursorChange?.({
      column: clamp(safeCursor.column + columnDelta, 0, grid.columns - 1),
      row: clamp(safeCursor.row + rowDelta, 0, grid.rows - 1),
    });
  };

  const description =
    `${describeDesign(state, grid)} Outer walls ${formatFrontInches(widthInches)} by ` +
    `${formatFrontInches(lengthInches)} inches, with ` +
    `${formatFrontInches(state.expansionClearance.leftInches)} inch expansion clearance on every ` +
    `side leaving a ${formatFrontInches(tileField.widthInches)} by ` +
    `${formatFrontInches(tileField.lengthInches)} inch tile field. ${front.description}`;

  // The run of segment labels grows with every door and wall, so it is measured against the
  // drawing width and condensed when it would otherwise be clipped by the viewBox.
  const frontRun = describeFrontRun(front);
  const frontRunWidthLimit = totalWidth * 0.96;
  const frontRunNaturalWidth = frontRun.length * unit * 4.4 * GLYPH_ADVANCE_RATIO;
  const frontRunOverflows = frontRunNaturalWidth > frontRunWidthLimit;
  const frontRunFontSize = frontRunOverflows
    ? Math.max(unit * 2.6, (unit * 4.4 * frontRunWidthLimit) / frontRunNaturalWidth)
    : unit * 4.4;

  return (
    <svg
      aria-label={
        isPaintEnabled
          ? `Garage and design plan. ${description} Cursor column ${safeCursor.column + 1}, row ${safeCursor.row + 1}, ${ROLE_LABELS[cursorRole].toLowerCase()}. Click or drag to paint the ${ROLE_LABELS[activeRole].toLowerCase()} color. Use the arrow keys to move and press Enter to paint one square.`
          : `Garage and design plan. ${description}`
      }
      aria-live={isPaintEnabled ? 'polite' : undefined}
      className="planner-canvas__svg"
      data-testid="garage-design-canvas"
      onLostPointerCapture={finishPainting}
      onPointerCancel={finishPainting}
      onPointerMove={isPaintEnabled ? continuePainting : undefined}
      onPointerUp={finishPainting}
      onKeyDown={(event) => {
        if (!isPaintEnabled) return;
        switch (event.key) {
          case 'ArrowLeft':
            event.preventDefault();
            moveCursor(-1, 0);
            return;
          case 'ArrowRight':
            event.preventDefault();
            moveCursor(1, 0);
            return;
          case 'ArrowUp':
            event.preventDefault();
            moveCursor(0, -1);
            return;
          case 'ArrowDown':
            event.preventDefault();
            moveCursor(0, 1);
            return;
          case 'Enter':
          case ' ':
            event.preventDefault();
            onPaintCell?.(safeCursor.column, safeCursor.row);
            return;
          default:
            return;
        }
      }}
      role={isPaintEnabled ? 'application' : 'img'}
      style={isPaintEnabled ? { cursor: 'crosshair', touchAction: 'none' } : undefined}
      tabIndex={isPaintEnabled ? 0 : -1}
      viewBox={`0 0 ${String(totalWidth)} ${String(totalHeight)}`}
    >
      <rect fill={PAPER} height={totalHeight} width={totalWidth} x={0} y={0} />

      <g transform={`translate(${String(margin)} ${String(margin)})`}>
        {/* The clearance ring is the whole slab minus the tile field, so it is drawn first. */}
        <rect
          data-testid="expansion-clearance-band"
          fill="#514631"
          fillOpacity={0.72}
          height={lengthInches}
          width={widthInches}
          x={0}
          y={0}
        />

        {preview.cells.map((cell) => (
          <rect
            data-role={cell.role}
            data-testid={`rough-cell-${String(cell.column)}-${String(cell.row)}`}
            fill={cell.displayColor.hex}
            height={cellHeight}
            key={cell.id}
            onPointerDown={
              isPaintEnabled
                ? (event) => {
                    if (activePointerIdRef.current !== null || event.button > 0) {
                      return;
                    }

                    event.preventDefault();
                    const svg = event.currentTarget.ownerSVGElement;
                    if (svg === null) return;

                    svg.focus();
                    activePointerIdRef.current = event.pointerId;
                    paintedCellIndexesRef.current = new Set();
                    svg.setPointerCapture?.(event.pointerId);
                    paintCell(cell);
                  }
                : undefined
            }
            onPointerEnter={
              isPaintEnabled
                ? (event) => {
                    if (
                      activePointerIdRef.current !== event.pointerId ||
                      (event.pointerType === 'mouse' && (event.buttons & 1) === 0)
                    ) {
                      return;
                    }
                    paintCell(cell);
                  }
                : undefined
            }
            stroke="#101418"
            strokeOpacity={0.42}
            strokeWidth={unit * 0.12}
            width={cellWidth}
            x={tileField.xInches + cell.column * cellWidth}
            y={tileField.yInches + cell.row * cellHeight}
          >
            {isPaintEnabled ? (
              <title>{`Column ${String(cell.column + 1)}, row ${String(cell.row + 1)}: ${ROLE_LABELS[cell.role]}`}</title>
            ) : null}
          </rect>
        ))}

        {isPaintEnabled ? (
          <>
            <rect
              fill="none"
              height={cellHeight}
              pointerEvents="none"
              stroke="#101418"
              strokeWidth={unit * 1.1}
              width={cellWidth}
              x={tileField.xInches + safeCursor.column * cellWidth}
              y={tileField.yInches + safeCursor.row * cellHeight}
            />
            <rect
              data-testid="rough-design-cursor"
              fill="none"
              height={cellHeight}
              pointerEvents="none"
              stroke="#ffb24d"
              strokeWidth={unit * 0.55}
              width={cellWidth}
              x={tileField.xInches + safeCursor.column * cellWidth}
              y={tileField.yInches + safeCursor.row * cellHeight}
            />
          </>
        ) : null}

        <rect
          fill="none"
          height={tileField.lengthInches}
          stroke={INK}
          strokeDasharray={`${String(unit * 1.6)} ${String(unit * 1.2)}`}
          strokeOpacity={0.6}
          strokeWidth={unit * 0.28}
          width={tileField.widthInches}
          x={tileField.xInches}
          y={tileField.yInches}
        />
        <rect
          fill="none"
          height={lengthInches}
          stroke={INK}
          strokeWidth={unit * 0.8}
          width={widthInches}
          x={0}
          y={0}
        />
      </g>

      {/* Front elevation band: the wall and opening run, above the front (top) wall line. */}
      <g transform={`translate(${String(margin)} ${String(margin - bandDepth - unit * 1.5)})`}>
        {front.segments.map((segment) => (
          <g key={segment.id}>
            <rect
              data-segment-kind={segment.kind}
              data-testid={`front-segment-${segment.id}`}
              fill={segment.kind === 'opening' ? '#2a241b' : '#26333d'}
              fillOpacity={segment.kind === 'opening' ? 1 : 0.82}
              height={bandDepth}
              stroke={INK}
              strokeWidth={unit * 0.35}
              width={segment.lengthInches}
              x={segment.startInches}
              y={0}
            >
              <title>{segment.accessibleDescription}</title>
            </rect>
            {segment.lengthInches >= unit * 22 ? (
              <text
                fill={INK}
                fontFamily={DISPLAY_FONT}
                fontSize={unit * 4.2}
                textAnchor="middle"
                x={segment.startInches + segment.lengthInches / 2}
                y={bandDepth * 0.66}
              >
                {`${formatFrontInches(segment.lengthInches)} in`}
              </text>
            ) : null}
          </g>
        ))}
      </g>

      <text
        data-testid="front-run-caption"
        fill={INK}
        fontFamily={DISPLAY_FONT}
        fontSize={frontRunFontSize}
        lengthAdjust={frontRunOverflows ? 'spacingAndGlyphs' : undefined}
        textAnchor="middle"
        textLength={frontRunOverflows ? frontRunWidthLimit : undefined}
        x={margin + widthInches / 2}
        y={margin - bandDepth - unit * 3.5}
      >
        {frontRun}
      </text>

      <text
        fill={INK}
        fontFamily={DISPLAY_FONT}
        fontSize={unit * 5}
        textAnchor="middle"
        x={margin + widthInches / 2}
        y={totalHeight - margin * 0.35}
      >
        {`${formatFrontInches(widthInches)} in wide across the front · ` +
          `${formatFrontInches(state.expansionClearance.leftInches)} in expansion clearance all round`}
      </text>

      <text
        fill={INK}
        fontFamily={DISPLAY_FONT}
        fontSize={unit * 5}
        textAnchor="middle"
        transform={`rotate(-90 ${String(margin * 0.55)} ${String(margin + lengthInches / 2)})`}
        x={margin * 0.55}
        y={margin + lengthInches / 2}
      >
        {`${formatFrontInches(lengthInches)} in deep`}
      </text>
    </svg>
  );
}

/** "15 in wall · 94 in door · 12 in center wall · …" for the caption above the front band. */
function describeFrontRun(front: GarageFrontGeometry): string {
  return front.segments
    .map((segment) => `${segment.label} ${formatFrontInches(segment.lengthInches)} in`)
    .join(' · ');
}

function describeDesign(state: RoughDesignState, grid: ConceptualGrid): string {
  const shape = state.type === 'custom' ? `custom ${state.customBaseType ?? 'solid'}` : state.type;
  return (
    `A ${shape.replaceAll('-', ' ')} rough design on a ${String(grid.columns)} by ` +
    `${String(grid.rows)} concept grid.`
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
