const API_BASE_URL = typeof window !== "undefined" 
  ? "/api/v1" 
  : (process.env.INTERNAL_BACKEND_URL ? `${process.env.INTERNAL_BACKEND_URL}/api/v1` : "http://backend:8000/api/v1");

export async function fetchHealth() {
  const res = await fetch(`${API_BASE_URL}/health`);
  if (!res.ok) throw new Error("Failed to fetch health status");
  return res.json();
}

export async function fetchGisEvents() {
  const res = await fetch(`${API_BASE_URL}/gis/events`);
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

export async function fetchFirmsStatus() {
  const res = await fetch(`${API_BASE_URL}/firms/status`);
  if (!res.ok) throw new Error("Failed to fetch FIRMS status");
  return res.json();
}