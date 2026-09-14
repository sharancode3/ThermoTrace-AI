export type NearbyAlert = {
  id: string; event_id: string; title: string; message: string;
  severity: "CRITICAL" | "ABNORMAL"; classification?: string | null;
  peak_frp_mw?: number | null; latitude?: number | null; longitude?: number | null;
  distance_km?: number | null; bearing_cardinal?: string | null;
  is_downwind_hazard?: boolean | null;
  is_read: boolean; created_at?: string | null;
};

export type NearbyPreferences = {
  enabled: boolean; notify_critical: boolean; notify_abnormal: boolean;
  has_alert_location: boolean; location_updated_at?: string | null; vapid_public_key?: string | null;
};

export function getDeviceUserId(): string {
  const key = "thermotrace_device_user_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("X-Thermotrace-User-ID", getDeviceUserId());
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`/api/v1/notifications/nearby${path}`, { ...init, headers, cache: "no-store" });
  if (!response.ok) throw new Error((await response.text()) || `Nearby alerts request failed (${response.status})`);
  return response.json();
}

export const fetchNearbyAlerts = () => request<NearbyAlert[]>("");
export const fetchNearbyPreferences = () => request<NearbyPreferences>("/preferences");
export const updateNearbyPreferences = (preferences: Pick<NearbyPreferences, "enabled" | "notify_critical" | "notify_abnormal">) =>
  request<NearbyPreferences>("/preferences", { method: "PUT", body: JSON.stringify(preferences) });
export const updateAlertLocation = (latitude: number, longitude: number) =>
  request<NearbyPreferences>("/location", { method: "PUT", body: JSON.stringify({ latitude, longitude }) });
export const markNearbyRead = (id: string) => request(`/${encodeURIComponent(id)}/read`, { method: "POST" });
export const markAllNearbyRead = () => request("/read-all", { method: "POST" });

function base64UrlToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0))) as Uint8Array<ArrayBuffer>;
}

export async function enableWebPush(vapidPublicKey: string): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("Background push is not supported by this browser.");
  const registration = await navigator.serviceWorker.register("/sw.js");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Browser notification permission was not granted.");
  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(vapidPublicKey) });
  await request("/push-subscriptions", { method: "POST", body: JSON.stringify(subscription.toJSON()) });
}
