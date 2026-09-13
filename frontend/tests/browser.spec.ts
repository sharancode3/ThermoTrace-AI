import { test, expect } from '@playwright/test';

test('has title and sidebar', async ({ page }) => {
  await page.goto('http://localhost:3000/monitor');
  
  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Thermo Intelligence/);

  // Expect the sidebar text to be visible
  await expect(page.getByText('ThermoTrace AI')).toBeVisible();
});

test('map container loads', async ({ page }) => {
  await page.goto('http://localhost:3000/monitor');
  
  // The map container should be present
  const mapContainer = page.locator('.maplibregl-map');
  await expect(mapContainer).toBeAttached();
});

test('monitor exposes Stage 4 investigation controls', async ({ page }) => {
  await page.goto('http://localhost:3000/monitor');
  await expect(page.getByRole('region', { name: 'Map' })).toBeVisible();
  await expect(page.getByLabel('Severity Filter')).toBeVisible();
  await expect(page.getByLabel('Classification Filter')).toBeVisible();
});
