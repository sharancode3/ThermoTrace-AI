import {
  getAllCachedFeatures,
  getLastSyncUtc,
  getLastSyncTime,
  setLastSyncMeta,
  saveFeaturesToCache,
  filterCachedFeatures,
  clearEventCache,
} from "./eventCache";

export { clearEventCache };

const API_BASE_URL = "/api/v1";

export type Viewport = {
  west: number;
  south: number;
  east: number;
  north: number;
  zoom: number;
};

const DEFAULT_VIEWPORT: Viewport = {
  west: 68,
  south: 8.3,
  east: 96.98,
  north: 36.74,
  zoom: 4.8,
};

export type GeoFeature = {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: Record<string, any>;
};

export type GeoCollection = {
  type: "FeatureCollection";
  features: GeoFeature[];
};

export type EventFilters = {
  start_time?: string;
  end_time?: string;
  classification?: string;
  anomaly_tier?: string;
  show_all?: boolean;
  focus_event_id?: string;
  hours?: number;
};

function query(
  params: Record<string, string | number | boolean | undefined>
) {
  const values = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      values.set(key, String(value));
    }
  });

  return values.toString();
}

// Client-Side Cache with sessionStorage + memory fallback (10-minute TTL)
interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function clearClientCache(): void {
  memoryCache.clear();
  if (typeof window !== "undefined") {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const k = window.sessionStorage.key(i);
        if (k && k.startsWith("thermo_cache_")) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => window.sessionStorage.removeItem(k));
    } catch {
      // ignore
    }
  }
}

function getCached<T>(key: string): T | null {
  const now = Date.now();
  const mem = memoryCache.get(key);
  if (mem && now - mem.timestamp < CACHE_TTL_MS) {
    return mem.data;
  }
  if (typeof window !== "undefined") {
    try {
      const raw = window.sessionStorage.getItem(`thermo_cache_${key}`);
      if (raw) {
        const parsed = JSON.parse(raw) as CacheEntry<T>;
        if (now - parsed.timestamp < CACHE_TTL_MS) {
          memoryCache.set(key, parsed);
          return parsed.data;
        } else {
          window.sessionStorage.removeItem(`thermo_cache_${key}`);
        }
      }
    } catch {
      // ignore
    }
  }
  return null;
}

function setCached<T>(key: string, data: T): void {
  const entry: CacheEntry<T> = { timestamp: Date.now(), data };
  memoryCache.set(key, entry);
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(`thermo_cache_${key}`, JSON.stringify(entry));
    } catch {
      // ignore storage quota errors
    }
  }
}

async function get<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
  forceRefresh: boolean = false
): Promise<T> {
  const suffix = query(params);
  const cacheKey = `${path}?${suffix}`;

  if (!forceRefresh) {
    const cached = getCached<T>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const response = await fetch(
    `${API_BASE_URL}${path}${suffix ? `?${suffix}` : ""}`
  );

  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }

  const result = await response.json();
  setCached<T>(cacheKey, result);
  return result;
}

export async function fetchHealth() {
  return get<any>("/health");
}

export async function fetchGisEvents(
  viewport: Viewport = DEFAULT_VIEWPORT,
  filters: EventFilters = {},
  forceRefresh: boolean = false
): Promise<GeoCollection> {
  const now = Date.now();
  const cachedFeatures = await getAllCachedFeatures();
  const lastSyncUtc = await getLastSyncUtc();
  const lastSyncTime = await getLastSyncTime();

  // 1. If we already have cached features and synced recently (within 45s),
  // return filtered cached features directly with 0 network transfer!
  if (!forceRefresh && cachedFeatures.length > 0 && (now - lastSyncTime) < 45000) {
    return filterCachedFeatures(cachedFeatures, viewport, filters);
  }

  // 2. Incremental Delta Sync: If we already have a baseline, only request events detected AFTER lastSyncUtc
  try {
    const params: Record<string, any> = {
      show_all: true,
      ...viewport,
      ...filters,
    };

    if (lastSyncUtc && !forceRefresh) {
      params.since_utc = lastSyncUtc;
    }

    const resp = await get<GeoCollection>("/gis/events", params, forceRefresh);

    if (resp.features && resp.features.length > 0) {
      // Merge new delta events into persistent IndexedDB store
      await saveFeaturesToCache(resp.features);
    } else {
      // No new events detected on server: update sync timestamp
      await setLastSyncMeta(null, now);
    }

    const updatedFeatures = await getAllCachedFeatures();
    return filterCachedFeatures(
      updatedFeatures.length > 0 ? updatedFeatures : (resp.features || []),
      viewport,
      filters
    );
  } catch (err) {
    console.warn("[DeltaSync] Background sync failed, serving cached dataset:", err);
    if (cachedFeatures.length > 0) {
      return filterCachedFeatures(cachedFeatures, viewport, filters);
    }
    throw err;
  }
}

export function fetchGisFacilities(viewport: Viewport = DEFAULT_VIEWPORT) {
  return get<GeoCollection>("/gis/facilities", viewport);
}

export function fetchGisObservations(
  viewport: Viewport = DEFAULT_VIEWPORT,
  filters: {
    start_time?: string;
    end_time?: string;
    satellite?: string;
  } = {}
) {
  return get<GeoCollection>("/gis/observations", {
    ...viewport,
    ...filters,
  });
}

export function fetchEventDetail(eventId: string) {
  return get<any>(`/events/${encodeURIComponent(eventId)}`);
}

export const fetchEventIntelligence = fetchEventDetail;

export function fetchEventHistory(eventId: string) {
  return get<any>(
    `/events/${encodeURIComponent(eventId)}/history`
  );
}

export function fetchEventComparison(eventId: string) {
  return get<any>(
    `/events/${encodeURIComponent(eventId)}/compare`
  );
}

export async function fetchNews() {
  return get<any[]>("/news");
}

export async function fetchFirmsStatus() {
  return get<any>("/firms/status");
}

export async function fetchNotifications() {
  return get<any[]>("/notifications");
}

export async function markNotificationRead(id: string) {
  const response = await fetch(
    `${API_BASE_URL}/notifications/${encodeURIComponent(id)}/read`,
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to mark notification as read");
  }

  return response.json();
}

export async function markAllNotificationsRead() {
  const response = await fetch(
    `${API_BASE_URL}/notifications/read-all`,
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to mark notifications as read");
  }

  return response.json();
}

export async function fetchReports() {
  return get<any[]>("/reports");
}

export async function generateReport(
  eventId: string,
  title?: string,
  includedSections?: string[]
) {
  const response = await fetch(
    `${API_BASE_URL}/reports/generate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_id: eventId,
        title: title || undefined,
        included_sections:
          includedSections || [
            "executive_summary",
            "sensor_telemetry",
            "baseline_audit",
          ],
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      text || "Failed to generate report"
    );
  }

  return response.json();
}

export async function askThermalChat(
  queryText: string,
  sessionId?: string,
  selectedEventId?: string | null
) {
  const response = await fetch(
    `${API_BASE_URL}/chat/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: queryText,
        session_id: sessionId,
        selected_event_id: selectedEventId || undefined,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      text || "Failed to query Thermal AI"
    );
  }

  return response.json();
}

export type FacilitySummary = {
  id: string;
  facility_code: string;
  name: string;
  sector_category: string;
  sub_type?: string;
  operator_name?: string;
  state: string;
  district?: string;
  latitude: number;
  longitude: number;
  baseline_frp_mean?: number;
  baseline_frp_std?: number;
  baseline_frp_median?: number;
  historical_event_count: number;
  is_statistically_sufficient: boolean;
  is_active: boolean;
  data_source?: string;
};

export type FacilityListResponse = {
  items: FacilitySummary[];
  total_count: number;
  page: number;
  page_size: number;
  sectors: string[];
  states: string[];
};

export type FacilityHistoricalEvent = {
  event_id: string;
  first_detected_utc: string;
  latest_detected_utc: string;
  peak_frp_mw: number;
  mean_frp_mw: number;
  classification: string;
  anomaly_tier: string;
  z_score?: number;
  confidence_pct?: number;
  observation_count: number;
  distance_to_facility_m?: number;
};

export type FacilityBaselineProfile = {
  sample_observation_count: number;
  mean_frp_mw: number;
  std_frp_mw: number;
  median_frp_mw: number;
  q75_frp_mw: number;
  q95_frp_mw: number;
  max_recorded_frp_mw: number;
  is_statistically_sufficient: boolean;
  calculated_at?: string;
};

export type GroundedBrief = {
  observed: string[];
  derived: string[];
  modelled: string[];
  unknown: string[];
  narrative_summary: string;
};

export type FacilityIntelligence = {
  facility: FacilitySummary;
  baseline_profile?: FacilityBaselineProfile;
  window_days: number;
  window_metrics: {
    total_events: number;
    distinct_active_days: number;
    mean_frp_mw: number;
    peak_frp_mw: number;
    longest_streak_days: number;
    activity_trend: string;
    classification_counts: Record<string, number>;
    anomaly_tier_counts: Record<string, number>;
    first_detected_in_window?: string;
    latest_detected_in_window?: string;
  };
  historical_events: FacilityHistoricalEvent[];
  land_cover_context: {
    built_up_industrial_pct: number;
    barren_soil_pct: number;
    vegetation_pct: number;
    water_bodies_pct: number;
    buffer_radius_meters: number;
    satellite_source: string;
  };
  grounded_brief: GroundedBrief;
  cached_at: string;
};

export async function fetchFacilities(params: {
  search?: string;
  sector?: string;
  state?: string;
  page?: number;
  page_size?: number;
} = {}): Promise<FacilityListResponse> {
  return get<FacilityListResponse>("/facilities", params);
}

export async function fetchFacilityIntelligence(
  facilityId: string,
  windowDays: number = 30
): Promise<FacilityIntelligence> {
  return get<FacilityIntelligence>(`/facilities/${facilityId}/intelligence`, {
    window_days: windowDays,
  });
}


export async function fetchNationalAnalytics(targetDate?: string): Promise<any> {
  return get<any>('/analytics/national-summary', targetDate && targetDate !== 'ALL' ? { target_date: targetDate } : {});
}
