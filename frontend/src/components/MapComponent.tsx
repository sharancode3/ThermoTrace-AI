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
  GeoCollection,
  GeoFeature,
  Viewport,
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
  onEventClick: (id: string) => void;
  selectedEventId?: string | null;
};

export default function MapComponent({
  onEventClick,
  selectedEventId,
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
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      setTimeout(() => setLocationError(null), 4000);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
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
      },
      (err) => {
        console.warn("High accuracy geolocation failed, trying standard accuracy:", err.message);
        navigator.geolocation.getCurrentPosition(
          (position) => {
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
          },
          (fallbackErr) => {
            console.error("Geolocation fallback error:", fallbackErr.message);
            let msg = "Unable to retrieve location";
            if (fallbackErr.code === 1) msg = "Location permission denied";
            else if (fallbackErr.code === 2) msg = "Location unavailable";
            else if (fallbackErr.code === 3) msg = "Location request timed out";
            setLocationError(msg);
            setTimeout(() => setLocationError(null), 4000);
          },
          { enableHighAccuracy: false, timeout: 10000 }
        );
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
    );
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
        if (!cancelled) console.error("Failed to load selected event detail:", err);
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
  }, [geoData, selectedEventData, selectedEventId]);

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
          const isSelected = selectedEventId === event_id;
          const isCooled = lifecycle_status === "EXTINGUISHED" || lifecycle_status === "COOLING";

          return (
            <Marker
              key={`thermal-marker-${event_id}`}
              longitude={lon}
              latitude={lat}
              anchor="center"
              onClick={(e) => {
                e.originalEvent?.stopPropagation();
                onEventClick(event_id);
              }}
            >
              <div 
                className="relative group cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onEventClick(event_id);
                }}
              >
                <ThermalMapMarker
                  classification={classification}
                  anomalyTier={anomaly_tier}
                  isSelected={isSelected}
                  peakFrp={Number(peak_frp_mw || 0)}
                  maxBrightnessK={Number(max_brightness_k || 0)}
                  isCooled={isCooled}
                  onClick={() => onEventClick(event_id)}
                />
                <div className="absolute left-1/2 -translate-x-1/2 -top-8 opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap bg-slate-900/95 text-white text-[11px] font-mono px-2.5 py-1 rounded-lg shadow-xl border border-slate-700 z-50 flex items-center gap-1.5 backdrop-blur-md">
                  <span className="font-bold text-orange-400">{classification}</span>
                  <span className="text-slate-500">·</span>
                  <span className="text-emerald-400 font-semibold">{Number(peak_frp_mw || 0).toFixed(1)} MW</span>
                  {max_brightness_k && (
                    <>
                      <span className="text-slate-500">·</span>
                      <span className="text-slate-300">{Number(max_brightness_k).toFixed(1)} K</span>
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
        {selectedFeature && (
          <Marker
            longitude={selectedFeature.geometry.coordinates[0]}
            latitude={selectedFeature.geometry.coordinates[1]}
            anchor="center"
          >
            <div className="pointer-events-none">
              <div className="w-12 h-12 rounded-full border-2 border-orange-500 animate-ping absolute -top-3 -left-3 opacity-60" />
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
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 max-w-[92vw] sm:max-w-none">
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
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-600 border border-red-400 shrink-0" />
                  <span className="text-slate-300 font-medium">Red: <span className="text-slate-400 font-normal">Emergency Fire / Critical Anomaly (FRP &ge; 50MW)</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-orange-500 border border-orange-400 shrink-0" />
                  <span className="text-slate-300 font-medium">Amber: <span className="text-slate-400 font-normal">Elevated Flare / Abnormal Radiance</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-400 border border-amber-300 shrink-0" />
                  <span className="text-slate-300 font-medium">Yellow: <span className="text-slate-400 font-normal">Nominal Routine Industrial Process</span></span>
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
