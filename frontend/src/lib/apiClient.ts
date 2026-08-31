const API_BASE_URL =
  typeof window !== "undefined"
    ? "/api/v1"
    : process.env.INTERNAL_BACKEND_URL
      ? `${process.env.INTERNAL_BACKEND_URL}/api/v1`
      : "http://backend:8000/api/v1";

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

async function get<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<T> {
  const suffix = query(params);

  const response = await fetch(
    `${API_BASE_URL}${path}${suffix ? `?${suffix}` : ""}`
  );

  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }

  return response.json();
}

export async function fetchHealth() {
  return get<any>("/health");
}

export function fetchGisEvents(
  viewport: Viewport = DEFAULT_VIEWPORT,
  filters: EventFilters = {}
) {
  return get<GeoCollection>("/gis/events", {
    ...viewport,
    ...filters,
  });
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
  sessionId?: string
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
