import { expect, test, type Page } from "@playwright/test";

const preference = {
  enabled: true,
  notify_critical: true,
  notify_abnormal: true,
  has_alert_location: true,
  vapid_public_key: null,
};

const alerts = [
  {
    id: "notification-1",
    event_id: "EVT-IN-ODI-E46F91AA",
    title: "Critical thermal event nearby",
    message: "A verified thermal event was detected nearby.",
    severity: "CRITICAL",
    classification: "IND_FIRE",
    peak_frp_mw: 42.5,
    latitude: 28.6139,
    longitude: 77.209,
    distance_km: 1.2,
    is_read: false,
    created_at: new Date().toISOString(),
  },
  {
    id: "notification-2",
    event_id: "event-abnormal-2",
    title: "Abnormal thermal event nearby",
    message: "An abnormal thermal event was detected nearby.",
    severity: "ABNORMAL",
    latitude: 28.62,
    longitude: 77.21,
    distance_km: 2.1,
    is_read: false,
    created_at: new Date().toISOString(),
  },
];

async function mockNearby(page: Page, items = alerts, preferences = preference) {
  let current = items.map(item => ({ ...item }));
  let currentPreferences = { ...preferences };
  await page.route("**/api/v1/stream/news**", route => route.fulfill({
    status: 200,
    contentType: "text/event-stream",
    body: "",
  }));
  await page.route("**/api/v1/notifications/nearby**", async route => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname.endsWith("/preferences")) {
      if (method === "PUT") currentPreferences = { ...currentPreferences, ...route.request().postDataJSON() };
      return route.fulfill({ json: currentPreferences });
    }
    if (url.pathname.endsWith("/location")) return route.fulfill({ json: { ...currentPreferences, has_alert_location: true } });
    if (url.pathname.endsWith("/read-all")) {
      current = current.map(item => ({ ...item, is_read: true }));
      return route.fulfill({ json: { updated: current.length } });
    }
    if (url.pathname.endsWith("/read") && method === "POST") {
      const id = url.pathname.split("/").at(-2);
      current = current.map(item => item.id === id ? { ...item, is_read: true } : item);
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: current });
  });
  return { setItems: (items: typeof alerts) => { current = items.map(item => ({ ...item })); } };
}

async function refreshNearbyAlerts(page: Page) {
  await page.getByLabel(/Nearby alerts,/).click();
  const refreshed = page.waitForResponse(response => response.url().endsWith("/notifications/nearby/preferences"));
  await page.getByLabel("Refresh nearby alerts").click();
  await refreshed;
  await page.getByLabel("Close nearby alerts").click();
}

test("bell, unread count, drawer, mark read, View on Map, and Event Investigation work", async ({ page }) => {
  await mockNearby(page);
  await page.goto("http://localhost:3000/monitor");
  const bell = page.getByLabel("Nearby alerts, 2 unread");
  await expect(bell).toBeVisible();
  await expect(bell.getByLabel("2 unread")).toBeVisible();
  await bell.click();
  await expect(page.getByRole("dialog", { name: "Nearby Alerts" })).toBeVisible();
  await page.getByLabel("View event EVT-IN-ODI-E46F91AA on map").click();
  await expect(page).toHaveURL(/\/monitor\?eventId=EVT-IN-ODI-E46F91AA/);
  await expect(page.getByText("EVT-IN-ODI-E46F91AA").first()).toBeVisible();
  await expect(page.getByLabel("Nearby alerts, 1 unread")).toBeVisible();
});

test("empty notification state", async ({ page }) => {
  await mockNearby(page, []);
  await page.goto("http://localhost:3000/monitor");
  await page.getByLabel("Nearby alerts, 0 unread").click();
  await expect(page.getByText("No nearby alerts.")).toBeVisible();
});

test("geolocation opt-in stores an alert location", async ({ context, page }) => {
  await context.grantPermissions(["geolocation"], { origin: "http://localhost:3000" });
  await context.setGeolocation({ latitude: 28.6139, longitude: 77.209 });
  await mockNearby(page, [], { ...preference, enabled: false, has_alert_location: false });
  await page.goto("http://localhost:3000/monitor");
  await page.getByRole("button", { name: "Enable Location Alerts" }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("thermotrace_nearby_prompt_answered"))).toBe("enabled");
});

test("permission denied state is retained and reported", async ({ context, page }) => {
  await context.clearPermissions();
  await mockNearby(page, [], { ...preference, enabled: false, has_alert_location: false });
  await page.goto("http://localhost:3000/monitor");
  await page.getByRole("button", { name: "Enable Location Alerts" }).click();
  await expect(page.getByRole("status")).toContainText(/denied|permission/i);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("thermotrace_nearby_prompt_answered"))).toBe("denied");
});

test("mark all read clears the badge", async ({ page }) => {
  await mockNearby(page);
  await page.goto("http://localhost:3000/monitor");
  await page.getByLabel("Nearby alerts, 2 unread").click();
  await page.getByRole("button", { name: "Mark All Read" }).click();
  await expect(page.getByLabel("Nearby alerts, 0 unread")).toBeVisible();
});

test("search and severity/read filters update the visible alert list", async ({ page }) => {
  await mockNearby(page);
  await page.goto("http://localhost:3000/monitor");
  await page.getByLabel("Nearby alerts, 2 unread").click();
  await page.getByPlaceholder("Search nearby alerts...").fill("event-abnormal-2");
  await expect(page.getByText("Abnormal thermal event nearby")).toBeVisible();
  await expect(page.getByText("Critical thermal event nearby")).toBeHidden();
  await page.getByPlaceholder("Search nearby alerts...").clear();
  await page.getByRole("button", { name: "Critical" }).click();
  await expect(page.getByText("Critical thermal event nearby")).toBeVisible();
  await expect(page.getByText("Abnormal thermal event nearby")).toBeHidden();
  await page.getByRole("button", { name: "Unread (2)" }).click();
  await page.getByRole("button", { name: "Acknowledge", exact: true }).first().click();
  await expect(page.getByText("Critical thermal event nearby")).toBeHidden();
  await page.getByRole("button", { name: "Read (1)", exact: true }).click();
  await expect(page.getByText("Critical thermal event nearby")).toBeVisible();
  await expect(page.getByText("Read", { exact: true })).toBeVisible();
});

test("notification preferences use independent accessible switches", async ({ page }) => {
  await mockNearby(page);
  await page.goto("http://localhost:3000/monitor");
  await page.getByLabel("Nearby alerts, 2 unread").click();
  await page.getByLabel("Nearby alert settings").click();
  await expect(page.getByText("Alert Preferences")).toBeVisible();
  await expect(page.getByText("25 km contextual radius")).toBeVisible();
  await expect(page.getByText("10 km contextual radius")).toBeVisible();
  const critical = page.getByRole("switch", { name: "Critical nearby notifications" });
  await expect(critical).toHaveAttribute("aria-checked", "true");
  await critical.click();
  await expect(critical).toHaveAttribute("aria-checked", "false");
  await expect(page.getByRole("button", { name: "All (2)" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Registered location", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/nearby-preferences.png", fullPage: true });
});

test("refresh reloads alerts without closing the drawer", async ({ page }) => {
  await mockNearby(page);
  await page.goto("http://localhost:3000/monitor");
  await page.getByLabel("Nearby alerts, 2 unread").click();
  const response = page.waitForResponse(item => item.url().includes("/notifications/nearby/preferences"));
  await page.getByLabel("Refresh nearby alerts").click();
  await response;
  await expect(page.getByRole("dialog", { name: "Nearby Alerts" })).toBeVisible();
});

test("only genuinely new alerts produce one dismissible in-app toast", async ({ page }) => {
  const nearby = await mockNearby(page, [alerts[0]]);
  await page.goto("http://localhost:3000/monitor");
  await expect(page.getByLabel("Nearby alerts, 1 unread")).toBeVisible();
  await expect(page.getByRole("status", { name: "New nearby alert" })).toHaveCount(0);

  nearby.setItems(alerts);
  await refreshNearbyAlerts(page);
  const toast = page.getByRole("status", { name: "New nearby alert" });
  await expect(toast).toBeVisible();
  await expect(toast).toContainText("ABNORMAL");
  await expect(page.getByLabel("Nearby alerts, 2 unread")).toBeVisible();
  await page.screenshot({ path: "test-results/nearby-toast-desktop.png", fullPage: true });

  await page.getByLabel("Dismiss nearby alert").click();
  await expect(toast).toBeHidden();
  await expect(page.getByLabel("Nearby alerts, 2 unread")).toBeVisible();
  await refreshNearbyAlerts(page);
  await expect(toast).toHaveCount(0);
});

test("new nearby toasts are queued one at a time", async ({ page }) => {
  const nearby = await mockNearby(page, []);
  const initialLoad = page.waitForResponse(response => response.url().endsWith("/notifications/nearby/preferences"));
  await page.goto("http://localhost:3000/monitor");
  await initialLoad;
  nearby.setItems(alerts);
  await refreshNearbyAlerts(page);
  const toast = page.getByRole("status", { name: "New nearby alert" });
  await expect(toast).toHaveCount(1);
  await expect(toast).toContainText("Critical thermal event nearby");
  await page.getByLabel("Dismiss nearby alert").click();
  await expect(toast).toContainText("Abnormal thermal event nearby");
  await expect(toast).toHaveCount(1);
});

test("toast View on Map reuses event selection and URL navigation", async ({ page }) => {
  const nearby = await mockNearby(page, []);
  const initialLoad = page.waitForResponse(response => response.url().endsWith("/notifications/nearby/preferences"));
  await page.goto("http://localhost:3000/monitor");
  await initialLoad;
  nearby.setItems([alerts[0]]);
  await refreshNearbyAlerts(page);
  const selectedEventRequested = page.waitForRequest(request => request.url().includes(`/api/v1/events/${alerts[0].event_id}`));
  await page.getByRole("button", { name: "View on Map" }).click();
  await expect(page).toHaveURL(new RegExp(`eventId=${alerts[0].event_id}`));
  await selectedEventRequested;
  await expect(page.getByRole("status", { name: "New nearby alert" })).toHaveCount(0);
});

test("in-app toast stays for one minute then auto-dismisses without marking the alert read", async ({ page }) => {
  await page.clock.install();
  const nearby = await mockNearby(page, []);
  const initialLoad = page.waitForResponse(response => response.url().endsWith("/notifications/nearby/preferences"));
  await page.goto("http://localhost:3000/monitor");
  await initialLoad;
  nearby.setItems([alerts[0]]);
  await refreshNearbyAlerts(page);
  await expect(page.getByRole("status", { name: "New nearby alert" })).toBeVisible();
  await page.clock.fastForward(59_000);
  await expect(page.getByRole("status", { name: "New nearby alert" })).toBeVisible();
  await page.clock.fastForward(1_500);
  await expect(page.getByRole("status", { name: "New nearby alert" })).toBeHidden();
  await expect(page.getByLabel("Nearby alerts, 1 unread")).toBeVisible();
});

test("in-app toast remains inside the mobile map without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const nearby = await mockNearby(page, []);
  const initialLoad = page.waitForResponse(response => response.url().endsWith("/notifications/nearby/preferences"));
  await page.goto("http://localhost:3000/monitor");
  await initialLoad;
  nearby.setItems([alerts[0]]);
  await refreshNearbyAlerts(page);
  const toast = page.getByRole("status", { name: "New nearby alert" });
  const box = await toast.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: "test-results/nearby-toast-mobile.png", fullPage: true });
});

test("Show on Map keeps URL, selection, and investigation synchronized across events", async ({ page }) => {
  const transitions = [
    { ...alerts[0], id: "transition-a", event_id: "EVT-IN-ODI-E46F91AA", latitude: 21.76223, longitude: 83.85188 },
    { ...alerts[0], id: "transition-b", event_id: "EVT-IN-JHA-52D2F6E5", latitude: 23.76485, longitude: 86.4004 },
    { ...alerts[0], id: "transition-c", event_id: "EVT-IN-JHA-D302C720", latitude: 23.73951, longitude: 86.43661, is_read: true },
  ];
  await mockNearby(page, transitions);
  await page.goto("http://localhost:3000/monitor");
  for (const item of transitions) {
    await page.getByLabel(/Nearby alerts,/).evaluate((button: HTMLButtonElement) => button.click());
    const selectedEventRequested = page.waitForRequest(request => request.url().includes(`/api/v1/events/${item.event_id}`));
    await page.getByLabel(`View event ${item.event_id} on map`).click();
    await expect(page).toHaveURL(new RegExp(`eventId=${item.event_id}`));
    await selectedEventRequested;
  }
});

test("mobile drawer is a bottom sheet without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockNearby(page);
  await page.goto("http://localhost:3000/monitor");
  await page.getByLabel("Nearby alerts, 2 unread").click();
  const drawer = page.getByRole("dialog", { name: "Nearby Alerts" });
  await expect(drawer).toBeVisible();
  const box = await drawer.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(390);
  expect(box!.y).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: "test-results/nearby-mobile.png", fullPage: true });
});

test("desktop drawer preserves usable map space", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockNearby(page);
  await page.goto("http://localhost:3000/monitor");
  const trigger = page.getByLabel("Nearby alerts, 2 unread");
  await expect(trigger).toHaveClass(/bg-orange-600/);
  await page.screenshot({ path: "test-results/nearby-trigger-desktop.png", fullPage: true });
  await trigger.click();
  const drawer = page.getByRole("dialog", { name: "Nearby Alerts" });
  const box = await drawer.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(461);
  await expect(page.getByRole("region", { name: "Map" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: "test-results/nearby-desktop.png", fullPage: true });
});

test("existing nationwide Alerts drawer still opens", async ({ page }) => {
  await mockNearby(page, []);
  await page.goto("http://localhost:3000/monitor");
  await page.getByRole("button", { name: /Alerts/ }).click();
  await expect(page.getByText(/Operational Alerts/).first()).toBeVisible();
});

test("live browser permission creates and stores a Web Push subscription", async ({ context, page }) => {
  test.skip(process.env.RUN_LIVE_WEB_PUSH !== "1", "Requires an interactive browser push service and OS notification UI");
  test.setTimeout(90_000);
  await context.grantPermissions(["geolocation", "notifications"], { origin: "http://localhost:3000" });
  await context.setGeolocation({ latitude: 21.76223, longitude: 83.85188 });
  const preferencesLoaded = page.waitForResponse(response => response.url().endsWith("/notifications/nearby/preferences"));
  await page.goto("http://localhost:3000/monitor");
  expect((await preferencesLoaded).status()).toBe(200);
  await page.getByLabel(/Nearby alerts/).click();
  await page.getByLabel("Nearby alert settings").click();
  await expect(page.getByRole("button", { name: "Update Location" })).toBeVisible();
  const stored = page.waitForResponse(response =>
    response.url().includes("/notifications/nearby/push-subscriptions") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Update Location" }).click();
  await expect(page.getByText("Nearby alerts and browser notifications are enabled.")).toBeVisible({ timeout: 30_000 });
  expect((await stored).status()).toBe(200);
  expect(await page.evaluate(() => Notification.permission)).toBe("granted");
});
