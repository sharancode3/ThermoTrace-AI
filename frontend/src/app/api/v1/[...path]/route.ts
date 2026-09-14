import { NextRequest, NextResponse } from "next/server";

const ACTIVE_BACKEND = "https://thermotrace-ai-5tao.onrender.com/api/v1";
let rawBackend = process.env.INTERNAL_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || ACTIVE_BACKEND;

// Automatically override old suspended URLs while allowing local dev, Docker, and Render
if (!rawBackend || (!rawBackend.includes("5tao") && !rawBackend.includes("localhost") && !rawBackend.includes("127.0.0.1") && !rawBackend.includes("backend"))) {
  rawBackend = ACTIVE_BACKEND;
}

const BACKEND_BASE = rawBackend.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "") + "/api/v1";

function compassDirection(degrees: number): string {
  const points = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const idx = Math.floor(((degrees % 360 + 360) % 360 + 11.25) / 22.5) % 16;
  return points[idx];
}

async function lookupCoordinatesWind(
  lat: number,
  lon: number,
  timeStr: string | null,
  targetType: "EVENT" | "FACILITY",
  targetId: string,
  extraMeta: Record<string, any> = {}
) {
  try {
    const requestedAt = timeStr ? new Date(timeStr) : new Date();
    const now = new Date();
    const isHistorical = requestedAt.getTime() < now.getTime() - 48 * 3600 * 1000;

    let url: string;
    let source: string;
    const dataKind = isHistorical ? "HISTORICAL_REANALYSIS" : "FORECAST_MODEL";

    const hourlyFields = "wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,relative_humidity_2m,surface_pressure,precipitation";
    if (isHistorical) {
      const dateStr = requestedAt.toISOString().slice(0, 10);
      url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&hourly=${hourlyFields}&start_date=${dateStr}&end_date=${dateStr}&timezone=UTC&wind_speed_unit=kmh`;
      source = "Open-Meteo archive (ERA5 reanalysis)";
    } else {
      url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=${hourlyFields}&forecast_days=2&past_days=2&timezone=UTC&wind_speed_unit=kmh`;
      source = "Open-Meteo forecast model";
    }

    const meteoRes = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!meteoRes.ok) {
      return NextResponse.json({
        available: false,
        status: isHistorical ? "HISTORICAL_WIND_DATA_UNAVAILABLE" : "WIND_DATA_UNAVAILABLE",
        reason: `Provider request failed with status ${meteoRes.status}`,
        target_type: targetType,
        target_id: targetId,
        latitude: lat,
        longitude: lon,
      }, { status: 200 });
    }

    const payload = await meteoRes.json();
    const times: string[] = payload?.hourly?.time || [];
    const speeds: (number | null)[] = payload?.hourly?.wind_speed_10m || [];
    const directions: (number | null)[] = payload?.hourly?.wind_direction_10m || [];
    const gusts: (number | null)[] = payload?.hourly?.wind_gusts_10m || [];
    const temps: (number | null)[] = payload?.hourly?.temperature_2m || [];
    const humidities: (number | null)[] = payload?.hourly?.relative_humidity_2m || [];
    const pressures: (number | null)[] = payload?.hourly?.surface_pressure || [];
    const precips: (number | null)[] = payload?.hourly?.precipitation || [];

    let bestDiff = Infinity;
    let bestIdx = -1;

    for (let i = 0; i < times.length; i++) {
      if (speeds[i] == null || directions[i] == null) continue;
      const t = new Date(times[i].replace("Z", "") + "Z").getTime();
      const diff = Math.abs(t - requestedAt.getTime());
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) {
      return NextResponse.json({
        available: false,
        status: isHistorical ? "HISTORICAL_WIND_DATA_UNAVAILABLE" : "WIND_DATA_UNAVAILABLE",
        reason: "Provider response did not contain usable hourly wind values",
        target_type: targetType,
        target_id: targetId,
      }, { status: 200 });
    }

    const speedKmh = Math.round(Number(speeds[bestIdx]) * 10) / 10;
    const directionFrom = Math.round(((Number(directions[bestIdx]) % 360 + 360) % 360) * 10) / 10;
    const directionToward = Math.round(((directionFrom + 180) % 360) * 10) / 10;
    const obsTime = new Date(times[bestIdx].replace("Z", "") + "Z");
    const timeDiffSec = Math.round(Math.abs(obsTime.getTime() - requestedAt.getTime()) / 1000);
    const isStale = timeDiffSec > 2 * 3600;
    const isLight = speedKmh < 3.0;

    const status = isLight ? "LIGHT_VARIABLE_WIND" : (isStale ? "STALE" : "AVAILABLE");
    const reason = isLight
      ? "Light/variable wind (< 3 km/h); directional transport is uncertain."
      : (isStale ? "Provider record is outside nominal 2h observation window." : undefined);

    return NextResponse.json({
      available: true,
      status,
      reason,
      target_type: targetType,
      target_id: targetId,
      data_kind: dataKind,
      source,
      provider: "Open-Meteo",
      requested_at: requestedAt.toISOString(),
      timestamp: obsTime.toISOString(),
      time_difference_seconds: timeDiffSec,
      stale: isStale,
      latitude: Math.round(lat * 100000) / 100000,
      longitude: Math.round(lon * 100000) / 100000,
      speed_kmh: speedKmh,
      speed_units: "km/h",
      direction_from_degrees: directionFrom,
      direction_from_cardinal: compassDirection(directionFrom),
      direction_toward_degrees: directionToward,
      direction_toward_cardinal: compassDirection(directionToward),
      gusts_kmh: gusts[bestIdx] != null ? Math.round(Number(gusts[bestIdx]) * 10) / 10 : null,
      gusts_units: "km/h",
      temperature_c: temps[bestIdx] != null ? Math.round(Number(temps[bestIdx]) * 10) / 10 : null,
      temperature_units: "°C",
      relative_humidity_pct: humidities[bestIdx] != null ? Math.round(Number(humidities[bestIdx]) * 10) / 10 : null,
      surface_pressure_hpa: pressures[bestIdx] != null ? Math.round(Number(pressures[bestIdx]) * 10) / 10 : null,
      surface_pressure_units: "hPa",
      precipitation_mm: precips[bestIdx] != null ? Math.round(Number(precips[bestIdx]) * 100) / 100 : 0.0,
      precipitation_units: "mm",
      ...extraMeta,
    }, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=120, stale-while-revalidate=300",
      },
    });
  } catch (err: any) {
    console.error("[WEATHER FALLBACK ERROR]", err);
    return NextResponse.json({
      available: false,
      status: "WIND_DATA_UNAVAILABLE",
      reason: err.message || "Failed to retrieve real wind telemetry",
      target_type: targetType,
      target_id: targetId,
    }, { status: 200 });
  }
}

async function lookupEventWindFallback(eventId: string, queryParams: URLSearchParams) {
  let lat = Number(queryParams.get("latitude"));
  let lon = Number(queryParams.get("longitude"));
  let timeStr = queryParams.get("timestamp");

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    try {
      const eventRes = await fetch(`${BACKEND_BASE}/events/${encodeURIComponent(eventId)}`);
      if (eventRes.ok) {
        const event = await eventRes.json();
        lat = Number(event.latitude ?? event.centroid?.coordinates?.[1]);
        lon = Number(event.longitude ?? event.centroid?.coordinates?.[0]);
        timeStr = event.latest_detected_utc || event.first_detected_utc;
      }
    } catch {
      // ignore
    }
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({
      available: false,
      status: "EVENT_NOT_FOUND",
      reason: `Thermal event '${eventId}' was not found on backend and coordinates not supplied.`,
      target_type: "EVENT",
      target_id: eventId,
    }, { status: 404 });
  }

  return lookupCoordinatesWind(lat, lon, timeStr, "EVENT", eventId);
}

async function lookupFacilityWindFallback(facilityId: string, queryParams: URLSearchParams) {
  let lat = Number(queryParams.get("latitude"));
  let lon = Number(queryParams.get("longitude"));
  let timeStr = queryParams.get("timestamp");
  let facilityName = "Strategic Facility";
  let facilityCode = facilityId;
  let sectorCategory = "Industrial";

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    try {
      const facRes = await fetch(`${BACKEND_BASE}/facilities/${encodeURIComponent(facilityId)}/intelligence`);
      if (facRes.ok) {
        const fac = await facRes.json();
        const coords = fac?.facility?.coordinates;
        if (Array.isArray(coords)) {
          lon = coords[0];
          lat = coords[1];
        }
        facilityName = fac?.facility?.name || facilityName;
        facilityCode = fac?.facility?.facility_code || facilityCode;
        sectorCategory = fac?.facility?.sector_category || sectorCategory;
      }
    } catch {
      // ignore
    }
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({
      available: false,
      status: "FACILITY_NOT_FOUND",
      reason: `Strategic facility '${facilityId}' was not found on backend and coordinates not supplied.`,
      target_type: "FACILITY",
      target_id: facilityId,
    }, { status: 404 });
  }

  return lookupCoordinatesWind(lat, lon, timeStr, "FACILITY", facilityId, {
    facility_name: facilityName,
    facility_code: facilityCode,
    sector_category: sectorCategory,
    ambient_context_notice: "Ambient surface wind context at facility location. Does not assert or model facility emissions or particulate dispersion.",
  });
}

async function proxy(request: NextRequest, context: { params: Promise<{ path?: string[] }> | { path?: string[] } }) {
  const resolvedParams = context.params instanceof Promise ? await context.params : context.params;
  const subPath = Array.isArray(resolvedParams?.path) ? resolvedParams.path.join("/") : "";
  const search = request.nextUrl.search || "";
  const targetUrl = `${BACKEND_BASE}/${subPath}${search}`;

  try {
    const headers: Record<string, string> = {};
    request.headers.forEach((val, key) => {
      const k = key.toLowerCase();
      if (k !== "host" && k !== "connection" && k !== "content-length") {
        headers[key] = val;
      }
    });

    const isGet = request.method === "GET" || request.method === "HEAD";
    const init: RequestInit = {
      method: request.method,
      headers,
      cache: isGet ? "default" : "no-store",
    };

    if (!isGet) {
      init.body = await request.arrayBuffer();
    }

    const backendRes = await fetch(targetUrl, init);

    // If backend returns 404 for events/{id}/wind or facilities/{id}/wind, invoke unified provider fallback
    const eventWindMatch = subPath.match(/^events\/([^/]+)\/wind$/);
    if (backendRes.status === 404 && isGet && eventWindMatch) {
      return await lookupEventWindFallback(eventWindMatch[1], request.nextUrl.searchParams);
    }

    const facilityWindMatch = subPath.match(/^facilities\/([^/]+)\/wind$/);
    if (backendRes.status === 404 && isGet && facilityWindMatch) {
      return await lookupFacilityWindFallback(facilityWindMatch[1], request.nextUrl.searchParams);
    }

    const body = await backendRes.arrayBuffer();

    const responseHeaders = new Headers();
    backendRes.headers.forEach((val, key) => {
      responseHeaders.set(key, val);
    });

    if (isGet && backendRes.ok) {
      // Allow browser and edge proxy to cache responses for 2 minutes to conserve egress
      responseHeaders.set("Cache-Control", "public, max-age=120, stale-while-revalidate=300");
    }

    return new NextResponse(body, {
      status: backendRes.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    console.error(`[API PROXY ERROR] Failed to proxy to ${targetUrl}:`, err);
    return NextResponse.json({ error: err.message, targetUrl }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
