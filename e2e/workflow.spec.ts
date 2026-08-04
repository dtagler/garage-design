import { expect, test, type Page } from '@playwright/test';

const ROUGH_PLAN_KEY = 'garage-floor-design/rough-plans';
const FREE_FLOW = 'RaceDeck Free-Flow';

async function startWithEmptyStorage(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate((key) => localStorage.removeItem(key), ROUGH_PLAN_KEY);
  await page.reload();
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await startWithEmptyStorage(page);
});

test('plans a garage on one progressively revealed page, then saves and exports it', async ({
  page,
}) => {
  const design = page.getByRole('region', { name: 'Garage & design' });

  // Section 1: garage, doors, and rough design together, with one diagram.
  await expect(design).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Planner steps' })).toHaveCount(0);
  await expect(design.getByTestId('planner-canvas')).toHaveCount(1);
  await expect(design.getByLabel('Garage width (inches, front wall)')).toHaveValue('230');
  await expect(design.getByLabel('Garage length (inches, front to back)')).toHaveValue('246');
  await expect(design.getByLabel('Expansion clearance (inches per side)')).toHaveValue('1');
  await expect(design.getByLabel('Each door opening (inches)')).toHaveValue('94');
  await expect(design.getByLabel('Wall between doors (inches)')).toHaveValue('12');
  await expect(page.getByTestId('planner-tile-field')).toContainText(
    'Tile field 228 in × 244 in inside 230 in × 246 in walls.'
  );
  await expect(page.getByTestId('planner-front-summary')).toContainText(
    '2 door openings need 188 inches of front transition ramp'
  );

  // Two hundred fifty presets plus Custom, browsable rather than dumped.
  await expect(page.getByTestId('planner-preset-list').getByRole('radio')).toHaveCount(250);
  await expect(page.getByTestId('planner-preset-count')).toContainText('250 of 250 designs shown.');
  await page.getByLabel('Pattern category').selectOption('checkers-grids');
  await expect(page.getByTestId('planner-preset-list').getByRole('radio')).toHaveCount(54);
  await page.getByLabel('Pattern category').selectOption('all');
  await page.getByRole('radio', { name: /^Border/ }).check();
  await expect(page.getByTestId('garage-design-canvas').locator('[data-role="accent"]').first()) //
    .toBeVisible();

  // Section 2: drainable-only explorer, list left and one preview right.
  const tiles = page.getByRole('region', { name: 'Drainable tile options' });
  await expect(tiles.getByRole('radio')).toHaveCount(10);
  await expect(
    page.getByTestId('planner-product-option-vevor-interlocking-drainage-mat-12in')
  ).toContainText('VEVOR');
  await expect(page.getByText(/Diamondtrax|Ribtrax Smooth|RaceDeck XL/)).toHaveCount(0);

  const option = page.getByTestId('planner-product-option-racedeck-free-flow');
  await expect(option.getByRole('img').first()).toHaveAttribute('src', /racedeck\.com/);
  await option.hover();
  const detail = page.getByTestId('planner-product-detail');
  await expect(detail.getByRole('heading')).toContainText(FREE_FLOW);
  await expect(detail).toContainText('19 × 20 whole tiles, 19 × 21 including cut edges');
  await expect(detail).toContainText('tile field 228 in × 244 in');

  // Section 3 appears only once a tile is chosen.
  await expect(page.getByRole('heading', { level: 2, name: 'Project summary' })).toHaveCount(0);
  await tiles.getByRole('radio', { name: FREE_FLOW, exact: true }).check();
  await expect(page.getByRole('heading', { level: 2, name: 'Project summary' })).toBeVisible();
  await expect(design.getByLabel('Garage width (inches, front wall)')).toHaveValue('230');

  const purchases = page.getByTestId('planner-purchase-table');
  await expect(purchases).toContainText('Base · Alloy');
  await expect(purchases).toContainText('337 (306 placed + 31 waste)');
  await expect(purchases).toContainText('Accent · Cool Blue');
  await expect(purchases).toContainText('No verified package offer');
  await expect(purchases).toContainText('337 verified');
  await expect(page.getByTestId('planner-ramp-openings').getByRole('listitem')).toHaveCount(2);
  await expect(page.getByTestId('planner-ramp-openings')).toContainText(
    'Door opening 1 spans 94 inches and needs 8 ramp pieces'
  );
  await expect(page.getByTestId('planner-total-cost')).toContainText('$');
  await expect(page.getByTestId('planner-cut-statement')).toContainText('Cutting required:');

  const diagram = page.getByTestId('summary-floor-preview');
  await expect(diagram.locator('[data-testid^="exact-preview-ramp-"]')).toHaveCount(2);
  await expect(diagram.locator('[data-segment-kind="opening"]')).toHaveCount(2);
  await expect(diagram.locator('image, img')).toHaveCount(0);

  // Exports run against that same diagram.
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download high-resolution PNG' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('garage-floor-layout-racedeck-free-flow.png');

  const reportPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Open printable report' }).click();
  const report = await reportPromise;
  await expect(
    report.getByRole('heading', { level: 1, name: 'GarageDesign project report' })
  ).toBeVisible();
  await expect(
    report.getByRole('heading', { name: 'Garage front and door openings' })
  ).toBeVisible();
  await expect(report.locator('body')).toContainText('Door opening 1 94 in');
  await expect(report.locator('body')).toContainText(
    '1 in left, 1 in right, 1 in front, 1 in back'
  );
  await expect(report.locator('body')).toContainText('left over');
  await expect(report.locator('body')).toContainText('ramp');
  await expect(report.locator('img')).toHaveCount(1);
  await expect(report.locator('img')).toHaveAttribute('src', /^data:image\/svg\+xml/);
  await report.close();

  // Save, reload, and confirm the plan and its doors come back.
  await page.getByLabel('Plan name').fill('Border garage');
  await page.getByRole('button', { name: 'Save plan' }).click();
  await expect(page.getByTestId('planner-status')).toContainText('Saved "Border garage".');

  await page.reload();
  await expect(page.getByTestId('planner-status')).toContainText(
    'Restored your last plan, "Border garage".'
  );
  await expect(page.getByRole('radio', { name: /^Border/ })).toBeChecked();
  await expect(page.getByLabel('Each door opening (inches)')).toHaveValue('94');
  await expect(page.getByRole('heading', { level: 2, name: 'Project summary' })).toBeVisible();
});

test('reopens a plan whose solid tile is hidden at the drainable options', async ({ page }) => {
  await page.evaluate(([key, payload]) => localStorage.setItem(key, payload), [
    ROUGH_PLAN_KEY,
    JSON.stringify({
      schemaVersion: 4,
      activePlan: {
        id: 'old-solid-plan',
        name: 'Old solid plan',
        createdAt: '2026-07-29T12:00:00.000Z',
        updatedAt: '2026-07-29T12:00:00.000Z',
        design: {
          version: 3,
          garage: { widthInches: 230, lengthInches: 246 },
          expansionClearance: {
            leftInches: 1,
            rightInches: 1,
            frontInches: 1,
            backInches: 1,
          },
          type: 'solid-field',
          colors: {
            base: { hex: '#d1d5db', label: 'Silver' },
            accent: { hex: '#2563eb', label: 'Blue' },
            secondary: { hex: '#dc2626', label: 'Red' },
          },
          customBaseType: null,
          customGrid: null,
          customCells: {},
        },
        selectedProductId: 'vevor-garage-tiles-interlocking-12in',
        wasteAllowancePercent: 10,
      },
      plansById: {},
    }),
  ] as const);
  await page.reload();

  await expect(page.getByTestId('planner-status')).toContainText(
    'Its tile is not one of the drainable options'
  );
  await expect(page.getByRole('heading', { level: 2, name: 'Project summary' })).toHaveCount(0);
  await expect(
    page.getByRole('heading', { level: 2, name: 'Drainable tile options' })
  ).toBeVisible();
});

test('buys the VEVOR drainage mat and its published transition ramp by the pack', async ({
  page,
}) => {
  const tiles = page.getByRole('region', { name: 'Drainable tile options' });
  await tiles
    .getByRole('radio', { name: 'Interlocking Drainage Mat (nominal 12 x 12 in)', exact: true })
    .check();
  await expect(page.getByRole('heading', { level: 2, name: 'Project summary' })).toBeVisible();

  // Packages only: VEVOR publishes packs, so nothing is quoted as a single tile.
  const purchases = page.getByTestId('planner-purchase-table');
  const row = purchases.getByRole('row').filter({ hasText: 'Base · Light Gray' });
  await expect(row.getByRole('cell').nth(0)).toHaveText('439 (399 placed + 40 waste)');
  await expect(row.getByRole('cell').nth(1)).toContainText('per pack of');
  await expect(row.getByRole('cell').nth(1)).toContainText('tiles each) from Vevor');
  await expect(row.getByRole('cell').nth(2)).toHaveText('No verified individual listing');
  await expect(row.getByRole('cell').nth(3)).toHaveText('440');
  await expect(row.getByRole('cell').nth(4)).toHaveText('1');
  await expect(row.getByRole('cell').nth(5)).toHaveText('$655.20');
  await expect(purchases.locator('..')).toContainText('with 1 leftover tile');

  // VEVOR publishes a drainage-mat-specific kit, distinct from its incompatible 6-Lock edging.
  await expect(page.getByText(/kits of 11 pieces, 2 required/i)).toBeVisible();
  await expect(page.getByTestId('planner-ramp-openings').getByRole('listitem')).toHaveCount(2);
  await expect(page.getByTestId('planner-ramp-caveats')).toContainText(
    "attaches only to the tile's female edge"
  );
  await expect(page.getByTestId('planner-ramp-caveats')).toContainText(
    'separate from VEVOR 6-Lock'
  );
  await expect(
    page.getByTestId('summary-floor-preview').locator('[data-testid^="exact-preview-ramp-"]')
  ).toHaveCount(2);
  await expect(page.getByTestId('planner-total-cost')).toHaveText('$683.00');
});

test('paints a custom design and edits the door configuration', async ({ page }) => {
  await page.getByLabel('Garage width (inches, front wall)').fill('288');
  await expect(page.getByTestId('planner-tile-field')).toContainText('Tile field 286 in × 244 in');

  await page.getByRole('radio', { name: /^Custom/ }).check();
  await page.getByRole('radio', { name: 'Secondary', exact: true }).check();
  const canvas = page.getByTestId('garage-design-canvas');
  await page.getByTestId('rough-cell-2-1').click();
  await expect(page.getByTestId('rough-cell-2-1')).toHaveAttribute('data-role', 'secondary');
  await expect(canvas).toBeFocused();

  const rightClickCell = page.getByTestId('rough-cell-3-1');
  await rightClickCell.click({ button: 'right' });
  await page.keyboard.press('Escape');
  await expect(rightClickCell).toHaveAttribute('data-role', 'base');

  const middleClickCell = page.getByTestId('rough-cell-4-1');
  await middleClickCell.click({ button: 'middle' });
  await expect(middleClickCell).toHaveAttribute('data-role', 'base');

  const dragCells = [
    page.getByTestId('rough-cell-4-3'),
    page.getByTestId('rough-cell-5-3'),
    page.getByTestId('rough-cell-6-3'),
  ];
  const dragBoxes = await Promise.all(dragCells.map((cell) => cell.boundingBox()));
  if (dragBoxes.some((box) => box === null)) throw new Error('Custom paint cells are not visible.');
  await page.mouse.move(
    dragBoxes[0]!.x + dragBoxes[0]!.width / 2,
    dragBoxes[0]!.y + dragBoxes[0]!.height / 2
  );
  await page.mouse.down();
  for (const box of dragBoxes.slice(1)) {
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  }
  await page.mouse.up();
  for (const cell of dragCells) {
    await expect(cell).toHaveAttribute('data-role', 'secondary');
  }

  const touchCells = [
    page.getByTestId('rough-cell-4-4'),
    page.getByTestId('rough-cell-5-4'),
    page.getByTestId('rough-cell-6-4'),
  ];
  const touchBoxes = await Promise.all(touchCells.map((cell) => cell.boundingBox()));
  if (touchBoxes.some((box) => box === null)) throw new Error('Touch paint cells are not visible.');
  const touchSession = await page.context().newCDPSession(page);
  await touchSession.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      {
        x: touchBoxes[0]!.x + touchBoxes[0]!.width / 2,
        y: touchBoxes[0]!.y + touchBoxes[0]!.height / 2,
      },
    ],
  });
  for (const box of touchBoxes.slice(1)) {
    await touchSession.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        {
          x: box!.x + box!.width / 2,
          y: box!.y + box!.height / 2,
        },
      ],
    });
  }
  await touchSession.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await touchSession.detach();
  for (const cell of touchCells) {
    await expect(cell).toHaveAttribute('data-role', 'secondary');
  }

  await page.getByLabel('Door configuration').selectOption('one-double-door');
  await expect(page.getByTestId('planner-front-summary')).toContainText('One door opening needs');
  await expect(page.getByLabel('Wall between doors (inches)')).toHaveCount(0);
});
