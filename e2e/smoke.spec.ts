import { expect, test } from '@playwright/test';

test('application shell loads in a real browser', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: /garage design/i })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Garage & design' })).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Drainable tile options' })
  ).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Planner steps' })).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
