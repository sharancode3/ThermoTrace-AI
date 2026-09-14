"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Map, { MapRef, Marker, Source, Layer } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  fetchGisEvents,
  fetchGisFacilities,
  fetchGisObservations,
  fetchEventDetail,
  fetchEventWind,
  clearEventCache,
  GeoCollection,
  GeoFeature,
  Viewport,
  WindData,
} from "@/lib/apiClient";
import {
  Layers,
  Navigation,
  Eye,
  EyeOff,
  Info,
  Factory,
  Sprout,
  HelpCircle,
  Flame,
  Radio,
  Filter,
  RotateCcw,
  Compass,
  X,
} from "lucide-react";
import { ThermalMapMarker } from "./ThermalMapMarker";
import FacilityDetailDrawer from "./FacilityDetailDrawer";
import { NearbyAlertCenter } from "./NearbyAlertCenter";
import { requestCurrentPosition } from "@/lib/geolocation";

// Google Maps Roadmap raster style
const GOOGLE_ROADMAP: any = {
  version: 8,
  sources: {
    google_maps: {
      type: "raster",
      tiles: [
        "https://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
        "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
        "https://mt2.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
        "https://mt3.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
      ],
      tileSize: 256,
      attribution: "&copy; Google Maps",
      maxzoom: 22,
    },
  },
  layers: [
    {
      id: "google-maps-layer",
      type: "raster",
      source: "google_maps",
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

const GOOGLE_HYBRID: any = {
  version: 8,
  sources: {
    google_hybrid: {
      type: "raster",
      tiles: [
        "https://mt0.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
        "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
        "https://mt2.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
        "https://mt3.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
      ],
      tileSize: 256,
      attribution: "&copy; Google Maps",
      maxzoom: 22,
    },
  },
  layers: [
    {
      id: "google-hybrid-layer",
      type: "raster",
      source: "google_hybrid",
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

type MapComponentProps = {
  onEventClick: (id: string | null) => void;
  selectedEventId?: string | null;
  wind?: WindData | null;
  windVisible?: boolean;
};

function buildWindCorridor(
  longitude: number,
  latitude: number,
  towardDegrees: number,
  speedKmh: number,
  zoom: number = 5
): any {
  // Meteorological TOWARD angle: 0 is North (latitude+), 90 is East (longitude+)
  const angle = (towardDegrees * Math.PI) / 180;
  const longitudeScale = Math.max(0.25, Math.cos((latitude * Math.PI) / 180));

  // Controlled 32° total beam width (16° half-angle), compliant with 25°–40° specification
  const halfAngle = (16 * Math.PI) / 180;

  // Zoom-adaptive reach: keep the sector clearly legible without losing its
  // geographic anchoring. A 120–145px beam remains recognizable over both
  // pale roadmap tiles and dark satellite imagery.
  // across all zoom levels while remaining 100% geographically anchored to the hotspot
  const targetScreenPx = Math.min(145, Math.max(120, 120 + Math.min(25, speedKmh * 0.7)));
  const effectiveZoom = Math.max(2, Math.min(18, zoom));
  const degPerPx = 360 / (256 * Math.pow(2, effectiveZoom));
  const reach = targetScreenPx * degPerPx;

  // Projects forward along wind-toward and lateral (perpendicular) in geographic degrees
  const point = (forward: number, lateral: number): [number, number] => [
    longitude + (Math.sin(angle) * forward + Math.cos(angle) * lateral) / longitudeScale,
    latitude + Math.cos(angle) * forward - Math.sin(angle) * lateral,
  ];

  // 1. Fan sector polygon originating exactly at hotspot coordinates
  const origin: [number, number] = [longitude, latitude];
  const arcSegments = 24;
  const arcPoints: [number, number][] = [];

  // Smooth circular arc along outer boundary from -halfAngle to +halfAngle
  for (let i = -arcSegments / 2; i <= arcSegments / 2; i++) {
    const phi = (i / (arcSegments / 2)) * halfAngle;
    arcPoints.push(point(reach * Math.cos(phi), reach * Math.sin(phi)));
  }

  // CCW closed polygon ring: origin -> outer arc -> origin
  const polygonCoords: [number, number][] = [origin, ...arcPoints, origin];

  // 2. Subtle directional cue features inside the cone (centerline + directional tick)
  const axisStart = point(reach * 0.18, 0);
  const axisEnd = point(reach * 0.90, 0);

  const arrowApex = point(reach * 0.78, 0);
  const arrowLeft = point(reach * 0.68, reach * 0.07);
  const arrowRight = point(reach * 0.68, -reach * 0.07);

  // Keep geometry types in separate sources. This avoids renderer/filter
  // ambiguity when a GeoJSON collection mixes polygon and line features.
  return {
    fill: {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [polygonCoords] },
      properties: {},
    },
    outline: {
      type: "Feature",
      geometry: { type: "LineString", coordinates: polygonCoords },
      properties: {},
    },
    cues: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "LineString", coordinates: [axisStart, axisEnd] },
          properties: {},
        },
        {
          type: "Feature",
          geometry: { type: "LineString", coordinates: [arrowLeft, arrowApex, arrowRight] },
          properties: {},
        },
      ],
    },
  };
}

export default function MapComponent({
  onEventClick,
  selectedEventId,
  wind,
  windVisible = true,
}: MapComponentProps) {
  const mapRef = useRef<MapRef>(null);
  const searchParams = useSearchParams();
  const [focusedFacility, setFocusedFacility] = useState<{ id: string; name: string; lat: number; lon: number } | null>(null);

  // Read facility focus params from URL
  useEffect(() => {
    const focusLat = searchParams.get("focus_lat");
    const focusLon = searchParams.get("focus_lon");
    const facilityId = searchParams.get("facility_id");
    const facilityName = searchParams.get("facility_name");

    if (focusLat && focusLon) {
      const lat = parseFloat(focusLat);
      const lon = parseFloat(focusLon);
      if (!isNaN(lat) && !isNaN(lon)) {
        setFocusedFacility({
          id: facilityId || "fac-focus",
          name: facilityName ? decodeURIComponent(facilityName) : "Target Facility",
          lat,
          lon,
        });
        setWindowHours(720); // Expand to 30 days so nearby persistent facility hotspots are visible
        mapRef.current?.flyTo({
          center: [lon, lat],
          zoom: 13.5,
          pitch: 20,
          duration: 1800,
          essential: true,
        });

        // Clean up focus parameters from browser URL so it doesn't stay permanently locked on refresh or other interactions
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.delete("focus_lat");
          url.searchParams.delete("focus_lon");
          url.searchParams.delete("facility_id");
          url.searchParams.delete("facility_name");
          window.history.replaceState({}, "", url.toString());
        }
      }
    }
  }, [searchParams]);

  // Viewport
  const [viewport, setViewport] = useState<Viewport>({
    west: 68.0,
    south: 8.0,
    east: 97.4,
    north: 37.0,
    zoom: 4.8,
  });

  // Unified Filter States
  const [windowHours, setWindowHours] = useState<number | null>(24);
  const [showAllDetections, setShowAllDetections] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [classFilter, setClassFilter] = useState<string>("");
  const [showFacilities, setShowFacilities] = useState(true);
  const [showObservations, setShowObservations] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  // Data States
  const [geoData, setGeoData] = useState<GeoCollection | null>(null);
  const [facilityData, setFacilityData] = useState<GeoCollection | null>(null);
  const [observationData, setObservationData] = useState<GeoCollection | null>(null);
  const [selectedEventData, setSelectedEventData] = useState<any>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [mapType, setMapType] = useState<"roadmap" | "hybrid">("roadmap");
  const [error, setError] = useState<string | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [selectedFacilityForDrawer, setSelectedFacilityForDrawer] = useState<any | null>(null);
  const [hoveredFacilityInfo, setHoveredFacilityInfo] = useState<{
    name: string;
    sector: string;
    district: string;
    state: string;
    x: number;
    y: number;
  } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Wind & Selection States
  const [internalWind, setInternalWind] = useState<WindData | null>(null);
  const [activeSelectedId, setActiveSelectedId] = useState<string | null>(selectedEventId || null);

  useEffect(() => {
    setActiveSelectedId(selectedEventId || null);
    if (selectedEventId) {
      fetchEventWind(selectedEventId).then((w) => {
        if (w) setInternalWind(w);
      }).catch(() => {});
    } else {
      setInternalWind(null);
    }
  }, [selectedEventId]);

  const activeWind = wind || internalWind;
  const activeWindVisible = windVisible;

  const handleHotspotClick = (id: string, lon?: number, lat?: number) => {
    setActiveSelectedId(id);
    if (onEventClick) {
      onEventClick(id);
    }
    fetchEventWind(id).then((w) => {
      if (w) setInternalWind(w);
    }).catch(() => {});

    if (lon !== undefined && lat !== undefined) {
      mapRef.current?.flyTo({
        center: [lon, lat],
        zoom: 12.5,
        duration: 1200,
        essential: true,
      });
    }
  };

  // Listen to background FIRMS ingestion refresh events
  useEffect(() => {
    const handleRefreshed = () => {
      setRefreshTrigger((c) => c + 1);
    };
    window.addEventListener("thermo-data-refreshed", handleRefreshed);
    return () => window.removeEventListener("thermo-data-refreshed", handleRefreshed);
  }, []);

  const startTime = useMemo(() => {
    return windowHours ? new Date(Date.now() - windowHours * 3600000).toISOString() : undefined;
  }, [windowHours]);

  const handleClearFilters = () => {
    setWindowHours(null);
    setShowAllDetections(true);
    setSeverityFilter("");
    setClassFilter("");
    setShowFacilities(true);
    setShowObservations(false);
    setFocusedFacility(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("focus_lat");
      url.searchParams.delete("focus_lon");
      url.searchParams.delete("facility_id");
      url.searchParams.delete("facility_name");
      url.searchParams.delete("eventId");
      window.history.replaceState({}, "", url.toString());
    }
  };

  const handleCenterIndia = () => {
    setFocusedFacility(null);
    mapRef.current?.flyTo({
      center: [78.9629, 22.5937],
      zoom: 4.8,
      duration: 1200,
    });
  };

  const [locationError, setLocationError] = useState<string | null>(null);

  const handleMyLocation = () => {
    requestCurrentPosition().then((position) => {
        const coords = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };
        setUserLocation(coords);
        setLocationError(null);
        mapRef.current?.flyTo({
          center: [coords.lon, coords.lat],
          zoom: 13.5,
          duration: 1800,
        });
      }).catch((error) => {
        setLocationError(error instanceof Error ? error.message : "Unable to retrieve location");
        setTimeout(() => setLocationError(null), 4000);
      });
  };

  // External fly-to listener from News / Alerts
  useEffect(() => {
    const handleFlyToEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { coordinates, peakFrp, anomalyTier, eventId } = customEvent.detail || {};
      if (!Array.isArray(coordinates) || coordinates.length < 2) return;

      const [lon, lat] = coordinates.map(Number);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;

      let targetZoom = 12.0;
      let targetPitch = 0;
      if (peakFrp >= 50 || anomalyTier === "CRITICAL") {
        targetZoom = 13.5;
        targetPitch = 25;
      } else if (peakFrp >= 15 || anomalyTier === "ABNORMAL") {
        targetZoom = 12.5;
        targetPitch = 15;
      }

      setFocusedFacility(null);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("focus_lat");
        url.searchParams.delete("focus_lon");
        url.searchParams.delete("facility_id");
        url.searchParams.delete("facility_name");
        window.history.replaceState({}, "", url.toString());
      }

      if (onEventClick && eventId) {
        onEventClick(eventId);
      }
      mapRef.current?.flyTo({
        center: [lon, lat],
        zoom: targetZoom,
        pitch: targetPitch,
        duration: 1500,
        essential: true,
        padding: { top: 60, bottom: 60, left: 80, right: 480 },
      });
    };

    window.addEventListener("thermo-fly-to-event", handleFlyToEvent);
    return () => window.removeEventListener("thermo-fly-to-event", handleFlyToEvent);
  }, []);

  // Fetch GIS Events on viewport or filter changes
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setError(null);
      setLoadingEvents(true);

      const eventFilters = {
        hours: windowHours ?? undefined,
        start_time: startTime,
        classification: classFilter || undefined,
        anomaly_tier: severityFilter || undefined,
        show_all: showAllDetections,
        focus_event_id: selectedEventId || undefined,
      };

      Promise.all([
        fetchGisEvents(viewport, eventFilters),
        showFacilities ? fetchGisFacilities(viewport) : Promise.resolve<GeoCollection | null>(null),
        showObservations ? fetchGisObservations(viewport, { start_time: startTime }) : Promise.resolve<GeoCollection | null>(null),
      ])
        .then(([events, facilities, observations]) => {
          setGeoData(events);
          setFacilityData(facilities);
          setObservationData(observations);
        })
        .catch((err) => {
          console.error("Failed to fetch GIS data:", err);
          setError(err instanceof Error ? err.message : "Unknown map error");
        })
        .finally(() => setLoadingEvents(false));
    }, 300);

    return () => window.clearTimeout(timer);
  }, [
    viewport,
    startTime,
    classFilter,
    severityFilter,
    showFacilities,
    showObservations,
    showAllDetections,
    selectedEventId,
    refreshTrigger,
  ]);

  // Selected event deep details + auto fly-to
  useEffect(() => {
    if (!selectedEventId) {
      setSelectedEventData(null);
      return;
    }

    let cancelled = false;
    fetchEventDetail(selectedEventId)
      .then((res) => {
        if (cancelled) return;
        if (!res) {
          void clearEventCache().finally(() => {
            if (cancelled) return;
            setSelectedEventData(null);
            onEventClick(null);
            setRefreshTrigger((count) => count + 1);
          });
          return;
        }
        setSelectedEventData(res);

        const lon = res?.longitude ?? res?.centroid?.coordinates?.[0];
        const lat = res?.latitude ?? res?.centroid?.coordinates?.[1];
        const numericLon = Number(lon);
        const numericLat = Number(lat);

        if (Number.isFinite(numericLon) && Number.isFinite(numericLat)) {
          const peakFrp = Number(res?.peak_frp_mw ?? 0);
          const tier = res?.anomaly_tier;

          let targetZoom = 12.0;
          let targetPitch = 0;
          if (peakFrp >= 50 || tier === "CRITICAL") {
            targetZoom = 13.5;
            targetPitch = 25;
          } else if (peakFrp >= 15 || tier === "ABNORMAL") {
            targetZoom = 12.5;
            targetPitch = 15;
          }

          // Offset camera to place marker in the visible map area (left of right sliding panels)
          const isWideScreen = typeof window !== "undefined" && window.innerWidth >= 1024;
          const cameraOffset: [number, number] = isWideScreen ? [-180, 0] : [0, -80];

          mapRef.current?.flyTo({
            center: [numericLon, numericLat],
            offset: cameraOffset,
            zoom: targetZoom,
            pitch: targetPitch,
            duration: 1500,
            essential: true,
          });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        // An IndexedDB cache can outlive a database reset. Do not leave the
        // operator on a non-existent event or surface a development overlay.
        if (err instanceof Error && err.message.includes("(404)")) {
          void clearEventCache().finally(() => {
            if (cancelled) return;
            setSelectedEventData(null);
            onEventClick(null);
            setRefreshTrigger((count) => count + 1);
          });
          return;
        }
        console.warn("Selected event detail unavailable:", err);
      });

    return () => { cancelled = true; };
  }, [selectedEventId]);

  const eventCount = geoData?.features.length || 0;
  const isFilterActive = windowHours !== 24 || !showAllDetections || severityFilter !== "" || classFilter !== "";

  // Selected marker feature
  const selectedFeature = useMemo(() => {
    if (!selectedEventId) return null;
    return geoData?.features.find((f) => f.properties.event_id === selectedEventId) || null;
  }, [geoData, selectedEventId]);

  // Computed features list ensuring the selected event is ALWAYS visible and strictly deduplicated
  const displayFeatures = useMemo<GeoFeature[]>(() => {
    const rawList: GeoFeature[] = geoData?.features || [];
    const seen = new Set<string>();
    const list: GeoFeature[] = [];

    for (const f of rawList) {
      const id = String(f.properties?.event_id || "");
      if (id && !seen.has(id)) {
        seen.add(id);
        list.push(f);
      }
    }

    if (selectedEventData && selectedEventId && !seen.has(selectedEventId)) {
      const lon = Number(selectedEventData.longitude ?? selectedEventData.centroid?.coordinates?.[0]);
      const lat = Number(selectedEventData.latitude ?? selectedEventData.centroid?.coordinates?.[1]);
      if (Number.isFinite(lon) && Number.isFinite(lat)) {
        seen.add(selectedEventId);
        list.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [lon, lat] },
          properties: {
            event_id: selectedEventData.event_id || selectedEventId,
            classification: selectedEventData.classification || "OTHER_UNCERTAIN",
            anomaly_tier: selectedEventData.anomaly_tier || "NORMAL",
            peak_frp_mw: selectedEventData.peak_frp_mw,
            max_brightness_k: selectedEventData.max_brightness_k,
          },
        });
      }
    }

    return list;
  }, [geoData, selectedEventData, selectedEventId, activeSelectedId]);

  // Selected hotspot coordinates for authoritative overlays
  const selectedCoords = useMemo<[number, number] | null>(() => {
    const targetId = activeSelectedId || selectedEventId;
    if (!targetId) return null;
    const feat = displayFeatures.find((f) => f.properties?.event_id === targetId);
    if (feat && Array.isArray(feat.geometry?.coordinates)) {
      return [feat.geometry.coordinates[0], feat.geometry.coordinates[1]];
    }
    const lon = Number(selectedEventData?.longitude ?? selectedEventData?.centroid?.coordinates?.[0]);
    const lat = Number(selectedEventData?.latitude ?? selectedEventData?.centroid?.coordinates?.[1]);
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      return [lon, lat];
    }
    return null;
  }, [activeSelectedId, selectedEventId, displayFeatures, selectedEventData]);

  // Conical Wind Direction Indicator data
  const windConeData = useMemo(() => {
    if (!activeWindVisible || !activeWind?.available || !selectedCoords) return null;
    const [lon, lat] = selectedCoords;
    const toward = Number(activeWind.direction_toward_degrees);
    const fromDeg = Number(activeWind.direction_from_degrees);
    if (!Number.isFinite(toward)) return null;

    const speed = Number(activeWind.speed_kmh) || 0;
    const corridor = buildWindCorridor(lon, lat, toward, speed, viewport.zoom);

    return {
      lon,
      lat,
      toward,
      fromDegrees: Number.isFinite(fromDeg)
        ? Math.round(fromDeg)
        : Math.round(((toward - 180) % 360 + 360) % 360),
      speed,
      corridor,
      fromCardinal: activeWind.direction_from_cardinal || "",
      toCardinal: activeWind.direction_toward_cardinal || "",
    };
  }, [activeWindVisible, activeWind, selectedCoords, viewport.zoom]);

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden font-sans">
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: 78.9629,
          latitude: 22.5937,
          zoom: 4.8,
        }}
        mapStyle={mapType === "hybrid" ? GOOGLE_HYBRID : GOOGLE_ROADMAP}
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={showFacilities ? ["facilities-circles"] : []}
        onClick={(e) => {
          const feature = e.features?.[0];
          if (feature && feature.layer?.id === "facilities-circles") {
            const p = feature.properties as any;
            if (p) {
              const geom = feature.geometry as any;
              const coords = geom && Array.isArray(geom.coordinates) ? geom.coordinates : [78.96, 22.59];
              setSelectedFacilityForDrawer({
                id: p.id,
                name: p.name || "Industrial Facility",
                facility_code: p.facility_code || "FAC-IND",
                sector_category: p.sector_category || "Industrial",
                sub_type: p.sub_type,
                operator_name: p.operator_name,
                state: p.state || "India",
                district: p.district || "",
                latitude: Number(p.latitude || coords[1] || 0),
                longitude: Number(p.longitude || coords[0] || 0),
              });
            }
          }
        }}
        onMouseMove={(e) => {
          const feature = e.features?.[0];
          if (feature && feature.layer?.id === "facilities-circles") {
            const p = feature.properties as any;
            if (p) {
              setHoveredFacilityInfo({
                name: p.name || "Industrial Facility",
                sector: p.sector_category || "Industrial",
                district: p.district || "",
                state: p.state || "",
                x: e.point.x,
                y: e.point.y,
              });
            }
          } else {
            setHoveredFacilityInfo(null);
          }
        }}
        onMouseLeave={() => setHoveredFacilityInfo(null)}
        cursor={hoveredFacilityInfo ? "pointer" : "grab"}
        onMoveEnd={(e) => {
          const bounds = e.target.getBounds();
          setViewport({
            west: bounds.getWest(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            north: bounds.getNorth(),
            zoom: e.target.getZoom(),
          });
        }}
      >
        {/* Facilities Layer */}
        {showFacilities && facilityData && (
          <Source id="facilities-source" type="geojson" data={facilityData as any}>
            <Layer
              id="facilities-circles"
              type="circle"
              paint={{
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 3.5, 8, 5.5, 12, 9, 16, 14],
                "circle-color": "#EAB308",
                "circle-opacity": 0.85,
                "circle-stroke-width": 1.5,
                "circle-stroke-color": "#78350F",
              }}
            />
          </Source>
        )}

        {/* Raw FIRMS Passes Layer */}
        {showObservations && observationData && (
          <Source id="observations-source" type="geojson" data={observationData as any}>
            <Layer
              id="observations-heat"
              type="heatmap"
              paint={{
                "heatmap-weight": ["interpolate", ["linear"], ["get", "frp_mw"], 0, 0, 200, 1],
                "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 9, 3],
                "heatmap-color": [
                  "interpolate",
                  ["linear"],
                  ["heatmap-density"],
                  0, "rgba(0, 0, 255, 0)",
                  0.2, "rgb(0, 255, 255)",
                  0.4, "rgb(0, 255, 0)",
                  0.6, "rgb(255, 255, 0)",
                  0.8, "rgb(255, 140, 0)",
                  1, "rgb(255, 0, 0)",
                ],
                "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 4, 9, 20],
                "heatmap-opacity": 0.75,
              }}
            />
          </Source>
        )}

        {/* Thermal Event Markers (Guaranteed Selected Event Inclusion) */}
        {displayFeatures.map((feature) => {
          const [lon, lat] = feature.geometry.coordinates;
          const { event_id, classification, anomaly_tier, peak_frp_mw, max_brightness_k, lifecycle_status } = feature.properties;
          const isSelected = (activeSelectedId || selectedEventId) === event_id;
          const isCooled = lifecycle_status === "EXTINGUISHED" || lifecycle_status === "COOLING";

          return (
            <Marker
              key={`thermal-marker-${event_id}`}
              longitude={lon}
              latitude={lat}
              anchor="center"
              style={{ zIndex: isSelected ? 40 : 10 }}
              onClick={(e) => {
                e.originalEvent?.stopPropagation();
                handleHotspotClick(event_id, lon, lat);
              }}
            >
              <div 
                className="relative group cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleHotspotClick(event_id, lon, lat);
                }}
              >
                <ThermalMapMarker
                  classification={classification}
                  anomalyTier={anomaly_tier}
                  isSelected={isSelected}
                  peakFrp={Number(peak_frp_mw || 0)}
                  maxBrightnessK={Number(max_brightness_k || 0)}
                  isCooled={isCooled}
                  onClick={() => handleHotspotClick(event_id, lon, lat)}
                />
                <div className="absolute left-1/2 -translate-x-1/2 -top-8 opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap bg-slate-900/95 text-white text-[11px] font-mono px-2.5 py-1 rounded-lg shadow-xl border border-slate-700 z-50 flex items-center gap-1.5 backdrop-blur-md">
                  <span className={`font-bold ${
                    classification === "IND_ROUTINE" ? "text-yellow-400" :
                    classification === "IND_FLARE" ? "text-orange-400" :
                    classification === "IND_FIRE" ? "text-red-400" :
                    classification === "AGRI_BURN" ? "text-emerald-400" :
                    classification === "WILDFIRE" ? "text-teal-400" : "text-slate-300"
                  }`}>{classification}</span>
                  <span className="text-slate-500">·</span>
                  <span className="text-emerald-400 font-semibold">{Number(peak_frp_mw || 0).toFixed(1)} MW</span>
                  {max_brightness_k && (
                    <>
                      <span className="text-slate-500">·</span>
                      <span className="text-slate-300 flex items-center gap-0.5">
                        {Number(max_brightness_k).toFixed(1)} K
                        {(feature.properties?.thermal_trend === "INCREASING" || feature.properties?.thermal_trend === "RISING") && (
                          <span className="text-red-400 font-bold ml-0.5" title="Temperature increasing">↑</span>
                        )}
                        {(feature.properties?.thermal_trend === "DECREASING" || feature.properties?.thermal_trend === "FALLING") && (
                          <span className="text-emerald-400 font-bold ml-0.5" title="Temperature decreasing">↓</span>
                        )}
                      </span>
                    </>
                  )}
                  {isCooled && (
                    <>
                      <span className="text-slate-500">·</span>
                      <span className="text-sky-400 text-[10px] uppercase font-semibold">Cooled</span>
                    </>
                  )}
                </div>
              </div>
            </Marker>
          );
        })}

        {/* Selected Highlight Marker */}
        {selectedFeature && (() => {
          const props = selectedFeature.properties || {};
          const cls = (props.classification || "").toUpperCase();
          const tier = (props.anomaly_tier || "").toUpperCase();
          const isCritical = tier === "CRITICAL" || cls === "IND_FIRE";
          const isAbnormal = !isCritical && (tier === "ABNORMAL" || cls === "IND_FLARE");
          const isIndustry = cls.startsWith("IND_") || cls === "INDUSTRIAL";
          const isAgri = cls === "AGRI_BURN" || cls === "AGRICULTURE";
          const isWildfire = cls === "WILDFIRE" || cls === "FOREST_FIRE";

          let ringColor = "border-slate-400";
          if (isIndustry) {
            ringColor = isCritical ? "border-red-500" : isAbnormal ? "border-orange-500" : "border-yellow-400";
          } else if (isWildfire) {
            ringColor = isCritical ? "border-red-500" : isAbnormal ? "border-orange-500" : "border-teal-400";
          } else if (isAgri) {
            ringColor = isCritical ? "border-red-500" : isAbnormal ? "border-orange-500" : "border-emerald-500";
          }

          return (
            <Marker
              longitude={selectedFeature.geometry.coordinates[0]}
              latitude={selectedFeature.geometry.coordinates[1]}
              anchor="center"
            >
              <div className="pointer-events-none">
                <div className={`w-12 h-12 rounded-full border-2 ${ringColor} animate-ping absolute -top-3 -left-3 opacity-60`} />
              </div>
            </Marker>
          );
        })()}

        {/* Authoritative Geographically-Anchored Selected-Hotspot Wind Direction Sector */}
        {windConeData && (
          <Source id="selected-event-wind-corridor-fill-source" type="geojson" data={windConeData.corridor.fill as any}>
            {/* Visible translucent orange fill; underlying map context remains readable. */}
            <Layer
              id="selected-event-wind-corridor-fill"
              type="fill"
              paint={{
                "fill-color": "#f97316",
                "fill-opacity": 0.30,
              }}
            />
          </Source>
        )}
        {windConeData && (
          <Source id="selected-event-wind-corridor-outline-source" type="geojson" data={windConeData.corridor.outline as any}>
            {/* Soft glow separates the sector from pale roadmap and satellite tiles. */}
            <Layer
              id="selected-event-wind-corridor-glow"
              type="line"
              paint={{
                "line-color": "#f97316",
                "line-width": 8,
                "line-opacity": 0.34,
                "line-blur": 3,
              }}
            />
            {/* High-contrast sector boundary. */}
            <Layer
              id="selected-event-wind-corridor-outline"
              type="line"
              paint={{
                "line-color": "#c2410c",
                "line-width": 3.2,
                "line-opacity": 1,
              }}
            />
          </Source>
        )}
        {windConeData && (
          <Source id="selected-event-wind-corridor-cues-source" type="geojson" data={windConeData.corridor.cues as any}>
            {/* Directional centerline and chevrons point downwind. */}
            <Layer
              id="selected-event-wind-corridor-cues"
              type="line"
              paint={{
                "line-color": "#9a3412",
                "line-width": 2.4,
                "line-opacity": 1,
              }}
            />
          </Source>
        )}

        {/* Compact Map-Linked Wind Information Badge */}
        {windConeData && (
          <Marker
            key={`selected-event-wind-overlay-${activeSelectedId || selectedEventId}`}
            longitude={windConeData.lon}
            latitude={windConeData.lat}
            anchor="bottom"
            style={{ zIndex: 35, pointerEvents: "none" }}
          >
            <div
              data-testid="wind-vector-overlay"
              aria-label={`Wind ${windConeData.fromCardinal} to ${windConeData.toCardinal} at ${windConeData.speed} kilometres per hour, bearing ${windConeData.fromDegrees} degrees`}
              className="pointer-events-none mb-8 rounded-xl border border-orange-500/80 bg-slate-950/90 px-3 py-1.5 shadow-2xl backdrop-blur-md select-none font-mono text-left"
            >
              <div
                data-testid="wind-direction-cone"
                className="text-[9px] font-extrabold tracking-wider text-orange-400 uppercase"
              >
                WIND
              </div>
              <div className="text-xs font-black tracking-wide text-white">
                {windConeData.fromCardinal} → {windConeData.toCardinal}
              </div>
              <div className="text-[10px] text-slate-300 flex items-center gap-1.5 mt-0.5">
                <span className="text-orange-300 font-semibold">{windConeData.speed} km/h</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-300">{windConeData.fromDegrees}°</span>
              </div>
            </div>
          </Marker>
        )}

        {/* Focused Target Facility Location Beacon */}
        {focusedFacility && (
          <Marker
            key="focused-facility-marker"
            longitude={focusedFacility.lon}
            latitude={focusedFacility.lat}
            anchor="bottom"
          >
            <div className="relative flex flex-col items-center group pointer-events-auto">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-950/90 text-amber-100 text-[11px] font-bold rounded-lg shadow-xl border border-amber-500/60 whitespace-nowrap mb-1 backdrop-blur-sm">
                <span>🏢 {focusedFacility.name}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFocusedFacility(null);
                    if (typeof window !== "undefined") {
                      const url = new URL(window.location.href);
                      url.searchParams.delete("focus_lat");
                      url.searchParams.delete("focus_lon");
                      url.searchParams.delete("facility_id");
                      url.searchParams.delete("facility_name");
                      window.history.replaceState({}, "", url.toString());
                    }
                  }}
                  className="ml-1 p-0.5 rounded hover:bg-amber-800 text-amber-300 hover:text-white transition cursor-pointer"
                  title="Dismiss facility marker"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="relative flex items-center justify-center">
                <span className="absolute w-8 h-8 rounded-full bg-amber-500/40 animate-ping" />
                <span className="relative w-4 h-4 rounded-full bg-amber-500 border-2 border-white shadow-lg shadow-amber-500/50" />
              </div>
            </div>
          </Marker>
        )}

        {/* User Current Location Marker (Google Maps Style Pulsing Blue Dot) */}
        {userLocation && (
          <Marker
            key="user-current-location-marker"
            longitude={userLocation.lon}
            latitude={userLocation.lat}
            anchor="center"
          >
            <div className="relative flex items-center justify-center pointer-events-none" style={{ width: 44, height: 44 }}>
              {/* Outer pulsing ring */}
              <span className="absolute w-9 h-9 rounded-full bg-blue-500/30 animate-ping" />
              {/* Soft accuracy halo */}
              <span className="absolute w-7 h-7 rounded-full bg-blue-500/25 border border-blue-400/50 shadow-sm" />
              {/* Core Google Maps blue dot */}
              <span className="relative w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-lg shadow-blue-500/60" />
            </div>
          </Marker>
        )}

        {/* UNIFIED TACTICAL RADAR TOOLBAR (TOP-LEFT) */}
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 max-w-[calc(100vw-2rem)] sm:max-w-md md:max-w-lg">
          {/* Main Control Card */}
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3 shadow-2xl text-white flex flex-col gap-2.5">
            {/* Header + Time Window */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-bold font-mono tracking-wider text-slate-200">
                  THERMAL RADAR // INDIA NRT
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  {eventCount} Hotspots
                </span>
              </div>

              {/* Time Window Buttons */}
              <div className="flex items-center gap-1 bg-slate-800/90 p-0.5 rounded-xl border border-slate-700">
                {([
                  [6, "6h"],
                  [24, "24h"],
                  [168, "7d"],
                  [720, "30d"],
                  [null, "All"],
                ] as const).map(([hours, label]) => (
                  <button
                    key={label}
                    onClick={() => setWindowHours(hours)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      windowHours === hours
                        ? "bg-orange-600 text-white shadow-md shadow-orange-900/40"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                    }`}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 30-Minute Storage-Optimized Telemetry Cadence Notice */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[10.5px] text-amber-300/90 leading-snug">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <span>
                <strong className="font-semibold text-amber-200">Notice:</strong> NASA FIRMS satellite telemetry is refreshed on an active 30-minute cadence across a 30-day operational retention window.
              </span>
            </div>

            {/* View Mode + Filters + Layer Checkboxes */}
            <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-800 text-xs">
              {/* Priority vs All Hotspots Toggle */}
              <button
                onClick={() => setShowAllDetections((prev) => !prev)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
                  showAllDetections
                    ? "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
                    : "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm"
                }`}
                title="Toggle between all detected thermal events and high-priority anomalies"
                type="button"
              >
                {showAllDetections ? <Eye className="w-3.5 h-3.5 text-slate-400" /> : <EyeOff className="w-3.5 h-3.5 text-amber-400" />}
                <span>{showAllDetections ? "All Hotspots" : "Priority Only"}</span>
              </button>

              {/* Severity Dropdown */}
              <select
                aria-label="Severity Filter"
                value={severityFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setSeverityFilter(val);
                  if (val) {
                    setShowAllDetections(true);
                    if (val === "CRITICAL" && windowHours === 6) {
                      setWindowHours(168);
                    }
                  }
                }}
                className="bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-orange-500 cursor-pointer"
              >
                <option value="">All Severities</option>
                <option value="CRITICAL">🔴 Critical Only</option>
                <option value="ABNORMAL">🟠 Abnormal</option>
                <option value="ELEVATED">🟢 Elevated</option>
                <option value="NORMAL">⚪ Nominal</option>
              </select>

              {/* Classification Dropdown */}
              <select
                aria-label="Classification Filter"
                value={classFilter}
                onChange={(e) => {
                  setClassFilter(e.target.value);
                  if (e.target.value) setShowAllDetections(true);
                }}
                className="bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-orange-500 cursor-pointer"
              >
                <option value="">All Categories</option>
                <option value="INDUSTRY">🏭 Industry (All Levels)</option>
                <option value="AGRI_BURN">🌾 Agriculture (Crop)</option>
                <option value="WILDFIRE">🌲 Forest Wildfire</option>
                <option value="OTHER_UNCERTAIN">❓ Other / Uncertain</option>
              </select>

              {/* Dynamic Reset Filters Button */}
              {(classFilter || severityFilter || !showAllDetections || windowHours !== 24) && (
                <button
                  onClick={handleClearFilters}
                  type="button"
                  className="px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition cursor-pointer"
                  title="Reset all filters to defaults"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Filters</span>
                </button>
              )}



              {/* Symbology Legend Button */}
              <button
                onClick={() => setShowLegend((prev) => !prev)}
                className={`p-1.5 rounded-xl border transition ${
                  showLegend
                    ? "bg-orange-600 text-white border-orange-500"
                    : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700"
                }`}
                title="Tactical Symbology Matrix (9-Icon)"
                type="button"
              >
                <Info className="w-4 h-4" />
              </button>

              {/* Clear Filters (if modified) */}
              {isFilterActive && (
                <button
                  onClick={handleClearFilters}
                  className="flex items-center gap-1 text-[11px] text-orange-400 hover:text-orange-300 font-medium px-2 py-1 bg-orange-500/10 rounded-lg transition"
                  type="button"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              )}
              <div className="ml-auto pl-1">
                <NearbyAlertCenter />
              </div>
            </div>
          </div>
        </div>

        {/* TACTICAL SYMBOLOGY LEGEND CARD */}
        {showLegend && (
          <div className="absolute top-36 left-4 z-30 bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-slate-700 w-84 space-y-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Tactical 4-Icon Symbology
              </span>
              <span className="text-[10px] text-orange-400 font-mono font-bold">
                Level-Aware
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                1. Four Primary Emitter Classes
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 bg-slate-800/80 rounded-xl border border-slate-700/80 flex items-center gap-2">
                  <Factory className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-200">Industry</div>
                    <div className="text-[10px] text-slate-400">3-Color Level System</div>
                  </div>
                </div>
                <div className="p-2 bg-slate-800/80 rounded-xl border border-slate-700/80 flex items-center gap-2">
                  <Sprout className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-200">Agriculture</div>
                    <div className="text-[10px] text-slate-400">Crop residue fire</div>
                  </div>
                </div>
                <div className="p-2 bg-slate-800/80 rounded-xl border border-slate-700/80 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-400 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-200">Wildfire</div>
                    <div className="text-[10px] text-slate-400">Forest canopy burn</div>
                  </div>
                </div>
                <div className="p-2 bg-slate-800/80 rounded-xl border border-slate-700/80 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-200">Uncertain</div>
                    <div className="text-[10px] text-slate-400">Unverified signal</div>
                  </div>
                </div>
              </div>

              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pt-1">
                2. Industry 3-Color Critical Levels
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-600 border border-red-400 shrink-0 shadow-xs shadow-red-500/50" />
                  <span className="text-slate-300 font-medium">Red: <span className="text-slate-400 font-normal">Emergency Fire / Critical Anomaly (Critical)</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-orange-500 border border-orange-400 shrink-0 shadow-xs shadow-orange-500/50" />
                  <span className="text-slate-300 font-medium">Orange: <span className="text-slate-400 font-normal">Elevated Flare / Abnormal Radiance (Abnormal)</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-yellow-400 border border-yellow-300 shrink-0 shadow-xs shadow-yellow-400/50" />
                  <span className="text-slate-300 font-medium">Yellow: <span className="text-slate-400 font-normal">Nominal Routine Industrial Process (Normal)</span></span>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                  <span className="w-3 h-3 rounded-full bg-yellow-300/40 border border-dashed border-yellow-400 shrink-0" />
                  <span className="text-slate-300 font-medium">Faded: <span className="text-slate-400 font-normal">Cooled / Extinguished Event (Faded with respective color)</span></span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BOTTOM-RIGHT MAP CONTROLS */}
        <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-2">
          {/* Map Type Switcher */}
          <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl p-1 shadow-2xl border border-slate-700/80 flex flex-col gap-1">
            <button
              onClick={() => setMapType("roadmap")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                mapType === "roadmap"
                  ? "bg-orange-600 text-white shadow-md shadow-orange-900/40"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
              title="Google Vector Roadmap"
              type="button"
            >
              <Navigation className="w-3.5 h-3.5" />
              Roadmap
            </button>
            <button
              onClick={() => setMapType("hybrid")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                mapType === "hybrid"
                  ? "bg-orange-600 text-white shadow-md shadow-orange-900/40"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
              title="Google Satellite Hybrid"
              type="button"
            >
              <Layers className="w-3.5 h-3.5" />
              Satellite
            </button>
          </div>

          {/* Center India Button */}
          <button
            onClick={handleCenterIndia}
            className="bg-slate-900/90 hover:bg-slate-800 text-slate-200 p-3 rounded-2xl shadow-2xl border border-slate-700/80 transition flex items-center justify-center backdrop-blur-md"
            title="Reset View to Sovereign India"
            type="button"
          >
            <Compass className="w-4 h-4 text-orange-400" />
          </button>

          {/* My Location GPS Button */}
          <button
            onClick={handleMyLocation}
            className="bg-slate-900/90 hover:bg-slate-800 text-slate-200 p-3 rounded-2xl shadow-2xl border border-slate-700/80 transition flex items-center justify-center backdrop-blur-md"
            title="My Location"
            type="button"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>

        {/* Map Loading Indicator */}
        {loadingEvents && !geoData && (
          <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-900/90 backdrop-blur-md px-4 py-2 text-xs font-mono text-slate-300 shadow-xl flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            Scanning sovereign thermal spectrum...
          </div>
        )}

        {/* Empty State Card */}
        {!loadingEvents && !error && displayFeatures.length === 0 && (
          <div className="absolute left-1/2 top-6 z-20 w-80 -translate-x-1/2 rounded-2xl border border-slate-700 bg-slate-900/95 backdrop-blur-md p-4 text-center text-xs text-slate-300 shadow-2xl">
            <p className="font-semibold text-slate-100 text-sm">No Thermal Events Found</p>
            <p className="mt-1 text-slate-400">No detections matched your active time window or filters.</p>
            <button
              onClick={handleClearFilters}
              className="mt-3 rounded-xl bg-orange-600 px-3 py-1.5 font-semibold text-white hover:bg-orange-500 transition shadow-md shadow-orange-900/40"
              type="button"
            >
              Reset All Filters
            </button>
          </div>
        )}

        {/* Location Error Notification Toast */}
        {locationError && (
          <div className="absolute bottom-20 right-6 z-30 bg-slate-900/95 text-white border border-rose-500/50 px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-ping" />
            <span>{locationError}</span>
          </div>
        )}

        {/* Hovered Facility Information Tooltip */}
        {hoveredFacilityInfo && (
          <div
            className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full mb-3 rounded-xl border border-amber-500/40 bg-slate-900/95 px-3 py-2 text-xs shadow-2xl backdrop-blur-md text-white space-y-0.5"
            style={{
              left: `${hoveredFacilityInfo.x}px`,
              top: `${hoveredFacilityInfo.y - 12}px`,
            }}
          >
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <span>🏢</span>
              <span>{hoveredFacilityInfo.name}</span>
            </div>
            <div className="text-[11px] text-slate-300">
              <span className="font-semibold text-orange-400">{hoveredFacilityInfo.sector}</span>
              {hoveredFacilityInfo.district && ` · ${hoveredFacilityInfo.district}`}
              {hoveredFacilityInfo.state && `, ${hoveredFacilityInfo.state}`}
            </div>
            <div className="text-[10px] text-slate-400 pt-0.5">
              Click marker to inspect facility & download dossier
            </div>
          </div>
        )}
      </Map>

      <div id="nearby-alert-toast-layer" className="pointer-events-none absolute bottom-[13rem] left-3 z-30 w-[calc(100%-1.5rem)] max-w-[360px] sm:bottom-6 sm:left-6" />

      {/* Selected Facility Detail Drawer & Report Export */}
      {selectedFacilityForDrawer && (
        <FacilityDetailDrawer
          facility={selectedFacilityForDrawer}
          onClose={() => setSelectedFacilityForDrawer(null)}
        />
      )}
    </div>
  );
}
