import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  deviceScaleFactor: 1,
  viewport: { width: 1600, height: 1100 },
});
const page = await context.newPage();

await page.goto('http://dev:5173');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.getByRole('heading', { name: 'Garage & design' }).waitFor();

const designer = page.locator('section[aria-labelledby="planner-design-heading"]');
const designerBox = await designer.boundingBox();
if (designerBox === null) throw new Error('Garage designer is not visible.');
await page.screenshot({
  clip: {
    x: designerBox.x,
    y: designerBox.y,
    width: designerBox.width,
    height: Math.min(designerBox.height, 980),
  },
  path: 'docs/screenshots/garage-designer.png',
});

await page.getByLabel('Pattern category').selectOption('checkers-grids');
await page
  .locator('fieldset')
  .filter({ has: page.getByLabel('Pattern category') })
  .screenshot({ path: 'docs/screenshots/design-library.png' });

await page.getByLabel('Pattern category').selectOption('all');
await page.getByRole('radio', { name: /^Border/ }).check();
await page
  .getByRole('region', { name: 'Drainable tile options' })
  .getByRole('radio', { name: 'RaceDeck Free-Flow', exact: true })
  .check();
await page.getByRole('heading', { name: 'Project summary' }).waitFor();
const summary = page.locator('section[aria-labelledby="planner-summary-heading"]');
await summary.scrollIntoViewIfNeeded();
const summaryBox = await summary.boundingBox();
if (summaryBox === null) throw new Error('Project summary is not visible.');
await page.screenshot({
  clip: {
    x: summaryBox.x,
    y: summaryBox.y,
    width: summaryBox.width,
    height: Math.min(summaryBox.height, 980),
  },
  path: 'docs/screenshots/project-estimate.png',
});

await browser.close();
