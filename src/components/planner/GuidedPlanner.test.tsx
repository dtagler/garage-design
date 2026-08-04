import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GuidedPlanner } from './GuidedPlanner';
import {
  EMPTY_PERSISTED_ROUGH_PLANS,
  upsertRoughPlan,
  type PersistedRoughPlansV1,
  type RoughPlanDocument,
  type StorageLike,
} from '../../persistence';
import { createRoughDesignState, ROUGH_PATTERN_PRESETS } from '../../rough-design';

const NOW = () => new Date('2026-07-29T12:00:00.000Z');
const RIBTRAX = 'Ribtrax PRO (Standard Colors)';
const FREE_FLOW = 'RaceDeck Free-Flow';
const TURBOTILE = 'TurboTile Perforated Garage Floor Tile 5/8 Inch x 1x1 Ft.';

function createMemoryStorage(seed: Readonly<Record<string, string>> = {}): StorageLike {
  const values = new Map(Object.entries(seed));

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

function renderPlanner(storage: StorageLike = createMemoryStorage()) {
  return {
    user: userEvent.setup(),
    storage,
    ...render(<GuidedPlanner now={NOW} storage={storage} />),
  };
}

function designSection(): HTMLElement {
  return screen.getByRole('region', { name: 'Garage & design' });
}

function tileSection(): HTMLElement {
  return screen.getByRole('region', { name: 'Drainable tile options' });
}

function summarySection(): HTMLElement {
  return screen.getByRole('region', { name: 'Project summary' });
}

function twoColumnLayouts(): readonly HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('.planner__two-column')];
}

async function selectProduct(
  user: ReturnType<typeof userEvent.setup>,
  productName = FREE_FLOW
): Promise<void> {
  await user.click(within(tileSection()).getByRole('radio', { name: productName }));
}

describe('GuidedPlanner page shape', () => {
  it('puts the garage, doors, and rough design on one page with no stepper', () => {
    renderPlanner();

    expect(screen.getByRole('heading', { level: 2, name: 'Garage & design' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'Drainable tile options' })).toBeVisible();
    expect(screen.queryByRole('navigation', { name: /planner steps/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^step \d/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^continue to/i })).toBeNull();

    const design = within(designSection());
    expect(design.getByLabelText('Garage width (inches, front wall)')).toBeVisible();
    expect(design.getByLabelText('Door configuration')).toBeVisible();
    expect(design.getByLabelText('Search designs')).toBeVisible();
    expect(design.getByLabelText('Base color')).toBeVisible();
  });

  it('lays every section out in at most two columns, controls left and one diagram right', async () => {
    const { user } = renderPlanner();
    await selectProduct(user);

    expect(twoColumnLayouts()).toHaveLength(3);
    for (const layout of twoColumnLayouts()) {
      expect(layout.children).toHaveLength(2);
      expect(getComputedStyle(layout).gridTemplateColumns.split(' ')).not.toHaveLength(3);
    }

    const [designColumns, tileColumns, summaryColumns] = twoColumnLayouts();
    expect(designColumns.children[0]).toHaveClass('planner__controls');
    expect(designColumns.children[1]).toContainElement(screen.getByTestId('garage-design-canvas'));

    // Explorer: a scrollable list on the left, exactly one preview on the right.
    expect(tileColumns.children[0]).toBe(screen.getByTestId('planner-product-list'));
    expect(tileColumns.children[1]).toBe(screen.getByTestId('planner-product-detail'));

    expect(summaryColumns.children[0]).toHaveClass('planner__details-column');
    expect(summaryColumns.children[1]).toContainElement(
      screen.getByTestId('summary-floor-preview')
    );
  });

  it('draws exactly one diagram in the garage and design section', () => {
    renderPlanner();

    const canvases = within(designSection()).getAllByTestId('planner-canvas');
    expect(canvases).toHaveLength(1);
    expect(canvases[0]).toContainElement(screen.getByTestId('garage-design-canvas'));
  });
});

describe('GuidedPlanner garage defaults', () => {
  it('starts at 230 inches across the front by 246 inches deep with a one-inch clearance', () => {
    renderPlanner();
    const design = within(designSection());

    expect(design.getByLabelText('Garage width (inches, front wall)')).toHaveValue('230');
    expect(design.getByLabelText('Garage length (inches, front to back)')).toHaveValue('246');
    expect(design.getByLabelText('Expansion clearance (inches per side)')).toHaveValue('1');
    expect(screen.getByTestId('planner-tile-field')).toHaveTextContent(
      'Tile field 228 in × 244 in inside 230 in × 246 in walls.'
    );
  });

  it('defaults to two 94 inch doors split by a 12 inch center wall on the horizontal front edge', () => {
    renderPlanner();
    const design = within(designSection());

    expect(design.getByLabelText('Door configuration')).toHaveValue('two-single-doors');
    expect(design.getByLabelText('Each door opening (inches)')).toHaveValue('94');
    expect(design.getByLabelText('Wall between doors (inches)')).toHaveValue('12');
    expect(design.getByLabelText('Left wall (inches)')).toHaveValue('15');
    expect(design.getByLabelText('Right wall (inches)')).toHaveValue('15');
    expect(screen.getByTestId('planner-front-summary')).toHaveTextContent(
      '2 door openings need 188 inches of front transition ramp'
    );

    const canvas = screen.getByTestId('garage-design-canvas');
    const segments = [...canvas.querySelectorAll('[data-testid^="front-segment-"]')];
    expect(segments.map((segment) => segment.getAttribute('width'))).toEqual([
      '15',
      '94',
      '12',
      '94',
      '15',
    ]);
    // Openings run along the horizontal top edge: same y, increasing x.
    expect(new Set(segments.map((segment) => segment.getAttribute('y')))).toEqual(new Set(['0']));
    expect(segments.map((segment) => Number(segment.getAttribute('x')))).toEqual([
      0, 15, 109, 121, 215,
    ]);
    expect(canvas.getAttribute('aria-label')).toContain('Door opening 1 94 in');
    expect(canvas.getAttribute('aria-label')).toContain(
      '2 door openings need 188 inches of front transition ramp'
    );
  });

  it('keeps the front consistent when a door opening is widened', async () => {
    const { user } = renderPlanner();
    const doorWidth = within(designSection()).getByLabelText('Each door opening (inches)');

    await user.clear(doorWidth);
    await user.type(doorWidth, '100');

    expect(within(designSection()).getByLabelText('Left wall (inches)')).toHaveValue('9');
    expect(screen.getByTestId('planner-front-summary')).toHaveTextContent('200 inches of front');
  });

  it('rejects a door that cannot fit the wall instead of drawing a broken front', async () => {
    const { user } = renderPlanner();
    const doorWidth = within(designSection()).getByLabelText('Each door opening (inches)');

    await user.clear(doorWidth);
    await user.type(doorWidth, '120');

    expect(within(designSection()).getByRole('alert')).toHaveTextContent(/cannot be negative/i);
  });

  it('supports a custom run of walls and openings', async () => {
    const { user } = renderPlanner();
    const design = within(designSection());
    await user.selectOptions(design.getByLabelText('Door configuration'), 'custom');

    const firstWidth = design.getByLabelText('Segment 1 width in inches');
    await user.clear(firstWidth);
    await user.type(firstWidth, '20');

    expect(design.getByRole('alert')).toHaveTextContent(/total 235 inches/);

    const lastWidth = design.getByLabelText('Segment 5 width in inches');
    await user.clear(lastWidth);
    await user.type(lastWidth, '10');

    expect(design.queryByRole('alert')).toBeNull();
    expect(screen.getByTestId('planner-front-summary')).toHaveTextContent('Left wall 20 in');
  });

  it('refuses a dimension the model cannot use and hides the tile options', async () => {
    const { user } = renderPlanner();
    const width = within(designSection()).getByLabelText('Garage width (inches, front wall)');

    await user.clear(width);
    await user.type(width, '12');

    expect(await screen.findByText(/48 to 1000 inches/)).toBeVisible();
    expect(width).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('heading', { level: 2, name: 'Drainable tile options' })).toBeNull();
  });

  it('recomputes the tile field when the expansion clearance changes', async () => {
    const { user } = renderPlanner();
    const clearance = within(designSection()).getByLabelText(
      'Expansion clearance (inches per side)'
    );

    await user.clear(clearance);
    await user.type(clearance, '2');

    expect(screen.getByTestId('planner-tile-field')).toHaveTextContent(
      'Tile field 226 in × 242 in'
    );
  });

  it('reports an oversized clearance without crashing or discarding the planner', async () => {
    const { user } = renderPlanner();
    const clearance = within(designSection()).getByLabelText(
      'Expansion clearance (inches per side)'
    );

    await user.clear(clearance);
    await user.type(clearance, '115');

    expect(screen.getByRole('alert')).toHaveTextContent(/positive-width, positive-length/i);
    expect(screen.getByRole('heading', { level: 2, name: 'Garage & design' })).toBeVisible();
    expect(screen.queryByRole('heading', { level: 2, name: 'Drainable tile options' })).toBeNull();
  });

  it('rejects dimensions that are too small for the current clearance without crashing', async () => {
    const { user } = renderPlanner();
    const clearance = within(designSection()).getByLabelText(
      'Expansion clearance (inches per side)'
    );
    const width = within(designSection()).getByLabelText('Garage width (inches, front wall)');

    await user.clear(clearance);
    await user.type(clearance, '24');
    await user.clear(width);
    await user.type(width, '48');

    expect(screen.getByRole('alert')).toHaveTextContent(/positive-width, positive-length/i);
    expect(screen.getByRole('heading', { level: 2, name: 'Garage & design' })).toBeVisible();
  });
});

describe('GuidedPlanner pattern library', () => {
  it('offers the full preset library plus a custom option, with thumbnails', () => {
    renderPlanner();
    const presets = within(screen.getByTestId('planner-preset-list')).getAllByRole('radio');

    expect(ROUGH_PATTERN_PRESETS).toHaveLength(250);
    expect(presets).toHaveLength(250);
    expect(screen.getAllByRole('radio', { name: /^Custom/ })).toHaveLength(1);
    expect(
      within(screen.getByTestId('planner-preset-list')).getAllByTestId(/^planner-preset-thumbnail-/)
    ).toHaveLength(250);
    expect(screen.getByTestId('planner-preset-thumbnail-nested-diamonds')).toBeVisible();
    expect(screen.getByTestId('planner-preset-count')).toHaveTextContent(
      '250 of 250 designs shown.'
    );
  });

  it('filters the presets by category and by search', async () => {
    const { user } = renderPlanner();
    const list = () => within(screen.getByTestId('planner-preset-list')).queryAllByRole('radio');

    await user.selectOptions(screen.getByLabelText('Pattern category'), 'checkers-grids');
    expect(list()).toHaveLength(54);
    expect(screen.getByTestId('planner-preset-count')).toHaveTextContent(
      '54 of 250 designs shown.'
    );

    await user.selectOptions(screen.getByLabelText('Pattern category'), 'all');
    await user.type(screen.getByLabelText('Search designs'), 'chevron');
    expect(list().length).toBeGreaterThan(0);
    expect(list().length).toBeLessThan(250);

    await user.clear(screen.getByLabelText('Search designs'));
    await user.type(screen.getByLabelText('Search designs'), 'nothing matches this');
    expect(list()).toHaveLength(0);
    expect(screen.getByTestId('planner-preset-count')).toHaveTextContent(
      'No design matches that search. Clear it to see all 250.'
    );

    await user.selectOptions(screen.getByLabelText('Pattern category'), 'checkers-grids');
    expect(screen.getByTestId('planner-preset-count')).toHaveTextContent(
      'No design matches that search. Clear it to see all 54.'
    );
  });

  it('redraws the one diagram when a preset is chosen', async () => {
    const { user } = renderPlanner();
    const canvas = () => screen.getByTestId('garage-design-canvas');
    const roleCount = (role: string): number =>
      canvas().querySelectorAll(`[data-role="${role}"]`).length;

    expect(roleCount('accent')).toBe(0);
    await user.click(screen.getByRole('radio', { name: /^Nested Diamonds/ }));
    expect(roleCount('accent')).toBeGreaterThan(0);
    expect(screen.getAllByTestId('garage-design-canvas')).toHaveLength(1);
  });

  it('paints custom squares with the pointer and the keyboard', async () => {
    const { user } = renderPlanner();
    await user.click(screen.getByRole('radio', { name: /^Custom/ }));

    const canvas = screen.getByTestId('garage-design-canvas');
    expect(canvas).toHaveAttribute('role', 'application');
    await user.click(screen.getByRole('radio', { name: 'Secondary' }));
    await user.click(screen.getByTestId('rough-cell-2-1'));
    expect(screen.getByTestId('rough-cell-2-1')).toHaveAttribute('data-role', 'secondary');
    expect(canvas).toHaveFocus();

    fireEvent.pointerDown(screen.getByTestId('rough-cell-3-1'), {
      button: 2,
      buttons: 2,
    });
    fireEvent.pointerDown(screen.getByTestId('rough-cell-4-1'), {
      button: 1,
      buttons: 4,
    });
    expect(screen.getByTestId('rough-cell-3-1')).toHaveAttribute('data-role', 'base');
    expect(screen.getByTestId('rough-cell-4-1')).toHaveAttribute('data-role', 'base');

    await user.click(screen.getByRole('radio', { name: 'Accent' }));
    canvas.focus();
    await user.keyboard('{ArrowRight}{ArrowDown}{Enter}');
    expect(screen.getByTestId('rough-cell-3-2')).toHaveAttribute('data-role', 'accent');

    await user.click(screen.getByRole('radio', { name: 'Secondary' }));
    fireEvent.pointerDown(screen.getByTestId('rough-cell-4-3'), { buttons: 1 });
    fireEvent.pointerEnter(screen.getByTestId('rough-cell-5-3'), { buttons: 1 });
    fireEvent.pointerEnter(screen.getByTestId('rough-cell-6-3'), { buttons: 1 });
    fireEvent.pointerUp(canvas);
    expect(screen.getByTestId('rough-cell-4-3')).toHaveAttribute('data-role', 'secondary');
    expect(screen.getByTestId('rough-cell-5-3')).toHaveAttribute('data-role', 'secondary');
    expect(screen.getByTestId('rough-cell-6-3')).toHaveAttribute('data-role', 'secondary');

    await user.click(screen.getByRole('button', { name: /clear painted squares/i }));
    expect(screen.getByTestId('rough-cell-2-1')).toHaveAttribute('data-role', 'base');
  });

  it('changes a role color from the brand-neutral palette', async () => {
    const { user } = renderPlanner();
    await user.click(screen.getByRole('radio', { name: /^Checkerboard/ }));
    await user.selectOptions(screen.getByLabelText('Accent color'), '#1a1a1a');

    expect(
      screen.getByTestId('garage-design-canvas').querySelector('[data-role="accent"]')
    ).toHaveAttribute('fill', '#1a1a1a');
  });
});

describe('GuidedPlanner drainable tile options', () => {
  it('lists only verified drainable tiles and no closed-surface product', () => {
    renderPlanner();
    const tiles = within(tileSection());

    expect(tiles.getAllByRole('radio')).toHaveLength(10);
    for (const name of [
      RIBTRAX,
      FREE_FLOW,
      'RaceDeck Free-Flow XLC',
      'RaceDeck GarageFlow',
      'Interlocking Drainage Mat (nominal 12 x 12 in)',
      'Perforated Garage Floor Tiles - Drain (12 x 12 in)',
      TURBOTILE,
      'Nitro Garage Floor Tiles - Vented Pattern (12 x 12 in)',
      'Vented Grid-Loc Garage Floor Tiles (12 x 12 in)',
      'HD/HDXT Ribbed Flow Through Tile (12 x 12 in)',
    ]) {
      expect(tiles.getByRole('radio', { name })).toBeInTheDocument();
    }

    for (const hidden of [
      /Diamondtrax/i,
      /Ribtrax Smooth/i,
      /RaceDeck XL/i,
      /TuffShield/i,
      /CircleTrac/i,
      /TechFloor/i,
      /Diamond Plate/i,
    ]) {
      expect(screen.queryByText(hidden)).toBeNull();
    }
  });

  it('shows brand, style, size, colors, cost, sale options, and drainage on each row', () => {
    renderPlanner();
    const option = within(screen.getByTestId('planner-product-option-racedeck-free-flow'));

    expect(option.getByText('RaceDeck')).toBeVisible();
    expect(option.getByText(FREE_FLOW)).toBeVisible();
    expect(option.getByText('Self-Draining')).toBeVisible();
    expect(option.getByText('12 in × 12 in × 0.50 in thick')).toBeVisible();
    expect(option.getByText(/17 colors: Alloy, Beige/)).toBeVisible();
    expect(option.getByText(/From \$3\.99 per tile · \$1,751\.61 for this design/)).toBeVisible();
    expect(option.getByText(/per tile from RaceDeck \(individual tiles verified\)/)).toBeVisible();
    expect(option.getByText(/Open-grid, self-draining\./)).toBeVisible();
  });

  it('shows VEVOR drainage-mat caveats, verified ramps, and no invented individual tiles', async () => {
    const { user } = renderPlanner();
    const option = screen.getByTestId(
      'planner-product-option-vevor-interlocking-drainage-mat-12in'
    );

    await user.click(within(option).getByRole('radio'));

    expect(
      within(option).getByText(
        /per pack of 12 tiles from Vevor; per pack of 24 tiles from Vevor; per pack of 40 tiles from Vevor; per pack of 50 tiles from Vevor; per pack of 55 tiles from Vevor/
      )
    ).toBeVisible();
    expect(screen.getAllByText(/no numeric load rating/i)).toHaveLength(2);
    expect(screen.getAllByText(/model code implies 30 cm \/ 11\.81 in/i)).toHaveLength(2);
    expect(screen.getByText('No verified individual listing')).toBeVisible();
    expect(
      screen.getAllByText(/VEVOR Transition Edge Kit, 11-Piece, Durable Straight/i).length
    ).toBeGreaterThan(0);
    expect(screen.getByText(/kits of 11 pieces, 2 required/i)).toBeVisible();
    expect(
      within(screen.getByTestId('planner-ramp-caveats')).getByText(
        /attaches only to the tile's female edge/i
      )
    ).toBeVisible();
  });

  it('loads the seller-hosted product photo with its attribution and link', () => {
    renderPlanner();
    const option = within(screen.getByTestId('planner-product-option-racedeck-free-flow'));
    const photo = option.getByRole('img');

    expect(photo).toHaveAttribute(
      'src',
      'https://racedeck.com/wp-content/uploads/2020/08/free-flow-garage.webp'
    );
    expect(photo.getAttribute('alt')?.length).toBeGreaterThan(30);
    expect(option.getByText(/\(c\)/)).toBeVisible();
    expect(option.getByRole('link', { name: /view on racedeck/i })).toHaveAttribute(
      'href',
      'https://racedeck.com/racedeck-garage-floors-and-tiles/free-flow/'
    );
  });

  it('falls back to generated artwork when the remote photo cannot load', () => {
    renderPlanner();
    const option = within(screen.getByTestId('planner-product-option-racedeck-free-flow'));

    fireEvent.error(option.getByRole('img'));

    expect(option.getByText(/photo unavailable/i)).toBeVisible();
    expect(option.getByRole('img', { name: /perforated, self-draining/i })).toBeInTheDocument();
    expect(option.queryByRole('img', { name: /^RaceDeck Free-Flow tiles/ })).toBeNull();
  });

  it('previews the hovered product on the right without selecting it', async () => {
    const { user } = renderPlanner();

    await user.hover(screen.getByTestId('planner-product-option-modutile-perforated-garage-tile'));

    expect(
      within(screen.getByTestId('planner-product-detail')).getByRole('heading')
    ).toHaveTextContent('ModuTile Perforated Garage Floor Tiles - Drain (12 x 12 in)');
    expect(screen.queryByRole('heading', { level: 2, name: 'Project summary' })).toBeNull();
  });

  it('details the mapped design, grid, clearance, cuts, packages, cost, ramps, and dates', async () => {
    const { user } = renderPlanner();
    await user.hover(screen.getByTestId('planner-product-option-racedeck-free-flow'));
    const detail = within(screen.getByTestId('planner-product-detail'));

    expect(detail.getAllByTestId('planner-product-preview')).toHaveLength(1);
    expect(detail.getByText(/Base: Alloy/)).toBeVisible();
    expect(detail.getByText('19 × 20 whole tiles, 19 × 21 including cut edges')).toBeVisible();
    expect(
      detail.getByText(/1 in left, 1 in right, 1 in front, 1 in back; tile field 228 in × 244 in/)
    ).toBeVisible();
    expect(detail.getByText(/^Cutting required:/)).toBeVisible();
    expect(
      detail.getByText(/No verified package offer · 439 individual tiles · 0 left over/)
    ).toBeVisible();
    expect(detail.getByText('$1,751.61')).toBeVisible();
    expect(detail.getByText(/Female edge.*\$31\.84 estimated/)).toBeVisible();
    expect(detail.getByText(/2026-07-28 \(dimensions and colors\)/)).toBeVisible();
  });

  it('disables a tile that cannot supply a color the design needs', async () => {
    const { user } = renderPlanner();
    await user.click(screen.getByRole('radio', { name: /^Checkerboard/ }));

    const option = within(
      screen.getByTestId('planner-product-option-greatmats-turbotile-perforated')
    );
    expect(option.getByRole('radio')).toBeDisabled();
    expect(option.getByText('Blue is unavailable for this product.')).toBeVisible();

    await user.hover(screen.getByTestId('planner-product-option-greatmats-turbotile-perforated'));
    expect(
      within(screen.getByTestId('planner-product-detail')).getByRole('button', {
        name: `Use ${TURBOTILE}`,
      })
    ).toBeDisabled();
  });
});

describe('GuidedPlanner progressive reveal', () => {
  it('reveals the summary only after a valid tile is selected, keeping the sections above', async () => {
    const { user } = renderPlanner();

    expect(screen.queryByRole('heading', { level: 2, name: 'Project summary' })).toBeNull();
    await user.click(screen.getByRole('radio', { name: /^Border/ }));
    await selectProduct(user);

    expect(screen.getByRole('heading', { level: 2, name: 'Project summary' })).toBeVisible();
    expect(within(designSection()).getByLabelText('Garage width (inches, front wall)')).toHaveValue(
      '230'
    );
    expect(screen.getByRole('radio', { name: /^Border/ })).toBeChecked();
    expect(within(tileSection()).getByRole('radio', { name: FREE_FLOW })).toBeChecked();
  });

  it('keeps the selection while the design above is edited', async () => {
    const { user } = renderPlanner();
    await selectProduct(user);

    const width = within(designSection()).getByLabelText('Garage width (inches, front wall)');
    await user.clear(width);
    await user.type(width, '288');

    expect(screen.getByTestId('planner-cut-statement')).toHaveTextContent(
      'Cutting required: 23 whole tiles leave 10 in across the 286 in tile-field width'
    );
    expect(within(tileSection()).getByRole('radio', { name: FREE_FLOW })).toBeChecked();
  });
});

describe('GuidedPlanner project summary', () => {
  it('states the outer garage, tile field, clearance, front edge, and openings', async () => {
    const { user } = renderPlanner();
    await selectProduct(user);
    const geometry = within(
      screen.getByRole('region', { name: 'Garage, clearance, and openings' })
    );

    expect(geometry.getByText('230 in across the front × 246 in deep')).toBeVisible();
    expect(geometry.getByText('228 in × 244 in')).toBeVisible();
    expect(geometry.getByText('1 in left, 1 in right, 1 in front, 1 in back')).toBeVisible();
    expect(geometry.getByText(/horizontal top edge of the diagram/)).toBeVisible();
    expect(
      within(screen.getByTestId('planner-front-segments'))
        .getAllByRole('listitem')
        .map((item) => item.textContent)
    ).toEqual([
      'Left wall: 15 in',
      'Door opening 1: 94 in',
      'Center wall: 12 in',
      'Door opening 2: 94 in',
      'Right wall: 15 in',
    ]);
  });

  it('shows required tiles, waste, purchases, leftovers, and the least-cost combination', async () => {
    const { user } = renderPlanner();
    await selectProduct(user);
    const table = within(screen.getByTestId('planner-purchase-table'));

    expect(table.getByText('439 (399 placed + 40 waste)')).toBeVisible();
    expect(table.getByText('No verified package offer')).toBeVisible();
    expect(table.getByText('439 verified')).toBeVisible();
    expect(table.getByText('$1,751.61')).toBeVisible();
    expect(
      screen.getByText(/Lowest verified cost uses 439 individual tiles with no leftovers/)
    ).toBeVisible();
    expect(screen.getByText(/Seller: RaceDeck\./)).toBeVisible();
  });

  it('plans ramps per door opening, never across the center wall', async () => {
    const { user } = renderPlanner();
    await selectProduct(user);
    const ramps = within(screen.getByRole('region', { name: 'Front transition ramps' }));
    const openings = within(screen.getByTestId('planner-ramp-openings')).getAllByRole('listitem');

    expect(openings).toHaveLength(2);
    expect(openings[0]).toHaveTextContent(
      'Door opening 1 spans 94 inches and needs 8 ramp pieces (96 inches, 2 inches left over).'
    );
    expect(ramps.getByText(/individual pieces, 16 required/)).toBeVisible();
    expect(ramps.getByText('$31.84')).toBeVisible();
    expect(ramps.getByText(/4 in total, including 0 unused straight pieces/)).toBeVisible();
    expect(screen.queryByTestId('planner-ramp-unavailable')).toBeNull();
  });

  it('reports full tiles, cut tiles, cut strips, and the combined total', async () => {
    const { user } = renderPlanner();
    await selectProduct(user);
    const cuts = within(screen.getByRole('region', { name: 'Cuts and totals' }));

    expect(cuts.getByText('380')).toBeVisible();
    expect(cuts.getByText('19')).toBeVisible();
    expect(cuts.getByText('19 × back: 12 in × 4 in')).toBeVisible();
    expect(cuts.getByText('Yes')).toBeVisible();
    expect(cuts.getByText('$1,751.61')).toBeVisible();
    expect(screen.getByTestId('planner-total-cost')).toHaveTextContent('$1,783.45');
    expect(screen.getByTestId('planner-cut-statement')).toHaveTextContent(/^Cutting required:/);
  });

  it('draws one exportable diagram carrying the doors, ramps, clearance, and packages', async () => {
    const { user } = renderPlanner();
    await selectProduct(user);
    const diagram = screen.getByTestId('summary-floor-preview');

    expect(within(summarySection()).getAllByTestId('planner-canvas')).toHaveLength(1);
    expect(diagram.querySelectorAll('[data-testid^="exact-preview-ramp-"]')).toHaveLength(2);
    expect(diagram.querySelectorAll('[data-segment-kind="opening"]')).toHaveLength(2);
    expect(diagram.querySelector('[data-testid="exact-preview-clearance"]')).not.toBeNull();

    const legend = [...diagram.querySelectorAll('text')].map((node) => node.textContent).join(' ');
    expect(legend).toContain('expansion clearance 1 in left');
    expect(legend).toContain('Door opening 1 94 in');
    expect(legend).toContain('439 purchased, 0 left over');
    expect(legend).toContain('Ramps:');
    expect(legend).toContain('Sources checked:');
    // A remote photograph must never reach an exported drawing.
    expect(diagram.querySelectorAll('image, img')).toHaveLength(0);
  });

  it('lists dated sources and keeps the export controls', async () => {
    const { user } = renderPlanner();
    await selectProduct(user);
    const sources = within(screen.getByRole('region', { name: 'Sources and checked dates' }));

    expect(sources.getAllByText(/checked 2026-07-2\d/).length).toBeGreaterThan(0);
    expect(sources.getByText(/estimates for planning only/i)).toBeVisible();
    expect(sources.getAllByText(/not affiliated with/i).length).toBeGreaterThan(0);

    const exports = within(screen.getByRole('region', { name: /export design/i }));
    expect(exports.getByRole('button', { name: /download high-resolution png/i })).toBeEnabled();
    expect(exports.getByRole('button', { name: /open printable report/i })).toBeEnabled();
  });

  it('recalculates everything when a different tile is chosen', async () => {
    const { user } = renderPlanner();
    await selectProduct(user, RIBTRAX);

    expect(within(summarySection()).getByText('15.75 in × 15.75 in × 0.75 in thick')).toBeVisible();
    expect(screen.getByTestId('planner-total-cost')).toHaveTextContent('$2,305.80');
  });
});

describe('GuidedPlanner saved plans', () => {
  it('saves a named plan, restores it on the next visit, and deletes it', async () => {
    const storage = createMemoryStorage();
    const first = renderPlanner(storage);
    await first.user.click(screen.getByRole('radio', { name: /^Checkerboard/ }));
    await selectProduct(first.user);
    await first.user.type(screen.getByLabelText('Plan name'), 'Two car checkerboard');
    await first.user.click(screen.getByRole('button', { name: 'Save plan' }));

    expect(screen.getByRole('status')).toHaveTextContent('Saved "Two car checkerboard".');
    first.unmount();

    const second = renderPlanner(storage);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Restored your last plan, "Two car checkerboard".'
    );
    expect(screen.getByRole('radio', { name: /^Checkerboard/ })).toBeChecked();
    expect(screen.getByRole('heading', { level: 2, name: 'Project summary' })).toBeVisible();

    await second.user.click(screen.getByRole('button', { name: 'Delete Two car checkerboard' }));
    expect(screen.getByRole('status')).toHaveTextContent('Deleted "Two car checkerboard".');
    expect(screen.getByText(/no plans are saved in this browser yet/i)).toBeVisible();
  });

  it('reopens a saved plan and keeps its door configuration', async () => {
    const { user } = renderPlanner();
    await selectProduct(user);
    const doorWidth = within(designSection()).getByLabelText('Each door opening (inches)');
    await user.clear(doorWidth);
    await user.type(doorWidth, '90');
    await user.type(screen.getByLabelText('Plan name'), 'Ninety inch doors');
    await user.click(screen.getByRole('button', { name: 'Save plan' }));

    await user.clear(doorWidth);
    await user.type(doorWidth, '96');
    await user.click(screen.getByRole('button', { name: 'Open Ninety inch doors' }));

    expect(screen.getByRole('status')).toHaveTextContent('Opened "Ninety inch doors".');
    expect(within(designSection()).getByLabelText('Each door opening (inches)')).toHaveValue('90');
  });

  it('restores and preserves the saved waste allowance instead of replacing it with the default', async () => {
    const saved: RoughPlanDocument = {
      id: 'five-percent-plan',
      name: 'Five percent plan',
      createdAt: '2026-07-29T12:00:00.000Z',
      updatedAt: '2026-07-29T12:00:00.000Z',
      design: createRoughDesignState(),
      selectedProductId: 'racedeck-free-flow',
      wasteAllowancePercent: 5,
    };
    const storage = createMemoryStorage({
      'garage-floor-design/rough-plans': JSON.stringify(
        upsertRoughPlan(EMPTY_PERSISTED_ROUGH_PLANS, saved)
      ),
    });

    const { user } = renderPlanner(storage);

    expect(screen.getByTestId('planner-purchase-table').querySelector('caption')).toHaveTextContent(
      'including a 5% waste allowance'
    );

    await user.click(screen.getByRole('radio', { name: /^Checkerboard/ }));
    await waitFor(() => {
      const stored = JSON.parse(
        storage.getItem('garage-floor-design/rough-plans') ?? 'null'
      ) as PersistedRoughPlansV1 | null;
      expect(stored?.activePlan?.wasteAllowancePercent).toBe(5);
    });
  });

  it('reopens a plan whose solid tile is now hidden at the drainable options, with a reason', async () => {
    const storage = createMemoryStorage({
      'garage-floor-design/rough-plans': JSON.stringify(
        upsertRoughPlan(EMPTY_PERSISTED_ROUGH_PLANS, solidProductPlan())
      ),
    });
    const { user } = renderPlanner(storage);
    await selectProduct(user);
    await user.click(screen.getByRole('button', { name: 'Open Old solid plan' }));

    expect(screen.getByRole('status')).toHaveTextContent(
      'Opened "Old solid plan". Its tile is not one of the drainable options this planner offers, so choose a drainable tile below.'
    );
    expect(screen.queryByRole('heading', { level: 2, name: 'Project summary' })).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Drainable tile options' })).toBeVisible();
  });

  it('restores an active plan with a hidden solid tile at the tile options', () => {
    const storage = createMemoryStorage({
      'garage-floor-design/rough-plans': JSON.stringify({
        schemaVersion: 4,
        activePlan: solidProductPlan(),
        plansById: {},
      }),
    });
    renderPlanner(storage);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Restored "Old solid plan". Its tile is not one of the drainable options'
    );
    expect(screen.queryByRole('heading', { level: 2, name: 'Project summary' })).toBeNull();
  });

  it('migrates a version 1 plan, deriving its garage front and clearance', () => {
    const storage = createMemoryStorage({
      'garage-floor-design/rough-plans': JSON.stringify({
        schemaVersion: 1,
        activePlan: {
          id: 'legacy',
          name: 'Legacy plan',
          createdAt: '2026-07-01T00:00:00.000Z',
          updatedAt: '2026-07-01T00:00:00.000Z',
          design: {
            version: 1,
            garage: { widthInches: 230, lengthInches: 246 },
            type: 'border',
            colors: {
              base: { hex: '#d1d5db', label: 'Silver' },
              accent: { hex: '#2563eb', label: 'Blue' },
              secondary: { hex: '#dc2626', label: 'Red' },
            },
            customBaseType: null,
            customGrid: null,
            customCells: {},
          },
          selectedProductId: null,
          wasteAllowancePercent: 10,
        },
        plansById: {},
      }),
    });
    renderPlanner(storage);

    expect(screen.getByRole('radio', { name: /^Border/ })).toBeChecked();
    expect(screen.getByLabelText('Expansion clearance (inches per side)')).toHaveValue('1');
    expect(screen.getByLabelText('Each door opening (inches)')).toHaveValue('94');
  });

  it('reports a storage failure instead of pretending the plan was saved', async () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw Object.assign(new Error('full'), { name: 'QuotaExceededError' });
      },
      removeItem: () => undefined,
    };
    const { user } = renderPlanner(storage);
    await selectProduct(user);
    await user.type(screen.getByLabelText('Plan name'), 'Too big');
    await user.click(screen.getByRole('button', { name: 'Save plan' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/Browser storage is full/);
  });

  it('surfaces corrupted stored plans without discarding them', async () => {
    const storage = createMemoryStorage({ 'garage-floor-design/rough-plans': '{not json' });
    const { user } = renderPlanner(storage);

    expect(screen.getByRole('heading', { level: 2, name: 'Garage & design' })).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(/corrupted/i);

    // Editing must not quietly overwrite data this build could not read.
    const width = screen.getByLabelText('Garage width (inches, front wall)');
    await user.clear(width);
    await user.type(width, '288');
    expect(storage.getItem('garage-floor-design/rough-plans')).toBe('{not json');
  });
});

function solidProductPlan(): RoughPlanDocument {
  return {
    id: 'old-solid-plan',
    name: 'Old solid plan',
    createdAt: '2026-07-29T12:00:00.000Z',
    updatedAt: '2026-07-29T12:00:00.000Z',
    design: createRoughDesignState({ type: 'solid-field' }),
    selectedProductId: 'vevor-garage-tiles-interlocking-12in',
    wasteAllowancePercent: 10,
  };
}
