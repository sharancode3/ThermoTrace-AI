const API_BASE_URL = typeof window !== "undefined" 
  ? "/api/v1" 
  : (process.env.INTERNAL_BACKEND_URL ? `${process.env.INTERNAL_BACKEND_URL}/api/v1` : "http://backend:8000/api/v1");

export async function fetchHealth() {
  const res = await fetch(`${API_BASE_URL}/health`);
  if (!res.ok) throw new Error("Failed to fetch health status");
  return res.json();
}

export async function fetchGisEvents(showAll: boolean = false, focusEventId?: string | null) {
  const params = new URLSearchParams();
  if (showAll) params.set("show_all", "true");
  if (focusEventId) params.set("focus_event_id", focusEventId);
  const queryStr = params.toString();
  const res = await fetch(`${API_BASE_URL}/gis/events${queryStr ? `?${queryStr}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch GIS events");
  return res.json();
}

export async function fetchGisFacilities() {
  const res = await fetch(`${API_BASE_URL}/gis/facilities`);
  if (!res.ok) throw new Error("Failed to fetch GIS facilities");
  return res.json();
}

export async function fetchEventDetail(eventId: string) {
  const res = await fetch(`${API_BASE_URL}/events/${eventId}`);
  if (!res.ok) throw new Error("Failed to fetch event detail");
  return res.json();
}

export const fetchEventIntelligence = fetchEventDetail;

export async function fetchNews() {
  const res = await fetch(`${API_BASE_URL}/news`);
  if (!res.ok) throw new Error("Failed to fetch news feed");
  return res.json();
}

export async function fetchNotifications() {
  const res = await fetch(`${API_BASE_URL}/notifications`);
  if (!res.ok) throw new Error("Failed to fetch notifications");
  return res.json();
}

export async function markNotificationRead(id: string) {
  const res = await fetch(`${API_BASE_URL}/notifications/${id}/read`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to mark notification as read");
  return res.json();
}

export async function markAllNotificationsRead() {
  const res = await fetch(`${API_BASE_URL}/notifications/read-all`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to mark all notifications as read");
  return res.json();
}

export async function fetchReports() {
  const res = await fetch(`${API_BASE_URL}/reports`);
  if (!res.ok) throw new Error("Failed to fetch reports");
  return res.json();
}

export async function generateReport(eventId: string, title?: string, includedSections?: string[]) {
  const res = await fetch(`${API_BASE_URL}/reports/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event_id: eventId,
      title: title || undefined,
      included_sections: includedSections || ["executive_summary", "sensor_telemetry", "baseline_audit"],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to generate report");
  }
  return res.json();
}

export async function fetchFirmsStatus() {
  const res = await fetch(`${API_BASE_URL}/firms/status`);
  if (!res.ok) throw new Error("Failed to fetch FIRMS status");
  return res.json();
}

export async function askThermalChat(query: string, sessionId?: string) {
  const res = await fetch(`${API_BASE_URL}/chat/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      session_id: sessionId,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to query Thermal AI");
  }

  return res.json();
}
