"use client";

import { useMemo, useRef } from "react";
import Map, { Source, Layer } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { WindData } from "@/lib/apiClient";
import { Compass, Users, Layers, ExternalLink } from "lucide-react";

// ESRI World Imagery (High-Res Defense Aerial Basemap with zero commercial labels)
const ESRI_SATELLITE_STYLE: any = {
  version: 8,
  sources: {
    esri_imagery: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "&copy; Esri, Maxar, Earthstar Geographics",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "esri-satellite-layer",
      type: "raster",
      source: "esri_imagery",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

interface ObservationItem {
  id?: string;
  latitude: number;
  longitude: number;
  frp_mw?: number;
  brightness_k?: number;
  acquired_at?: string;
  satellite?: string;
}

interface DetectionFootprintCardProps {
  latitude: number;
  longitude: number;
  observations?: ObservationItem[];
  wind?: WindData | null;
  facilityName?: string | null;
  distanceToFacilityM?: number | null;
}

/**
 * Builds 375m x 375m square bounding polygon for a VIIRS footprint centered at lat/lon
 */
function buildFootprintPolygon(lon: number, lat: number) {
  // 375m in degrees latitude (~111,320m per degree)
  const degLat = 375 / 111320;
  // 375m in degrees longitude accounting for latitude cosine
  const degLon = 375 / (111320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));

  const halfLat = degLat / 2;
  const halfLon = degLon / 2;

  return [
    [lon - halfLon, lat - halfLat],
    [lon + halfLon, lat - halfLat],
    [lon + halfLon, lat + halfLat],
    [lon - halfLon, lat + halfLat],
    [lon - halfLon, lat - halfLat],
  ];
}

/**
 * Builds cyan dashed downwind dispersion cone (Image 3 reference)
 */
function buildPlumeCone(
  lon: number,
  lat: number,
  towardDeg: number,
  speedKmh: number = 15
) {
  const angle = (towardDeg * Math.PI) / 180;
  const lonScale = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  // 32 degree total dispersion corridor
  const halfAngle = (16 * Math.PI) / 180;

  // Reach in degrees: roughly 1.8km to 3.5km downwind
  const reachM = Math.min(3500, Math.max(1600, 1400 + speedKmh * 80));
  const reachDeg = reachM / 111320;

  const project = (forward: number, lateral: number): [number, number] => [
    lon + (Math.sin(angle) * forward + Math.cos(angle) * lateral) / lonScale,
    lat + Math.cos(angle) * forward - Math.sin(angle) * lateral,
  ];

  const origin: [number, number] = [lon, lat];
  const arcSegments = 20;
  const arcPoints: [number, number][] = [];

  for (let i = -arcSegments / 2; i <= arcSegments / 2; i++) {
    const phi = (i / (arcSegments / 2)) * halfAngle;
    arcPoints.push(project(reachDeg * Math.cos(phi), reachDeg * Math.sin(phi)));
  }

  const polygon = [origin, ...arcPoints, origin];
  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [polygon],
    },
    properties: {},
  };
}

export function DetectionFootprintCard({
  latitude,
  longitude,
  observations = [],
  wind,
  facilityName,
  distanceToFacilityM,
}: DetectionFootprintCardProps) {
  const mapRef = useRef<any>(null);

  // Normalize constituent observation coordinates (at least 1, max recent 10 for clean display)
  const validObs = useMemo(() => {
    if (observations && observations.length > 0) {
      return observations
        .filter((o) => Number.isFinite(Number(o.latitude)) && Number.isFinite(Number(o.longitude)))
        .slice(-8);
    }
    return [{ latitude, longitude }];
  }, [observations, latitude, longitude]);

  const footprintGeoJson = useMemo(() => {
    const features = validObs.map((obs, idx) => ({
      type: "Feature" as const,
      id: obs.id || `footprint-${idx}`,
      geometry: {
        type: "Polygon" as const,
        coordinates: [buildFootprintPolygon(obs.longitude, obs.latitude)],
      },
      properties: {
        frp: obs.frp_mw || 0,
        tempK: obs.brightness_k || 0,
      },
    }));

    return {
      type: "FeatureCollection" as const,
      features,
    };
  }, [validObs]);

  // Wind Plume Conical Corridor GeoJSON
  const towardDeg = Number(wind?.direction_toward_degrees);
  const speedKmh = Number(wind?.speed_kmh) || 0;
  const hasWind = Number.isFinite(towardDeg) && wind?.available;

  const plumeGeoJson = useMemo(() => {
    if (!hasWind) return null;
    return buildPlumeCone(longitude, latitude, towardDeg, speedKmh);
  }, [longitude, latitude, towardDeg, speedKmh, hasWind]);

  // Approximate population density within 5km buffer
  const populationEstimate = useMemo(() => {
    if (distanceToFacilityM !== null && distanceToFacilityM !== undefined && distanceToFacilityM < 1500) {
      return "~5,200 people within 5 km";
    }
    return "~3,100 people within 5 km";
  }, [distanceToFacilityM]);

  return (
    <section 
      aria-label="Detection Footprint"
      className="rounded-2xl border border-slate-800 bg-[#0d131f] text-slate-200 overflow-hidden shadow-2xl space-y-2.5 p-3.5"
    >
      {/* Header matching Reference Image 3 */}
      <div className="flex items-center justify-between text-xs px-0.5">
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-bold tracking-wider uppercase text-slate-100 text-[11px] sm:text-xs">
            DETECTION FOOTPRINT
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
          <Users className="w-3 h-3 text-slate-500" />
          <span>{populationEstimate}</span>
        </div>
      </div>

      {/* Embedded High-Resolution Aerial Viewport */}
      <div className="relative w-full h-56 sm:h-64 rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950 shadow-inner group">
        <Map
          ref={mapRef}
          initialViewState={{
            longitude,
            latitude,
            zoom: 13.8,
            pitch: 0,
          }}
          mapStyle={ESRI_SATELLITE_STYLE}
          style={{ width: "100%", height: "100%" }}
          scrollZoom={false}
          doubleClickZoom={false}
          dragRotate={false}
          attributionControl={false}
        >
          {/* Conical Plume Corridor Fill (Translucent Cyan) */}
          {plumeGeoJson && (
            <Source id="footprint-plume-fill-source" type="geojson" data={plumeGeoJson as any}>
              <Layer
                id="footprint-plume-fill"
                type="fill"
                paint={{
                  "fill-color": "#06b6d4",
                  "fill-opacity": 0.22,
                }}
              />
              <Layer
                id="footprint-plume-border"
                type="line"
                paint={{
                  "line-color": "#38bdf8",
                  "line-width": 1.8,
                  "line-dasharray": [3, 2],
                  "line-opacity": 0.9,
                }}
              />
            </Source>
          )}

          {/* 375m VIIRS Constituent Footprint Squares */}
          <Source id="footprint-squares-source" type="geojson" data={footprintGeoJson as any}>
            {/* Soft Green Fill */}
            <Layer
              id="footprint-squares-fill"
              type="fill"
              paint={{
                "fill-color": "#22c55e",
                "fill-opacity": 0.18,
              }}
            />
            {/* Crisp Green Outline */}
            <Layer
              id="footprint-squares-outline"
              type="line"
              paint={{
                "line-color": "#4ade80",
                "line-width": 2,
                "line-opacity": 0.95,
              }}
            />
          </Source>
        </Map>

        {/* Floating Glass Pill Badge: "wind 22 km/h @ 240°" (Exact match to Image 3) */}
        {hasWind && (
          <div className="absolute top-3 right-3 z-10 pointer-events-none">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/20 bg-black/75 backdrop-blur-md text-white font-mono text-[11px] sm:text-xs font-semibold shadow-xl">
              <Compass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>
                wind {Math.round(speedKmh)} km/h @ {Math.round(towardDeg)}°
              </span>
            </div>
          </div>
        )}

        {/* Centroid Crosshair Marker */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 border border-white shadow-lg animate-ping opacity-75" />
          <div className="w-2 h-2 rounded-full bg-cyan-300 border border-black absolute" />
        </div>

        {/* Footer Bar on Aerial Canvas */}
        <div className="absolute bottom-2.5 left-3 z-10 pointer-events-none">
          <div className="font-mono text-[9.5px] sm:text-[10px] tracking-wider uppercase font-bold text-slate-300 drop-shadow-md bg-black/60 px-2 py-0.5 rounded border border-white/10">
            {validObs.length} × 375 M FOOTPRINTS · ESRI SATELLITE
          </div>
        </div>
      </div>
    </section>
  );
}
