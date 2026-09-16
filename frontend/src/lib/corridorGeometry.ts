/**
 * Pure Geospatial Corridor Mathematics Engine
 *
 * Implements physical advection distances, directional uncertainty sectors,
 * geodesic destination projections, directional arrowhead geometries,
 * and low-wind radial dispersion zones.
 *
 * Used uniformly across the primary tactical map and embedded detection footprint aerials.
 */

export interface CorridorParams {
  longitude: number;
  latitude: number;
  towardDeg: number;
  speedKmh: number;
  gustsKmh?: number | null;
  maxReachKm?: number;
  halfAngleDeg?: number;
}

export interface AdvectionBand {
  minutes: number;
  distanceKm: number;
  label: string;
}

export interface CorridorGeometryResult {
  isLightVariable: boolean;
  reachMeters: number;
  reachKm: number;
  isCapped: boolean;
  advectionBands: AdvectionBand[];
  // GeoJSON Features
  sectorPolygon: GeoJSON.Feature<GeoJSON.Polygon>;
  sectorOutline: GeoJSON.Feature<GeoJSON.LineString>;
  centerline: GeoJSON.Feature<GeoJSON.LineString>;
  arrowhead: GeoJSON.Feature<GeoJSON.Polygon> | null;
  advectionArcs: GeoJSON.FeatureCollection<GeoJSON.LineString>;
  gustEnvelope: GeoJSON.Feature<GeoJSON.Polygon> | null;
  radialUncertainty: GeoJSON.Feature<GeoJSON.Polygon> | null;
  // Unified FeatureCollection containing all layers for direct single-source MapLibre rendering
  featureCollection: GeoJSON.FeatureCollection;
  // Bounding box for camera fit [minLon, minLat, maxLon, maxLat]
  bounds: [number, number, number, number];
}

const EARTH_RADIUS_M = 6371000;
export const MIN_VISIBLE_REACH_M = 1500; // 1.5 km minimum visible directional length
export const MAX_DISPLAY_REACH_KM = 25.0; // 25 km display cap
export const LOW_WIND_THRESHOLD_KMH = 3.0;
export const CALM_WIND_THRESHOLD_KMH = 1.0;
export const DEFAULT_HALF_ANGLE_DEG = 22.0;

/**
 * Normalizes any bearing into the standard 0-359 integer range.
 */
export function normalizeWindDegrees(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  return ((Math.round(deg) % 360) + 360) % 360;
}

/**
 * Calculates meteorological downwind toward-bearing:
 * toward = from + 180°, normalized into 0-359°.
 *
 * Examples:
 * - From North (0°) -> Toward South (180°)
 * - From East (90°) -> Toward West (270°)
 * - From Southwest (219°) -> Toward Northeast (39°)
 */
export function computeTowardDegrees(fromDegrees: number): number {
  return normalizeWindDegrees(fromDegrees + 180);
}

/**
 * Computes physical advection distance in meters given speed in km/h and duration in minutes.
 */
export function computeAdvectionDistanceM(speedKmh: number, durationMinutes: number): number {
  return Math.max(0, speedKmh) * (durationMinutes / 60) * 1000;
}

/**
 * Calculates accurate geodesic destination point given start point, distance in meters, and bearing in degrees.
 * Returns [longitude, latitude].
 */
export function destinationPoint(
  lon: number,
  lat: number,
  distanceMeters: number,
  bearingDegrees: number
): [number, number] {
  const δ = distanceMeters / EARTH_RADIUS_M; // angular distance in radians
  const θ = (bearingDegrees * Math.PI) / 180; // bearing in radians
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lon * Math.PI) / 180;

  const sinφ2 = Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ);
  const φ2 = Math.asin(Math.max(-1, Math.min(1, sinφ2)));

  const y = Math.sin(θ) * Math.sin(δ) * Math.cos(φ1);
  const x = Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2);
  const λ2 = λ1 + Math.atan2(y, x);

  // Normalize longitude to -180..+180
  const normLon = ((((λ2 * 180) / Math.PI) + 540) % 360) - 180;
  const normLat = (φ2 * 180) / Math.PI;

  return [Math.round(normLon * 1000000) / 1000000, Math.round(normLat * 1000000) / 1000000];
}

/**
 * Builds a geodesic circle polygon around a point for radial uncertainty zones.
 */
export function buildGeodesicCircle(
  lon: number,
  lat: number,
  radiusMeters: number,
  segments: number = 48
): [number, number][] {
  const coordinates: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const bearing = (i / segments) * 360;
    coordinates.push(destinationPoint(lon, lat, radiusMeters, bearing));
  }
  return coordinates;
}

/**
 * Builds a directional arrowhead polygon at the downwind end of the centerline.
 * Oriented precisely along towardDeg.
 *
 * 0° points North, 90° points East, 180° points South, 270° points West, 39° points Northeast.
 */
export function buildArrowheadPolygon(
  lon: number,
  lat: number,
  reachMeters: number,
  towardDeg: number
): [number, number][] {
  const tipDist = reachMeters * 0.98;
  const arrowLen = Math.max(280, Math.min(reachMeters * 0.20, 1400));
  const baseDist = Math.max(0, tipDist - arrowLen);
  const wingWidth = arrowLen * 0.50;

  const tip = destinationPoint(lon, lat, tipDist, towardDeg);
  const baseCenter = destinationPoint(lon, lat, baseDist, towardDeg);
  const notch = destinationPoint(lon, lat, baseDist + arrowLen * 0.25, towardDeg);
  const leftWing = destinationPoint(baseCenter[0], baseCenter[1], wingWidth, (towardDeg - 90 + 360) % 360);
  const rightWing = destinationPoint(baseCenter[0], baseCenter[1], wingWidth, (towardDeg + 90 + 360) % 360);

  return [tip, leftWing, notch, rightWing, tip];
}

/**
 * Builds physical 15-, 30-, and 60-minute surface wind transport corridor.
 */
export function buildAwarenessCorridorGeoJson({
  longitude,
  latitude,
  towardDeg,
  speedKmh,
  gustsKmh,
  maxReachKm = MAX_DISPLAY_REACH_KM,
  halfAngleDeg = DEFAULT_HALF_ANGLE_DEG,
}: CorridorParams): CorridorGeometryResult {
  const safeSpeed = Math.max(0, speedKmh);
  const isNearCalm = safeSpeed < CALM_WIND_THRESHOLD_KMH;
  const isLightVariable = safeSpeed < LOW_WIND_THRESHOLD_KMH;

  // 60-minute surface wind advection distance: distance (km) = wind speed (km/h) * 1 hour
  const d15m = safeSpeed * 0.25 * 1000;
  const d30m = safeSpeed * 0.5 * 1000;
  const d60m = safeSpeed * 1.0 * 1000;

  const maxReachMeters = maxReachKm * 1000;
  // Apply reasonable display limits: min 1.5 km visible directional length, max 25 km display length
  const rawReach = Math.max(d60m, MIN_VISIBLE_REACH_M);
  const reachMeters = Math.min(rawReach, maxReachMeters);
  const isCapped = d60m > maxReachMeters;
  const reachKm = Math.round((reachMeters / 1000) * 10) / 10;

  const effectiveHalfAngle = isLightVariable ? 35.0 : halfAngleDeg;

  const advectionBands: AdvectionBand[] = [
    { minutes: 15, distanceKm: Math.round((d15m / 1000) * 100) / 100, label: "15-min advection" },
    { minutes: 30, distanceKm: Math.round((d30m / 1000) * 100) / 100, label: "30-min advection" },
    { minutes: 60, distanceKm: Math.round((d60m / 1000) * 100) / 100, label: "60-min advection" },
  ];

  const origin: [number, number] = [longitude, latitude];
  let minLon = longitude;
  let maxLon = longitude;
  let minLat = latitude;
  let maxLat = latitude;

  const updateBounds = (pt: [number, number]) => {
    if (pt[0] < minLon) minLon = pt[0];
    if (pt[0] > maxLon) maxLon = pt[0];
    if (pt[1] < minLat) minLat = pt[1];
    if (pt[1] > maxLat) maxLat = pt[1];
  };

  // Case 1: Near-calm (< 1 km/h) -> subtle circular uncertainty area, no misleading narrow cone
  if (isNearCalm) {
    const calmRadiusMeters = 1000;
    const circleCoords = buildGeodesicCircle(longitude, latitude, calmRadiusMeters);
    circleCoords.forEach(updateBounds);

    const radialFeature: GeoJSON.Feature<GeoJSON.Polygon> = {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [circleCoords] },
      properties: {
        type: "radial_uncertainty",
        radius_m: calmRadiusMeters,
        label: "Calm surface wind (< 1 km/h) — directional transport is uncertain",
      },
    };

    const radialOutline: GeoJSON.Feature<GeoJSON.LineString> = {
      type: "Feature",
      geometry: { type: "LineString", coordinates: circleCoords },
      properties: {
        type: "radial_uncertainty_outline",
      },
    };

    const fc: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [radialFeature, radialOutline],
    };

    return {
      isLightVariable: true,
      reachMeters: calmRadiusMeters,
      reachKm: 1.0,
      isCapped: false,
      advectionBands,
      sectorPolygon: radialFeature,
      sectorOutline: radialOutline,
      centerline: {
        type: "Feature",
        geometry: { type: "LineString", coordinates: [origin, origin] },
        properties: { type: "corridor_centerline" },
      },
      arrowhead: null,
      advectionArcs: { type: "FeatureCollection", features: [] },
      gustEnvelope: null,
      radialUncertainty: radialFeature,
      featureCollection: fc,
      bounds: [minLon, minLat, maxLon, maxLat],
    };
  }

  // Case 2: Directional Awareness Corridor
  // 14 smooth arc segments (15 points along outer arc)
  const arcSegments = 14;
  const outerArcPoints: [number, number][] = [];

  for (let i = -arcSegments / 2; i <= arcSegments / 2; i++) {
    const bearingOffset = (i / (arcSegments / 2)) * effectiveHalfAngle;
    const bearing = (towardDeg + bearingOffset + 360) % 360;
    const pt = destinationPoint(longitude, latitude, reachMeters, bearing);
    outerArcPoints.push(pt);
    updateBounds(pt);
  }

  // Sector closed polygon: Origin -> Left Boundary -> Outer Arc -> Right Boundary -> Origin
  const sectorCoordinates = [origin, ...outerArcPoints, origin];

  const sectorPolygon: GeoJSON.Feature<GeoJSON.Polygon> = {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [sectorCoordinates] },
    properties: {
      type: "corridor_fill",
      reach_km: reachKm,
      toward_deg: towardDeg,
      speed_kmh: safeSpeed,
      half_angle_deg: effectiveHalfAngle,
      is_capped: isCapped,
      is_light_variable: isLightVariable,
      notice: isLightVariable ? "Low wind — direction less certain" : undefined,
    },
  };

  const sectorOutline: GeoJSON.Feature<GeoJSON.LineString> = {
    type: "Feature",
    geometry: { type: "LineString", coordinates: sectorCoordinates },
    properties: {
      type: "corridor_outline",
    },
  };

  // Centerline: Origin -> 96% reach downwind
  const centerEnd = destinationPoint(longitude, latitude, reachMeters * 0.96, towardDeg);
  updateBounds(centerEnd);
  const centerline: GeoJSON.Feature<GeoJSON.LineString> = {
    type: "Feature",
    geometry: { type: "LineString", coordinates: [origin, centerEnd] },
    properties: {
      type: "corridor_centerline",
      toward_deg: towardDeg,
    },
  };

  // Arrowhead Chevron Polygon near outer portion of centerline
  const arrowCoords = buildArrowheadPolygon(longitude, latitude, reachMeters, towardDeg);
  arrowCoords.forEach(updateBounds);
  const arrowhead: GeoJSON.Feature<GeoJSON.Polygon> = {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [arrowCoords] },
    properties: {
      type: "corridor_arrow",
      toward_deg: towardDeg,
    },
  };

  // Internal Advection Arcs (15m, 30m)
  const advectionArcFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  [d15m, d30m].forEach((distM, idx) => {
    if (distM >= MIN_VISIBLE_REACH_M * 0.6 && distM < reachMeters * 0.88) {
      const arcPts: [number, number][] = [];
      for (let i = -arcSegments / 2; i <= arcSegments / 2; i++) {
        const bearingOffset = (i / (arcSegments / 2)) * effectiveHalfAngle;
        const bearing = (towardDeg + bearingOffset + 360) % 360;
        arcPts.push(destinationPoint(longitude, latitude, distM, bearing));
      }
      advectionArcFeatures.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: arcPts },
        properties: {
          type: "corridor_arc",
          minutes: idx === 0 ? 15 : 30,
          distance_m: distM,
        },
      });
    }
  });

  // Optional Gust Envelope (dashed outer boundary if gusts > speed)
  let gustEnvelope: GeoJSON.Feature<GeoJSON.Polygon> | null = null;
  if (gustsKmh && gustsKmh > safeSpeed) {
    const gustReachMeters = Math.min(gustsKmh * 1000, maxReachMeters * 1.15);
    const gustArcPoints: [number, number][] = [];
    for (let i = -arcSegments / 2; i <= arcSegments / 2; i++) {
      const bearingOffset = (i / (arcSegments / 2)) * (effectiveHalfAngle * 1.12);
      const bearing = (towardDeg + bearingOffset + 360) % 360;
      const pt = destinationPoint(longitude, latitude, gustReachMeters, bearing);
      gustArcPoints.push(pt);
      updateBounds(pt);
    }
    gustEnvelope = {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [[origin, ...gustArcPoints, origin]] },
      properties: {
        type: "gust_envelope",
        gusts_kmh: gustsKmh,
      },
    };
  }

  // Unified FeatureCollection
  const allFeatures: GeoJSON.Feature[] = [
    sectorPolygon,
    sectorOutline,
    centerline,
    arrowhead,
    ...advectionArcFeatures,
  ];
  if (gustEnvelope) allFeatures.push(gustEnvelope);

  const featureCollection: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: allFeatures,
  };

  return {
    isLightVariable,
    reachMeters,
    reachKm,
    isCapped,
    advectionBands,
    sectorPolygon,
    sectorOutline,
    centerline,
    arrowhead,
    advectionArcs: { type: "FeatureCollection", features: advectionArcFeatures },
    gustEnvelope,
    radialUncertainty: null,
    featureCollection,
    bounds: [minLon, minLat, maxLon, maxLat],
  };
}

/**
 * Generates animated particle/chevron point features along the downwind centreline.
 * @param startLon Event longitude
 * @param startLat Event latitude
 * @param reachMeters Length of downwind corridor in meters
 * @param towardDeg Bearing direction in degrees
 * @param progress Animation progress fraction [0.0..1.0]
 * @param count Number of chevrons/particles (default 5)
 */
export function generateChevronsAlongCentreline(
  startLon: number,
  startLat: number,
  reachMeters: number,
  towardDeg: number,
  progress: number = 0.0,
  count: number = 5
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  const activeReach = reachMeters * 0.90;

  for (let i = 0; i < count; i++) {
    const fraction = ((i / count) + progress) % 1.0;
    const distanceM = activeReach * fraction;
    if (distanceM < 80) continue;
    const pt = destinationPoint(startLon, startLat, distanceM, towardDeg);
    features.push({
      type: "Feature",
      id: `chevron-${i}`,
      geometry: {
        type: "Point",
        coordinates: pt,
      },
      properties: {
        bearing: towardDeg,
        fraction,
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
}
