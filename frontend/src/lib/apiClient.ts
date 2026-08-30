const API_BASE_URL = typeof window !== "undefined" ? "/api/v1" : (process.env.INTERNAL_BACKEND_URL ? `${process.env.INTERNAL_BACKEND_URL}/api/v1` : "http://backend:8000/api/v1");
export type Viewport = { west: number; south: number; east: number; north: number; zoom: number };
export type GeoFeature = { type: "Feature"; geometry: { type: "Point"; coordinates: [number, number] }; properties: Record<string, any> };
export type GeoCollection = { type: "FeatureCollection"; features: GeoFeature[] };
function query(params: Record<string, string | number | undefined>) { const values = new URLSearchParams(); Object.entries(params).forEach(([key, value]) => value !== undefined && values.set(key, String(value))); return values.toString(); }
async function get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> { const suffix = query(params); const response = await fetch(`${API_BASE_URL}${path}${suffix ? `?${suffix}` : ""}`); if (!response.ok) throw new Error(`Request failed (${response.status})`); return response.json(); }
export function fetchGisEvents(viewport: Viewport, filters: { start_time?: string; end_time?: string } = {}) { return get<GeoCollection>("/gis/events", { ...viewport, ...filters }); }
export function fetchGisFacilities(viewport: Viewport) { return get<GeoCollection>("/gis/facilities", viewport); }
export function fetchGisObservations(viewport: Viewport, filters: { start_time?: string; end_time?: string } = {}) { return get<GeoCollection>("/gis/observations", { ...viewport, ...filters }); }
export function fetchEventDetail(eventId: string) { return get<any>(`/events/${encodeURIComponent(eventId)}`); }
export const fetchEventIntelligence = fetchEventDetail;
export function fetchEventHistory(eventId: string) { return get<any>(`/events/${encodeURIComponent(eventId)}/history`); }
export function fetchEventComparison(eventId: string) { return get<any>(`/events/${encodeURIComponent(eventId)}/compare`); }
export async function fetchHealth() { return get<any>("/health"); }
export async function fetchNews() { return get<any[]>("/news"); }
export async function fetchFirmsStatus() { return get<any>("/firms/status"); }
