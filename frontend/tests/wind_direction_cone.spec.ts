import { test, expect } from "@playwright/test";

test.describe("Stage 4: Selected Hotspot Wind Direction Cone", () => {
  test("Wind cone and investigation UI render the live meteorological response", async ({
    page,
  }) => {
    // Find an event with a usable, provider-backed wind response. The test
    // derives every displayed value from this run's real API response.
    const eventsResponse = await page.request.get(
      "/api/v1/gis/events?west=68&south=8.3&east=96.98&north=36.74&zoom=5&show_all=true&limit=25"
    );
    expect(eventsResponse.ok()).toBeTruthy();
    const events = await eventsResponse.json();
    const eventIds = (events.features || [])
      .map((feature: { properties?: { event_id?: string } }) => feature.properties?.event_id)
      .filter((eventId: unknown): eventId is string => typeof eventId === "string");

    let eventId: string | undefined;
    for (const candidateId of eventIds) {
      const response = await page.request.get(`/api/v1/events/${encodeURIComponent(candidateId)}/wind`);
      if (!response.ok()) continue;
      const candidateWind = await response.json();
      if (candidateWind.available) {
        eventId = candidateId;
        break;
      }
    }
    expect(eventId, "Expected at least one active event with provider-backed wind data").toBeTruthy();

    const windResponsePromise = page.waitForResponse((response) =>
      response.request().method() === "GET" &&
      response.url().includes(`/api/v1/events/${encodeURIComponent(eventId!)}/wind`)
    );
    await page.goto(`/monitor?eventId=${encodeURIComponent(eventId!)}`);
    const windResponse = await windResponsePromise;
    expect(windResponse.ok()).toBeTruthy();
    const wind = await windResponse.json();
    expect(wind.available).toBe(true);

    const direction = `${wind.direction_from_cardinal} → ${wind.direction_toward_cardinal}`;
    const speed = `${wind.speed_kmh} km/h`;
    const bearing = Math.round(Number(wind.direction_from_degrees));

    // Verify Event Investigation drawer opens
    await expect(page.getByText("WIND CONDITIONS")).toBeVisible({ timeout: 10000 });

    await expect(page.getByText(direction).first()).toBeVisible();
    await expect(page.getByText(speed).first()).toBeVisible();
    await expect(page.getByText(`${bearing}°`).first()).toBeVisible();
    if (wind.source) await expect(page.getByText(wind.source).first()).toBeVisible();

    // Verify map badge overlay
    const overlayBadge = page.getByTestId("wind-vector-overlay");
    await expect(overlayBadge).toBeVisible();
    await expect(overlayBadge).toContainText("WIND");
    await expect(overlayBadge).toContainText(direction);
    await expect(overlayBadge).toContainText(speed);
    await expect(overlayBadge).toContainText(`${bearing}°`);

    // Test Toggle OFF
    const toggleButton = page.getByRole("button", { name: /WIND VECTOR:/i });
    await expect(toggleButton).toContainText("ON");
    await toggleButton.click();

    // Verify toggle switched to OFF and badge disappeared
    await expect(toggleButton).toContainText("OFF");
    await expect(overlayBadge).not.toBeVisible();

    // Test Toggle back ON
    await toggleButton.click();
    await expect(toggleButton).toContainText("ON");
    await expect(overlayBadge).toBeVisible();
  });

  test("Graceful handling when wind data is unavailable", async ({ page }) => {
    await page.route(`**/api/v1/events/EVT-UNAVAIL/wind`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          available: false,
          status: "WIND_DATA_UNAVAILABLE",
          reason: "Weather provider service timeout",
        }),
      });
    });

    await page.route(`**/api/v1/events/EVT-UNAVAIL`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          event_id: "EVT-UNAVAIL",
          latitude: 22.0,
          longitude: 78.0,
          latest_detected_utc: "2026-09-10T12:00:00Z",
          classification: "IND_ROUTINE",
          anomaly_tier: "NORMAL",
          peak_frp_mw: 10.0,
        }),
      });
    });

    await page.goto("http://localhost:3000/monitor?eventId=EVT-UNAVAIL");

    await expect(page.getByText("WIND DATA UNAVAILABLE")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("wind-vector-overlay")).not.toBeVisible();
  });

  test("Historical event with unavailable archive shows HISTORICAL WIND DATA UNAVAILABLE", async ({
    page,
  }) => {
    await page.route(`**/api/v1/events/EVT-HIST-UNAVAIL/wind`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          available: false,
          status: "HISTORICAL_WIND_DATA_UNAVAILABLE",
          reason: "Provider historical archive reanalysis unavailable",
        }),
      });
    });

    await page.route(`**/api/v1/events/EVT-HIST-UNAVAIL`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          event_id: "EVT-HIST-UNAVAIL",
          latitude: 22.0,
          longitude: 78.0,
          latest_detected_utc: "2023-01-01T12:00:00Z",
          classification: "AGRI_BURN",
          anomaly_tier: "NORMAL",
          peak_frp_mw: 15.0,
        }),
      });
    });

    await page.goto("http://localhost:3000/monitor?eventId=EVT-HIST-UNAVAIL");

    await expect(page.getByText("HISTORICAL WIND DATA UNAVAILABLE")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("wind-vector-overlay")).not.toBeVisible();
  });
});
