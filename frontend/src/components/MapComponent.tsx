"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Map, { MapRef, Marker, Source, Layer } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  fetchGisEvents,
  fetchGisFacilities,
  fetchGisObservations,
  fetchEventDetail,
  GeoCollection,
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
} from "lucide-react";
import { ThermalMapMarker } from "./ThermalMapMarker";

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
  };

  const handleCenterIndia = () => {
    mapRef.current?.flyTo({
      center: [78.9629, 22.5937],
      zoom: 4.8,
      duration: 1200,
    });
  };

  const handleMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
        mapRef.current?.flyTo({
          center: [position.coords.longitude, position.coords.latitude],
          zoom: 12,
          duration: 2000,
        });
      },
      (err) => console.error("Geolocation failed:", err),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  // External fly-to listener from News / Alerts
  useEffect(() => {
    const handleFlyToEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { coordinates, peakFrp, anomalyTier } = customEvent.detail || {};
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

      mapRef.current?.flyTo({
        center: [lon, lat],
        zoom: targetZoom,
        pitch: targetPitch,
        duration: 1500,
        essential: true,
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

  // Computed features list ensuring the selected event is ALWAYS visible even if time/category filter would hide it
  const displayFeatures = useMemo(() => {
    const list = geoData?.features ? [...geoData.features] : [];
    if (selectedEventData && selectedEventId) {
      const exists = list.some((f) => f.properties.event_id === selectedEventId);
      if (!exists) {
        const lon = Number(selectedEventData.longitude ?? selectedEventData.centroid?.coordinates?.[0]);
        const lat = Number(selectedEventData.latitude ?? selectedEventData.centroid?.coordinates?.[1]);
        if (Number.isFinite(lon) && Number.isFinite(lat)) {
          list.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: [lon, lat] },
            properties: {
              event_id: selectedEventData.event_id || selectedEventId,
              classification: selectedEventData.classification || "OTHER_UNCERTAIN",
              anomaly_tier: selectedEventData.anomaly_tier || "NORMAL",
              peak_frp_mw: selectedEventData.peak_frp_mw,
              max_brightness_k: selectedEventData.max_brightness_k,
            }
          } as any);
        }
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
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 3, 10, 6, 14, 10],
                "circle-color": "#3b82f6",
                "circle-opacity": 0.35,
                "circle-stroke-width": 1.5,
                "circle-stroke-color": "#60a5fa",
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
          const { event_id, classification, anomaly_tier, peak_frp_mw, max_brightness_k } = feature.properties;
          const isSelected = selectedEventId === event_id;

          return (
            <Marker
              key={event_id}
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
                onChange={(e) => setSeverityFilter(e.target.value)}
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
                onChange={(e) => setClassFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-orange-500 cursor-pointer"
              >
                <option value="">All Categories</option>
                <option value="IND_FLARE">🏭 Industrial Flare</option>
                <option value="IND_FIRE">🔥 Industrial Fire</option>
                <option value="IND_ROUTINE">⚙️ Routine Process</option>
                <option value="AGRI_BURN">🌾 Agri Crop Residue</option>
                <option value="WILDFIRE">🌲 Forest Wildfire</option>
                <option value="OTHER_UNCERTAIN">❓ Other / Uncertain</option>
              </select>

              {/* Facility Overlay Checkbox */}
              <label className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-700 text-slate-300 cursor-pointer select-none hover:bg-slate-700/60 transition">
                <input
                  type="checkbox"
                  checked={showFacilities}
                  onChange={(e) => setShowFacilities(e.target.checked)}
                  className="rounded border-slate-600 text-orange-600 focus:ring-0 focus:ring-offset-0 bg-slate-900 cursor-pointer"
                />
                <span>Facilities</span>
              </label>

              {/* Raw FIRMS Passes Overlay Checkbox */}
              <label className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-700 text-slate-300 cursor-pointer select-none hover:bg-slate-700/60 transition">
                <input
                  type="checkbox"
                  checked={showObservations}
                  onChange={(e) => setShowObservations(e.target.checked)}
                  className="rounded border-slate-600 text-orange-600 focus:ring-0 focus:ring-offset-0 bg-slate-900 cursor-pointer"
                />
                <span>FIRMS Heat</span>
              </label>

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
          <div className="absolute top-36 left-4 z-30 bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-slate-700 w-80 space-y-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Tactical Symbology (9-Icon)
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Type × Severity
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                1. Base Shape (Classification)
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700 flex flex-col items-center gap-1">
                  <Factory className="w-4 h-4 text-orange-400" />
                  <span className="text-slate-300 font-medium">Industrial</span>
                </div>
                <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700 flex flex-col items-center gap-1">
                  <Sprout className="w-4 h-4 text-emerald-400" />
                  <span className="text-slate-300 font-medium">Vegetation</span>
                </div>
                <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700 flex flex-col items-center gap-1">
                  <HelpCircle className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-300 font-medium">Uncertain</span>
                </div>
              </div>

              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pt-1">
                2. Semantic Color (Severity)
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-600 border border-red-400 shrink-0" />
                  <span className="text-slate-300 font-medium">Red: <span className="text-slate-400 font-normal">Critical Anomaly (Z &ge; 4.0σ)</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-orange-500 border border-orange-400 shrink-0" />
                  <span className="text-slate-300 font-medium">Amber: <span className="text-slate-400 font-normal">Abnormal Anomaly (2.5 &le; Z &lt; 4.0σ)</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-600 border border-emerald-400 shrink-0" />
                  <span className="text-slate-300 font-medium">Green: <span className="text-slate-400 font-normal">Nominal & Elevated</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-slate-500 border border-slate-400 shrink-0" />
                  <span className="text-slate-300 font-medium">Neutral: <span className="text-slate-400 font-normal">Baseline Insufficient (N &lt; 10)</span></span>
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
        {!loadingEvents && !error && geoData?.features.length === 0 && (
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
      </Map>
    </div>
  );
}
