"use client";

import { useEffect, useMemo, useRef } from "react";
import Map, { Marker } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { WindData } from "@/lib/apiClient";
import { buildAwarenessCorridorGeoJson, generateChevronsAlongCentreline } from "@/lib/corridorGeometry";
import { syncWindCorridorToMap, syncFootprintSquaresToMap, syncWindChevronsToMap } from "@/lib/windLayerHelper";
import { Users } from "lucide-react";

// ESRI World Imagery (High-Res Aerial Basemap with zero commercial labels)
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
 * Builds nominal 375m x 375m square bounding polygon for a VIIRS footprint centered at lat/lon
 */
function buildFootprintPolygon(lon: number, lat: number) {
  const degLat = 375 / 111320;
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

export function DetectionFootprintCard({
  latitude,
  longitude,
  observations = [],
  wind,
  facilityName,
  distanceToFacilityM,
}: DetectionFootprintCardProps) {
  const mapRef = useRef<any>(null);

  // Constituent observation coordinates: exactly 1 real observation = 1 footprint box.
  // Never fabricate or hallucinate synthetic pixel boxes.
  const validObs = useMemo(() => {
    if (observations && observations.length > 0) {
      const filtered = observations
        .filter((o) => Number.isFinite(Number(o.latitude)) && Number.isFinite(Number(o.longitude)))
        .slice(-8);
      if (filtered.length > 0) return filtered;
    }
    if (Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))) {
      return [{ latitude: Number(latitude), longitude: Number(longitude) }];
    }
    return [];
  }, [observations, latitude, longitude]);

  const footprintGeoJson = useMemo(() => {
    const features = validObs.map((obs, idx) => ({
      type: "Feature" as const,
      id: `footprint-${idx}`,
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

  // Downwind Awareness Corridor GeoJSON using shared pure geospatial engine
  const towardDeg = Number(wind?.direction_toward_degrees);
  const speedKmh = Number(wind?.speed_kmh) || 0;
  const gustsKmh = Number(wind?.gusts_kmh) || null;
  const hasWind = Number.isFinite(towardDeg) && Boolean(wind?.available);

  const corridorGeo = useMemo(() => {
    if (!hasWind) return null;
    return buildAwarenessCorridorGeoJson({
      longitude,
      latitude,
      towardDeg,
      speedKmh,
      gustsKmh,
    });
  }, [longitude, latitude, towardDeg, speedKmh, gustsKmh, hasWind]);

  // Synchronize Wind Corridor and Footprint Squares to MapLibre
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const syncAll = () => {
      syncWindCorridorToMap({
        map,
        sourceId: "footprint-wind-corridor-source",
        layerPrefix: "footprint-wind-corridor",
        corridorResult: corridorGeo || null,
        featureCollection: corridorGeo?.featureCollection || null,
        isSatellite: true,
        visible: Boolean(hasWind && corridorGeo),
      });
      syncFootprintSquaresToMap(map, footprintGeoJson);
    };

    syncAll();
    map.on("styledata", syncAll);
    map.on("style.load", syncAll);
    map.on("load", syncAll);

    return () => {
      map.off("styledata", syncAll);
      map.off("style.load", syncAll);
      map.off("load", syncAll);
    };
  }, [corridorGeo, footprintGeoJson, hasWind]);

  // Moving Chevron Animation Frame Loop along downwind centreline
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !hasWind || !corridorGeo || corridorGeo.isLightVariable) return;

    const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    let animFrameId: number;
    let startTime: number | null = null;
    const speedMultiplier = Math.min(2.5, Math.max(0.5, speedKmh / 10));

    const animate = (timestamp: number) => {
      if (document.hidden) {
        animFrameId = requestAnimationFrame(animate);
        return;
      }

      if (!startTime) startTime = timestamp;
      const elapsedSec = (timestamp - startTime) / 1000;
      const progress = (elapsedSec * 0.35 * speedMultiplier) % 1.0;

      const chevrons = generateChevronsAlongCentreline(
        longitude,
        latitude,
        corridorGeo.reachMeters,
        towardDeg,
        progress,
        5
      );

      syncWindChevronsToMap(
        map,
        "footprint-wind-corridor-source",
        "footprint-wind-corridor",
        chevrons,
        true,
        true
      );

      animFrameId = requestAnimationFrame(animate);
    };

    animFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [longitude, latitude, towardDeg, speedKmh, corridorGeo, hasWind]);

  // Camera framing using authoritative combined bounds (corridor + footprints)
  const boundsKey = corridorGeo?.bounds ? corridorGeo.bounds.join(",") : "";
  useEffect(() => {
    if (!mapRef.current) return;
    if (corridorGeo?.bounds) {
      let [minLon, minLat, maxLon, maxLat] = corridorGeo.bounds;
      validObs.forEach((obs) => {
        if (obs.longitude < minLon) minLon = obs.longitude;
        if (obs.longitude > maxLon) maxLon = obs.longitude;
        if (obs.latitude < minLat) minLat = obs.latitude;
        if (obs.latitude > maxLat) maxLat = obs.latitude;
      });
      mapRef.current.fitBounds(
        [
          [minLon, minLat],
          [maxLon, maxLat],
        ],
        {
          padding: 36,
          maxZoom: 14.5,
          duration: 600,
        }
      );
    } else {
      mapRef.current.flyTo({
        center: [longitude, latitude],
        zoom: 13.5,
        duration: 600,
      });
    }
  }, [boundsKey, longitude, latitude, validObs]);

  return (
    <section 
      aria-label="Detection Footprint"
      className="rounded-xl border border-slate-200 bg-white text-slate-800 overflow-hidden shadow-sm space-y-2.5 p-3.5"
    >
      {/* Header matching site light theme */}
      <div className="flex items-center justify-between text-xs px-0.5">
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-bold tracking-wider uppercase text-slate-900 text-xs">
            DETECTION FOOTPRINT
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500" title="Population layer is not actively ingested for this sector">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span>Population exposure data unavailable</span>
        </div>
      </div>

      {/* Embedded High-Resolution Aerial Viewport */}
      <div className="relative w-full h-56 sm:h-64 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 shadow-inner group">
        <Map
          ref={mapRef}
          initialViewState={{
            longitude,
            latitude,
            zoom: 13.2,
            pitch: 0,
          }}
          mapStyle={ESRI_SATELLITE_STYLE}
          style={{ width: "100%", height: "100%" }}
          scrollZoom={false}
          doubleClickZoom={false}
          dragRotate={false}
          attributionControl={false}
          onLoad={(e) => {
            const map = e.target;
            syncWindCorridorToMap({
              map,
              sourceId: "footprint-wind-corridor-source",
              layerPrefix: "footprint-wind-corridor",
              corridorResult: corridorGeo || null,
              featureCollection: corridorGeo?.featureCollection || null,
              isSatellite: true,
              visible: Boolean(hasWind && corridorGeo),
            });
            syncFootprintSquaresToMap(map, footprintGeoJson);
          }}
        >
        </Map>

        {/* Single Pristine Wind Flow Badge in Top-Right Corner */}
        {hasWind && (
          <div className="absolute top-2.5 right-2.5 z-10 pointer-events-none flex items-center gap-2 px-2.5 py-1 rounded-lg bg-black/85 backdrop-blur-md border border-white/20 text-white font-mono text-[10.5px] font-bold shadow-md">
            {!corridorGeo?.isLightVariable && (
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Directional Wind Arrow */}
                <div 
                  className="w-3.5 h-3.5 text-sky-400 flex items-center justify-center transition-transform duration-300"
                  style={{ transform: `rotate(${Math.round(towardDeg)}deg)` }}
                  title={`Wind flowing toward ${Math.round(towardDeg)}°`}
                >
                  <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2L18 20L12 16L6 20L12 2Z" />
                  </svg>
                </div>
                {/* Subtle Wind Wave Lines */}
                <div className="relative w-4 h-2.5 flex flex-col justify-between overflow-hidden">
                  <div className="h-[1.5px] bg-sky-400 rounded-full animate-wind-wave-1" />
                  <div className="h-[1.5px] bg-sky-300 rounded-full animate-wind-wave-2" />
                </div>
              </div>
            )}
            {corridorGeo?.isLightVariable ? (
              <span className="text-slate-300">surface wind: light/variable (&lt; 3 km/h)</span>
            ) : (
              <span>
                surface wind {Math.round(speedKmh)} km/h · {wind?.direction_from_cardinal || ""} → {wind?.direction_toward_cardinal || ""} ({Math.round(towardDeg)}°)
              </span>
            )}
          </div>
        )}

        {/* Footer Bar on Aerial Canvas */}
        <div className="absolute bottom-2 left-2.5 z-10 pointer-events-none">
          <div className="font-mono text-[9px] sm:text-[10px] tracking-wider uppercase font-bold text-slate-200 drop-shadow-md bg-black/75 px-2 py-0.5 rounded border border-white/20 backdrop-blur-sm">
            {validObs.length > 0 
              ? `${validObs.length} × NOMINAL 375 M PIXEL${validObs.length > 1 ? "S" : ""} · ESRI IMAGERY`
              : "SENSOR FOOTPRINT UNAVAILABLE"}
          </div>
        </div>
      </div>
    </section>
  );
}
