"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Map, { MapRef, Marker, Source, Layer } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { fetchGisEvents, fetchGisFacilities, fetchGisObservations, GeoCollection, Viewport } from "@/lib/apiClient";
import { Layers, MapPin, Compass, Navigation } from "lucide-react";

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
        "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
        "https://mt2.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
        "https://mt3.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
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
  selectedEventId,
  startTime,
  endTime,
  showFacilities = false,
  showObservations = false,
}: { 
  onEventClick: (id: string) => void;
  selectedEventId?: string | null;
  startTime?: string;
  endTime?: string;
  showFacilities?: boolean;
  showObservations?: boolean;
}) {
  const mapRef = useRef<MapRef>(null);
  const [geoData, setGeoData] = useState<GeoCollection | null>(null);
  const [facilityData, setFacilityData] = useState<GeoCollection | null>(null);
  const [observationData, setObservationData] = useState<GeoCollection | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ west: 68, south: 8.3, east: 96.98, north: 36.74, zoom: 4.8 });
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setError(null);
      Promise.all([
        fetchGisEvents(viewport, { start_time: startTime, end_time: endTime }),
        showFacilities ? fetchGisFacilities(viewport) : Promise.resolve(null),
        showObservations ? fetchGisObservations(viewport, { start_time: startTime, end_time: endTime }) : Promise.resolve(null),
      ])
        .then(([events, facilities, observations]) => { setGeoData(events); setFacilityData(facilities); setObservationData(observations); })
        .catch((err) => { console.error("Failed to fetch GIS events:", err); setError(err.message); });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [viewport, startTime, endTime, showFacilities, showObservations]);

  // Compute selected event feature
  const selectedFeature = useMemo(() => {
    if (!selectedEventId || !geoData?.features) return null;
    return geoData.features.find((f: any) => f.properties.event_id === selectedEventId) || null;
  }, [selectedEventId, geoData]);

  // Selected event GeoJSON source for adaptive radiance glow layers
  const selectedGeoJson = useMemo(() => {
    if (!selectedFeature) return null;
    return {
      type: "FeatureCollection",
      features: [selectedFeature]
    };
  }, [selectedFeature]);

  // Adaptive camera fly-to on Google Maps based on thermal radiance / temperature
  useEffect(() => {
    if (!selectedFeature) return;
    const [lon, lat] = selectedFeature.geometry.coordinates;
    const peakFrp = selectedFeature.properties.peak_frp_mw || 0;
    const tier = selectedFeature.properties.anomaly_tier;

    let targetZoom = 10.0;
    let targetPitch = 0;

    if (peakFrp >= 100 || tier === "CRITICAL") {
      targetZoom = 13.5;
      targetPitch = 30;
    } else if (peakFrp >= 20 || tier === "ABNORMAL") {
      targetZoom = 12.0;
      targetPitch = 20;
    } else if (peakFrp >= 5 || tier === "ELEVATED") {
      targetZoom = 11.0;
      targetPitch = 10;
    }

    mapRef.current?.flyTo({
      center: [lon, lat],
      zoom: targetZoom,
      pitch: targetPitch,
      duration: 1800,
      essential: true
    });
  }, [selectedFeature]);

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
        interactiveLayerIds={["events-circle-layer"]}
        onClick={(e) => {
          if (e.features && e.features.length > 0) {
            const eventId = e.features[0].properties?.event_id;
            if (eventId) onEventClick(eventId);
          }
        }}
        onMoveEnd={(event) => {
          const bounds = event.target.getBounds();
          setViewport({ west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth(), zoom: Number(event.viewState.zoom.toFixed(2)) });
        }}
      >
        {userLocation && (
          <Marker longitude={userLocation.lon} latitude={userLocation.lat} anchor="center">
            <div className="w-5 h-5 bg-blue-500 border-2 border-white rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>
          </Marker>
        )}

        {/* Global Cluster Points Layer on Google Maps */}
        {geoData && (
          <Source id="thermal-events-source" type="geojson" data={geoData}>
            <Layer
              id="events-circle-layer"
              type="circle"
              paint={{
                "circle-radius": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  3, 5,
                  8, 9,
                  14, 15
                ],
                "circle-color": [
                  "match",
                  ["get", "anomaly_tier"],
                  "CRITICAL", "#DC2626",
                  "ABNORMAL", "#EA580C",
                  "ELEVATED", "#D97706",
                  "#16A34A"
                ],
                "circle-stroke-width": 1.5,
                "circle-stroke-color": "#ffffff",
                "circle-opacity": 0.85
              }}
            />
          </Source>
        )}

        {facilityData && (
          <Source id="facilities-source" type="geojson" data={facilityData}>
            <Layer id="facilities-circle-layer" type="circle" paint={{ "circle-radius": 4, "circle-color": "#0369A1", "circle-stroke-width": 1, "circle-stroke-color": "#ffffff" }} />
          </Source>
        )}
        {observationData && (
          <Source id="firms-source" type="geojson" data={observationData}>
            <Layer id="firms-circle-layer" type="circle" paint={{ "circle-radius": 2.5, "circle-color": "#EA580C", "circle-opacity": 0.75 }} />
          </Source>
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
                  14, 70
                ],
                "circle-color": [
                  "match",
                  ["get", "anomaly_tier"],
                  "CRITICAL", "#FF0000",
                  "ABNORMAL", "#FF5722",
                  "ELEVATED", "#FF9800",
                  "#4CAF50"
                ],
                "circle-blur": 0.4,
                "circle-opacity": 0.75
              }}
            />
            {/* Intense White-Hot Center */}
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

        {/* Interactive HTML Markers for Selected Halo */}
        {geoData?.features?.map((f: any) => {
          const [lon, lat] = f.geometry.coordinates;
          const isSelected = f.properties.event_id === selectedEventId;
          const isCritical = f.properties.anomaly_tier === "CRITICAL";
          const isAbnormal = f.properties.anomaly_tier === "ABNORMAL";
          const isElevated = f.properties.anomaly_tier === "ELEVATED";
          
          const colorClass = isCritical 
            ? "bg-red-600 shadow-[0_0_14px_rgba(220,38,38,0.7)]" 
            : isAbnormal 
            ? "bg-orange-500 shadow-[0_0_10px_rgba(217,119,6,0.6)]" 
            : isElevated
            ? "bg-amber-500 shadow-[0_0_8px_rgba(202,138,4,0.5)]" 
            : "bg-emerald-600 shadow-[0_0_8px_rgba(22,163,74,0.5)]";

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
              <div className="relative group cursor-pointer p-1.5">
                {isSelected && (
                  <>
                    <div className="absolute -inset-4 rounded-full border-2 border-orange-500 animate-ping opacity-75 pointer-events-none" />
                    <div className="absolute -inset-2 rounded-full border-2 border-red-500 animate-pulse opacity-90 pointer-events-none" />
                  </>
                )}
                <div className={`w-3.5 h-3.5 ${colorClass} ${isSelected ? 'ring-4 ring-orange-500 scale-125' : ''} border-2 border-white rounded-full transition-transform transform group-hover:scale-150`} />
                <div className="absolute left-1/2 -translate-x-1/2 -top-8 opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap bg-slate-900 text-white text-[11px] font-mono px-2.5 py-1 rounded-lg shadow-2xl border border-slate-700 z-50">
                  <span className="font-semibold text-orange-400">{f.properties.classification}</span> · {f.properties.peak_frp_mw?.toFixed(0)} MW
                </div>
              </div>
            </Marker>
          );
        })}

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
        {error && <div role="alert" className="absolute top-4 left-4 z-20 rounded-md border border-red-200 bg-white px-3 py-2 text-xs text-red-700 shadow-sm">Map data unavailable: {error}</div>}
      </Map>
    </div>
  );
}
