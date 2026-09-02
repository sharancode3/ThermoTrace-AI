import { test, expect } from '@playwright/test';

test.describe('ThermoTrace AI Sovereign Frontend E2E Test Suite', () => {

  test('TC-E2E-01: Root Page redirects to /monitor and renders sidebar shell', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    await expect(page).toHaveURL(/.*monitor/);
    await expect(page).toHaveTitle(/Thermo Intelligence/);
    await expect(page.getByText('Thermo AI').first()).toBeVisible();
    await expect(page.getByText('Monitor').first()).toBeVisible();
    await expect(page.getByText('Facilities').first()).toBeVisible();
    await expect(page.getByText('Reports').first()).toBeVisible();
  });

  test('TC-E2E-02: Monitor GIS Map canvas loads and attaches MapLibre container', async ({ page }) => {
    await page.goto('http://localhost:3000/monitor');
    const mapContainer = page.locator('.maplibregl-map');
    await expect(mapContainer).toBeAttached();
  });

  test('TC-E2E-03: National Analytics page loads metrics, charts, and state leaderboard', async ({ page }) => {
    await page.goto('http://localhost:3000/analytics');
    await expect(page.getByText('National Thermal Intelligence & State Analytics')).toBeVisible();
    await expect(page.getByText('Pan-India Sovereign Thermal Baseline')).toBeVisible();
    await expect(page.getByText('Machine Learning Calibration Rigor')).toBeVisible();
  });

  test('TC-E2E-04: Facilities Catalog page loads asset cards and search filter', async ({ page }) => {
    await page.goto('http://localhost:3000/facilities');
    await expect(page.getByText('Strategic Industrial Facilities')).toBeVisible();
    const searchInput = page.getByPlaceholder(/Search facilities/i);
    await expect(searchInput).toBeVisible();
  });

  test('TC-E2E-05: Regulatory Reports Studio loads dossier archive and generator trigger', async ({ page }) => {
    await page.goto('http://localhost:3000/reports');
    await expect(page.getByText('Thermal Intelligence Dossiers')).toBeVisible();
    await expect(page.getByText('Generate Custom Dossier')).toBeVisible();
  });

  test('TC-E2E-06: Technical Architecture Guide loads evaluator reference and formulas', async ({ page }) => {
    await page.goto('http://localhost:3000/guide');
    await expect(page.getByText('System Architecture & Operational Guide')).toBeVisible();
    await expect(page.getByText('Executive Mandate & Sovereign Operational Architecture')).toBeVisible();
  });

  test('TC-E2E-07: Overlays (ThermoNews & Alerts) toggle cleanly via query parameters', async ({ page }) => {
    await page.goto('http://localhost:3000/monitor?overlay=alerts');
    await expect(page.getByText(/Operational Alerts/i).first()).toBeVisible();
    
    await page.goto('http://localhost:3000/monitor?overlay=news');
    await expect(page.getByText(/Thermo News/i).first()).toBeVisible();
  });

});
