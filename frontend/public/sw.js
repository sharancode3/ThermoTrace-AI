self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  event.waitUntil(self.registration.showNotification(data.title || "ThermoTrace Nearby Alert", {
    body: data.body || "A verified thermal event was detected near your alert location.",
    icon: "/assets/thermotrace-satellite.jpg",
    badge: "/assets/thermotrace-satellite.jpg",
    tag: data.eventId ? `nearby-${data.eventId}` : "nearby-thermal-alert",
    renotify: false,
    data: { url: data.url || "/monitor", eventId: data.eventId }
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/monitor", self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    for (const client of windows) {
      if ("focus" in client) { client.navigate(target); return client.focus(); }
    }
    return clients.openWindow(target);
  }));
});
