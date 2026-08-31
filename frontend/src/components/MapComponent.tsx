"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Map, { MapRef, Marker, Source, Layer } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { fetchGisEvents, fetchEventDetail } from "@/lib/apiClient";
import { Layers, Navigation, Filter, Eye, EyeOff, Info, Factory, Sprout, HelpCircle } from "lucide-react";
import { ThermalMapMarker } from "./ThermalMapMarker";

// Google Maps Basemap Styles (Zero API Key required, High-Resolution Global Coverage)
const GOOGLE_ROADMAP: any = {
  version: 8,
  sources: {
    google_maps: {
      type: "raster",
      tiles: [
        "https://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
        "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
        "https://mt2.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
        "https://mt3.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
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
        "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
        "https://mt2.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
        "https://mt3.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
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

export default function MapComponent({ 
  onEventClick, 
  selectedEventId 
}: { 
  onEventClick: (id: string) => void;
  selectedEventId?: string | null;
}) {
  const mapRef = useRef<MapRef>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [selectedEventData, setSelectedEventData] = useState<any>(null);
  const [showAllDetections, setShowAllDetections] = useState<boolean>(false);
  const [showLegend, setShowLegend] = useState<boolean>(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lon: number} | null>(null);
  const [mapType, setMapType] = useState<"roadmap" | "hybrid">("roadmap");
  const [error, setError] = useState<string | null>(null);

  const handleMyLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setUserLocation({ lat: position.coords.latitude, lon: position.coords.longitude });
        mapRef.current?.flyTo({
          center: [position.coords.longitude, position.coords.latitude],
          zoom: 12,
          duration: 2000
        });
      }, (err) => {
        console.error("Geolocation failed: ", err);
      }, { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });
    }
  };

  // Instant flight to coordinates when an event is clicked in News, Alerts, or Chat
  useEffect(() => {
    const handleFlyToEvent = (e: any) => {
      const { coordinates, peakFrp, anomalyTier } = e.detail || {};
      if (coordinates && coordinates.length >= 2) {
        const [lon, lat] = coordinates;
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
      }
    };

    window.addEventListener("thermo-fly-to-event", handleFlyToEvent);
    return () => window.removeEventListener("thermo-fly-to-event", handleFlyToEvent);
  }, []);

  // Phase 11: Server-side decluttering query
  useEffect(() => {
    fetchGisEvents(showAllDetections, selectedEventId)
      .then((data) => setGeoData(data))
      .catch((err) => {
        console.error("Failed to fetch GIS events:", err);
        setError(err.message);
      });
  }, [showAllDetections, selectedEventId]);

  // Fetch selected event detail directly whenever selectedEventId changes
  useEffect(() => {
    if (!selectedEventId) {
      setSelectedEventData(null);
      return;
    }
    fetchEventDetail(selectedEventId)
      .then((res) => {
        setSelectedEventData(res);
        const lon = res?.longitude ?? res?.centroid?.coordinates?.[0];
        const lat = res?.latitude ?? res?.centroid?.coordinates?.[1];

        if (lon !== undefined && lat !== undefined && !isNaN(Number(lon)) && !isNaN(Number(lat))) {
          const peakFrp = res.peak_frp_mw || 0;
          const tier = res.anomaly_tier;

          let targetZoom = 12.0;
          let targetPitch = 0;
          if (peakFrp >= 50 || tier === "CRITICAL") {
            targetZoom = 13.5;
            targetPitch = 25;
          } else if (peakFrp >= 15 || tier === "ABNORMAL") {
            targetZoom = 12.5;
            targetPitch = 15;
          }

          mapRef.current?.flyTo({
            center: [Number(lon), Number(lat)],
            zoom: targetZoom,
            pitch: targetPitch,
            duration: 1500,
            essential: true
          });
        }
      })
      .catch((err) => {
        console.error("Failed to load selected event detail:", err);
      });
  }, [selectedEventId]);

  // Compute selected event feature
  const selectedFeature = useMemo(() => {
    if (!selectedEventId) return null;
    const found = geoData?.features?.find((f: any) => f.properties.event_id === selectedEventId);
    if (found) return found;
    
    const lon = selectedEventData?.longitude ?? selectedEventData?.centroid?.coordinates?.[0];
    const lat = selectedEventData?.latitude ?? selectedEventData?.centroid?.coordinates?.[1];

    if (lon !== undefined && lat !== undefined && !isNaN(Number(lon)) && !isNaN(Number(lat))) {
      return {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [Number(lon), Number(lat)]
        },
        properties: {
          event_id: selectedEventData.event_id || selectedEventId,
          classification: selectedEventData.classification || "OTHER_UNCERTAIN",
          anomaly_tier: selectedEventData.anomaly_tier || "NORMAL",
          peak_frp_mw: selectedEventData.peak_frp_mw || 0,
          confidence_pct: roundPct(selectedEventData.classification_confidence || 0),
          evidence_strength: selectedEventData.evidence_strength || "LIMITED"
        }
      };
    }
    return null;
  }, [selectedEventId, geoData, selectedEventData]);

  // Selected event GeoJSON source for adaptive radiance glow layers
  const selectedGeoJson = useMemo(() => {
    if (!selectedFeature) return null;
    return {
      type: "FeatureCollection" as const,
      features: [selectedFeature]
    };
  }, [selectedFeature]);

  // Check if selected feature is already in geoData features to avoid duplicates
  const isSelectedInGeoData = useMemo(() => {
    if (!selectedEventId || !geoData?.features) return false;
    return geoData.features.some((f: any) => f.properties.event_id === selectedEventId);
  }, [selectedEventId, geoData]);

  const eventCount = geoData?.features?.length || 0;

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-900">
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: 78.9629,
          latitude: 22.5937,
          zoom: 4.8,
          pitch: 0,
          bearing: 0
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={mapType === "roadmap" ? GOOGLE_ROADMAP : GOOGLE_HYBRID}
        minZoom={3}
        maxZoom={20}
      >
        {userLocation && (
          <Marker longitude={userLocation.lon} latitude={userLocation.lat} anchor="center">
            <div className="w-5 h-5 bg-blue-500 border-2 border-white rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>
          </Marker>
        )}

        {/* Adaptive Selected Thermal Radiance & Heat Diffusion Glow Layers */}
        {selectedGeoJson && (
          <Source id="selected-thermal-source" type="geojson" data={selectedGeoJson}>
            {/* Outer Radiant Heat Haze */}
            <Layer
              id="selected-radiant-heat-haze"
              type="circle"
              paint={{
                "circle-radius": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  6, 35,
                  10, 75,
                  14, 150
                ],
                "circle-color": [
                  "match",
                  ["get", "anomaly_tier"],
                  "CRITICAL", "#DC2626",
                  "ABNORMAL", "#EA580C",
                  "ELEVATED", "#D97706",
                  "#16A34A"
                ],
                "circle-blur": 0.85,
                "circle-opacity": 0.55
              }}
            />
            {/* Mid Thermal Dispersion Core */}
            <Layer
              id="selected-thermal-dispersion"
              type="circle"
              paint={{
                "circle-radius": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  6, 18,
                  10, 36,
                  14, 72
                ],
                "circle-color": [
                  "match",
                  ["get", "anomaly_tier"],
                  "CRITICAL", "#EF4444",
                  "ABNORMAL", "#F97316",
                  "ELEVATED", "#F59E0B",
                  "#22C55E"
                ],
                "circle-blur": 0.45,
                "circle-opacity": 0.75
              }}
            />
            {/* White-Hot Core Epicenter */}
            <Layer
              id="selected-white-hot-center"
              type="circle"
              paint={{
                "circle-radius": 8,
                "circle-color": "#FFFFFF",
                "circle-stroke-width": 3,
                "circle-stroke-color": "#EA580C",
                "circle-opacity": 1.0
              }}
            />
          </Source>
        )}

        {/* Phase 10: 9-Icon Symbology Markers (GeoData Events) */}
        {geoData?.features?.map((f: any) => {
          const [lon, lat] = f.geometry.coordinates;
          const isSelected = f.properties.event_id === selectedEventId;

          return (
            <Marker 
              key={f.properties.event_id} 
              longitude={lon} 
              latitude={lat} 
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onEventClick(f.properties.event_id);
              }}
            >
              <div className="relative group cursor-pointer p-1">
                <ThermalMapMarker
                  classification={f.properties.classification}
                  anomalyTier={f.properties.anomaly_tier}
                  isSelected={isSelected}
                  size={isSelected ? 34 : 24}
                />
                
                {/* Tactical Hover Pill */}
                <div className="absolute left-1/2 -translate-x-1/2 -top-9 opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap bg-slate-900 text-white text-[11px] font-mono px-2.5 py-1 rounded-lg shadow-2xl border border-slate-700 z-50 flex items-center gap-1.5">
                  <span className="font-bold text-orange-400">{f.properties.classification}</span>
                  <span className="text-slate-400">·</span>
                  <span>{f.properties.confidence_pct}%</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-[10px] text-slate-300 font-sans font-semibold bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                    Evidence: {f.properties.evidence_strength || "LIMITED"}
                  </span>
                </div>
              </div>
            </Marker>
          );
        })}

        {/* Standalone Selected Event Marker (Guaranteed rendering if not in geoData) */}
        {!isSelectedInGeoData && selectedFeature && (
          <Marker
            longitude={selectedFeature.geometry.coordinates[0]}
            latitude={selectedFeature.geometry.coordinates[1]}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onEventClick(selectedFeature.properties.event_id);
            }}
          >
            <div className="relative group cursor-pointer p-1">
              <ThermalMapMarker
                classification={selectedFeature.properties.classification}
                anomalyTier={selectedFeature.properties.anomaly_tier}
                isSelected={true}
                size={34}
              />
              <div className="absolute left-1/2 -translate-x-1/2 -top-9 opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap bg-slate-900 text-white text-[11px] font-mono px-2.5 py-1 rounded-lg shadow-2xl border border-slate-700 z-50 flex items-center gap-1.5">
                <span className="font-bold text-orange-400">{selectedFeature.properties.classification}</span>
                <span className="text-slate-400">·</span>
                <span className="text-emerald-400 font-bold">{selectedFeature.properties.peak_frp_mw?.toFixed(1)} MW</span>
              </div>
            </div>
          </Marker>
        )}

        {/* Phase 11: Decluttering Feed Control Bar (Top Left) */}
        <div className="absolute top-5 left-5 z-20 flex items-center gap-2">
          <button
            onClick={() => setShowAllDetections(!showAllDetections)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xl border transition backdrop-blur-md ${
              showAllDetections
                ? "bg-amber-500 text-slate-950 border-amber-400"
                : "bg-white/95 text-slate-800 border-slate-200 hover:bg-slate-100"
            }`}
            title="Toggle between default priority events and full raw detection stream"
          >
            {showAllDetections ? <Eye className="w-4 h-4 text-slate-950" /> : <EyeOff className="w-4 h-4 text-slate-500" />}
            <span>{showAllDetections ? "Showing All Detections" : "Priority Decluttered View"}</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${showAllDetections ? "bg-amber-600 text-white" : "bg-slate-200 text-slate-700"}`}>
              {eventCount}
            </span>
          </button>

          <button
            onClick={() => setShowLegend(!showLegend)}
            className={`p-2 rounded-xl text-xs font-semibold shadow-xl border transition backdrop-blur-md ${
              showLegend ? "bg-slate-800 text-white border-slate-700" : "bg-white/95 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
            title="Toggle 9-Icon Tactical Symbology Legend"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>

        {/* Phase 10: 9-Icon Tactical Symbology Legend Modal / Drawer */}
        {showLegend && (
          <div className="absolute top-16 left-5 z-30 bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-slate-700 w-72 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Tactical Symbology (9-Icon)</span>
              <span className="text-[10px] text-slate-500 font-mono">Type × Severity</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">1. Base Shape (Classification)</div>
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

              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pt-1">2. Semantic Color (Severity)</div>
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-600 border border-emerald-400"></span>
                  <span className="text-slate-300">Green: <span className="text-slate-400">Nominal & Elevated</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-orange-500 border border-orange-400"></span>
                  <span className="text-slate-300">Amber: <span className="text-slate-400">Abnormal Anomaly</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-600 border border-red-400"></span>
                  <span className="text-slate-300">Red: <span className="text-slate-400">Critical Anomaly</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-slate-500 border border-slate-400"></span>
                  <span className="text-slate-300">Neutral: <span className="text-slate-400">Baseline Insufficient (N&lt;10)</span></span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Controls Overlay (Google Map Type Toggle & My Location) */}
        <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-2">
          <div className="bg-white/95 backdrop-blur-md rounded-xl p-1 shadow-lg border border-slate-200 flex flex-col gap-1">
            <button
              onClick={() => setMapType("roadmap")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${mapType === "roadmap" ? "bg-orange-600 text-white shadow-sm" : "text-slate-700 hover:bg-slate-100"}`}
              title="Google Roadmap"
            >
              <Navigation className="w-3.5 h-3.5" />
              Google Map
            </button>
            <button
              onClick={() => setMapType("hybrid")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${mapType === "hybrid" ? "bg-orange-600 text-white shadow-sm" : "text-slate-700 hover:bg-slate-100"}`}
              title="Google High-Res Satellite with Road Labels"
            >
              <Layers className="w-3.5 h-3.5" />
              Satellite
            </button>
          </div>

          <button 
            onClick={handleMyLocation}
            className="bg-white hover:bg-slate-50 text-slate-700 p-3 rounded-xl shadow-lg border border-slate-200 transition flex items-center justify-center"
            title="My Location"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
        </div>
      </Map>
    </div>
  );
}

function roundPct(val: number) {
  return Math.round((val || 0) * 100);
}
