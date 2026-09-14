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

async function lookupEventWindFallback(eventId: string) {
  try {
    const eventRes = await fetch(`${BACKEND_BASE}/events/${encodeURIComponent(eventId)}`);
    if (!eventRes.ok) {
      return NextResponse.json({
        available: false,
        status: "EVENT_NOT_FOUND",
        reason: "Selected thermal event was not found on backend",
      }, { status: 404 });
    }
    const event = await eventRes.json();
    const lat = Number(event.latitude ?? event.centroid?.coordinates?.[1]);
    const lon = Number(event.longitude ?? event.centroid?.coordinates?.[0]);
    const timeStr = event.latest_detected_utc;

    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !timeStr) {
      return NextResponse.json({
        available: false,
        status: "WIND_DATA_UNAVAILABLE",
        reason: "Event coordinates or observation timestamp unavailable",
      }, { status: 200 });
    }

    const requestedAt = new Date(timeStr);
    const now = new Date();
    const isHistorical = requestedAt.getTime() < now.getTime() - 48 * 3600 * 1000;

    let url: string;
    let source: string;
    let dataKind: "HISTORICAL_REANALYSIS" | "FORECAST_MODEL";

    if (isHistorical) {
      const dateStr = requestedAt.toISOString().slice(0, 10);
      url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&hourly=wind_speed_10m,wind_direction_10m&start_date=${dateStr}&end_date=${dateStr}&timezone=UTC&wind_speed_unit=kmh`;
      source = "Open-Meteo archive (ERA5 reanalysis)";
      dataKind = "HISTORICAL_REANALYSIS";
    } else {
      url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=wind_speed_10m,wind_direction_10m&forecast_days=2&past_days=2&timezone=UTC&wind_speed_unit=kmh`;
      source = "Open-Meteo forecast model";
      dataKind = "FORECAST_MODEL";
    }

    const meteoRes = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!meteoRes.ok) {
      return NextResponse.json({
        available: false,
        status: isHistorical ? "HISTORICAL_WIND_DATA_UNAVAILABLE" : "WIND_DATA_UNAVAILABLE",
        reason: `Provider request failed with status ${meteoRes.status}`,
      }, { status: 200 });
    }

    const payload = await meteoRes.json();
    const times: string[] = payload?.hourly?.time || [];
    const speeds: (number | null)[] = payload?.hourly?.wind_speed_10m || [];
    const directions: (number | null)[] = payload?.hourly?.wind_direction_10m || [];

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
      }, { status: 200 });
    }

    const speedKmh = Math.round(Number(speeds[bestIdx]) * 10) / 10;
    const directionFrom = Math.round(((Number(directions[bestIdx]) % 360 + 360) % 360) * 10) / 10;
    const directionToward = Math.round(((directionFrom + 180) % 360) * 10) / 10;
    const obsTime = new Date(times[bestIdx].replace("Z", "") + "Z");
    const isStale = Math.abs(obsTime.getTime() - requestedAt.getTime()) > 2 * 3600 * 1000;

    return NextResponse.json({
      available: true,
      data_kind: dataKind,
      source,
      requested_at: requestedAt.toISOString(),
      timestamp: obsTime.toISOString(),
      stale: isStale,
      latitude: lat,
      longitude: lon,
      speed_kmh: speedKmh,
      direction_from_degrees: directionFrom,
      direction_from_cardinal: compassDirection(directionFrom),
      direction_toward_degrees: directionToward,
      direction_toward_cardinal: compassDirection(directionToward),
    }, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=120, stale-while-revalidate=300",
      },
    });
  } catch (err: any) {
    console.error("[WIND FALLBACK ERROR]", err);
    return NextResponse.json({
      available: false,
      status: "WIND_DATA_UNAVAILABLE",
      reason: err.message || "Failed to retrieve real wind telemetry",
    }, { status: 200 });
  }
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

    // If backend returns 404 for events/{id}/wind, invoke centralized provider fallback
    const windMatch = subPath.match(/^events\/([^/]+)\/wind$/);
    if (backendRes.status === 404 && isGet && windMatch) {
      return await lookupEventWindFallback(windMatch[1]);
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
