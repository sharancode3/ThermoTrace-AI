import { test, expect } from '@playwright/test';

test('has title and sidebar', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  
  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Thermo Intelligence/);

  // Expect the sidebar text to be visible
  await expect(page.getByText('Thermo AI')).toBeVisible();
});

test('map container loads', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  
  // The map container should be present
  const mapContainer = page.locator('.maplibregl-map');
  await expect(mapContainer).toBeAttached();
});
