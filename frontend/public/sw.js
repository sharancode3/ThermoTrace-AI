self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  const title = data.title || "ThermoTrace Nearby Alert";
  const body = data.body || "A verified thermal event was detected near your alert location.";
  const eventId = data.eventId;
  const url = data.url || (eventId ? `/monitor?eventId=${eventId}` : "/monitor");

  event.waitUntil(self.registration.showNotification(title, {
    body: body,
    icon: "/assets/thermotrace-satellite.jpg",
    badge: "/assets/thermotrace-satellite.jpg",
    tag: eventId ? `nearby-${eventId}` : "nearby-thermal-alert",
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: url, eventId: eventId },
    actions: [
      { action: "explore", title: "View on Map" },
      { action: "close", title: "Dismiss" }
    ]
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "close") return;
  const target = new URL(event.notification.data?.url || "/monitor", self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    for (const client of windows) {
      if ("focus" in client) { client.navigate(target); return client.focus(); }
    }
    return clients.openWindow(target);
  }));
});
