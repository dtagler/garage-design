import { expect, test, type Page } from '@playwright/test';

/** Widths that cover the common desktop monitors plus a narrow half-screen window. */
const DESKTOP_WIDTHS = [
  { name: '1920 monitor', width: 1920, height: 1080, sideBySide: true },
  { name: '1440 monitor', width: 1440, height: 900, sideBySide: true },
  { name: '1280 monitor', width: 1280, height: 800, sideBySide: true },
  { name: 'narrow half-screen window', width: 1024, height: 800, sideBySide: false },
] as const;

async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth > root.clientWidth + 1;
  });
}

/** The widest grid used anywhere inside the planner, counted in real layout tracks. */
async function widestGridTrackCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const tracks = [...document.querySelectorAll('.planner *')].map((element) => {
      const columns = getComputedStyle(element).gridTemplateColumns;
      return columns === 'none' || columns === '' ? 0 : columns.split(' ').length;
    });
    return Math.max(0, ...tracks);
  });
}

for (const viewport of DESKTOP_WIDTHS) {
  test(`stays usable at ${viewport.name} (${String(viewport.width)}px)`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 2, name: 'Garage & design' })).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);

    const controls = await page.locator('.planner__controls').boundingBox();
    const canvas = await page
      .getByRole('region', { name: 'Garage & design' })
      .getByTestId('planner-canvas')
      .boundingBox();
    if (!controls || !canvas) throw new Error('The planner should render controls and a canvas.');

    if (viewport.sideBySide) {
      // Wide monitors put the controls beside the drawing rather than above it.
      expect(controls.x + controls.width).toBeLessThanOrEqual(canvas.x + 1);
    } else {
      expect(canvas.y).toBeGreaterThan(controls.y);
    }
    expect(canvas.width).toBeGreaterThan(320);

    // The run of front segment labels is condensed to fit instead of spilling out of the drawing.
    const drawing = await page.getByTestId('garage-design-canvas').boundingBox();
    const caption = await page.getByTestId('front-run-caption').boundingBox();
    if (!drawing || !caption) throw new Error('The garage plan should draw a front run caption.');
    expect(caption.x).toBeGreaterThanOrEqual(drawing.x - 1);
    expect(caption.x + caption.width).toBeLessThanOrEqual(drawing.x + drawing.width + 1);

    // Never a three-column layout, at any supported width.
    expect(await widestGridTrackCount(page)).toBeLessThanOrEqual(2);

    await page.getByRole('radio', { name: 'RaceDeck Free-Flow', exact: true }).check();
    await expect(page.getByRole('heading', { level: 2, name: 'Project summary' })).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);
    expect(await widestGridTrackCount(page)).toBeLessThanOrEqual(2);
  });
}

test('keeps the product explorer as a list on the left and one preview on the right', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const list = await page.getByTestId('planner-product-list').boundingBox();
  const detail = await page.getByTestId('planner-product-detail').boundingBox();
  if (!list || !detail) throw new Error('The explorer should render a list and a preview.');

  expect(list.x + list.width).toBeLessThanOrEqual(detail.x + 1);
  await expect(page.getByTestId('planner-product-detail')).toHaveCount(1);
  await expect(page.getByTestId('planner-product-preview')).toHaveCount(1);

  const scrolls = await page
    .getByTestId('planner-product-list')
    .evaluate((element) => getComputedStyle(element).overflowY);
  expect(scrolls).toBe('auto');
});

test('a keyboard reaches the skip link and the painting canvas', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const skipLink = page.getByRole('link', { name: 'Skip to the planner' });
  const offscreen = await skipLink.boundingBox();
  expect(offscreen?.x ?? 0).toBeLessThan(0);

  await page.keyboard.press('Tab');
  await expect(skipLink).toBeFocused();

  const focused = await skipLink.boundingBox();
  expect(focused?.x ?? -1).toBeGreaterThanOrEqual(0);

  const outline = await skipLink.evaluate(
    (element) => getComputedStyle(element).outlineStyle !== 'none'
  );
  expect(outline).toBe(true);

  await page.getByRole('radio', { name: /^Custom/ }).check();
  const canvas = page.getByTestId('garage-design-canvas');
  await canvas.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('rough-cell-1-0')).toHaveAttribute('data-role', 'accent');

  const canvasOutline = await canvas.evaluate(
    (element) => getComputedStyle(element).outlineStyle !== 'none'
  );
  expect(canvasOutline).toBe(true);
});

test.describe('reduced motion', () => {
  test('drops animation when the desktop asks for less motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const durations = await page.evaluate(() =>
      [
        ...document.querySelectorAll('.planner__section, .app, .planner__preset, .app__skip-link'),
      ].flatMap((element) => {
        const style = getComputedStyle(element);
        return [style.transitionDuration, style.animationDuration];
      })
    );

    expect(durations.length).toBeGreaterThan(0);
    for (const duration of durations) {
      const seconds = duration.endsWith('ms')
        ? Number.parseFloat(duration) / 1000
        : Number.parseFloat(duration);
      expect(seconds).toBeLessThanOrEqual(0.001);
    }
  });
});
