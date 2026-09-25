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
  fetchFacilityWind,
  fetchFirmsStatus,
  clearEventCache,
  GeoCollection,
  GeoFeature,
  Viewport,
  WindData,
} from "@/lib/apiClient";
import { buildAwarenessCorridorGeoJson, generateChevronsAlongCentreline } from "@/lib/corridorGeometry";
import { syncWindCorridorToMap, syncWindChevronsToMap } from "@/lib/windLayerHelper";
import {
  Layers,
  Navigation as NavigationIcon,
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
  Clock,
} from "lucide-react";
import { ThermalMapMarker } from "./ThermalMapMarker";
import FacilityDetailDrawer from "./FacilityDetailDrawer";
import { NearbyAlertCenter } from "./NearbyAlertCenter";
import { requestCurrentPosition } from "@/lib/geolocation";
import { updateAlertLocation } from "@/lib/nearbyAlerts";

function createGeoCircle(lon: number, lat: number, radiusMeters: number, points = 64) {
  const coords: [number, number][] = [];
  const km = radiusMeters / 1000;
  const distanceX = km / (111.32 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const distanceY = km / 110.574;

  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([lon + x, lat + y]);
  }

  return {
    type: "Feature" as const,
    geometry: {
      type: "Polygon" as const,
      coordinates: [coords],
    },
    properties: {
      radiusKm: radiusMeters / 1000,
    },
  };
}

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
  onWindVisibilityChange?: (visible: boolean) => void;
};

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

  // Unified Filter States (Default to 24h active window)
  const [windowHours, setWindowHours] = useState<number | null>(24);
  const [showAllDetections, setShowAllDetections] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [classFilter, setClassFilter] = useState<string>("");
  const [showFacilities, setShowFacilities] = useState(true);
  const [showObservations, setShowObservations] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [includeHistorical, setIncludeHistorical] = useState(false);
  const [cooldownFilter, setCooldownFilter] = useState<"ALL" | "ACTIVE" | "COOLED">("ALL");
  const fetchSequenceRef = useRef(0);
  const [showFreezeModal, setShowFreezeModal] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const seen = sessionStorage.getItem("thermo_freeze_ack_v1");
        if (!seen) {
          setShowFreezeModal(true);
        }
      } catch {}
    }
  }, []);

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
  const [firmsStatus, setFirmsStatus] = useState<any>(null);

  useEffect(() => {
    fetchFirmsStatus().then((data) => setFirmsStatus(data)).catch(() => {});
    const interval = setInterval(() => {
      fetchFirmsStatus().then((data) => setFirmsStatus(data)).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Facility ambient wind state when facility drawer is open without an active event
  const [facilityWind, setFacilityWind] = useState<WindData | null>(null);

  useEffect(() => {
    if (!selectedFacilityForDrawer?.id || selectedEventId) {
      setFacilityWind(null);
      return;
    }
    let cancelled = false;
    fetchFacilityWind(selectedFacilityForDrawer.id, {
      latitude: selectedFacilityForDrawer.latitude,
      longitude: selectedFacilityForDrawer.longitude,
    })
      .then((w) => {
        if (!cancelled && w?.available) setFacilityWind(w);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedFacilityForDrawer?.id, selectedFacilityForDrawer?.latitude, selectedFacilityForDrawer?.longitude, selectedEventId]);

  const activeWind = selectedEventId ? wind : (selectedFacilityForDrawer ? facilityWind : null);
  const activeWindVisible = windVisible;

  const handleHotspotClick = (id: string, lon?: number, lat?: number) => {
    if (onEventClick) {
      onEventClick(id);
    }
    if (lon !== undefined && lat !== undefined) {
      mapRef.current?.flyTo({
        center: [lon, lat],
        zoom: 12.5,
        duration: 1000,
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
    setWindowHours(24);
    setShowAllDetections(true);
    setSeverityFilter("");
    setClassFilter("");
    setShowFacilities(true);
    setShowObservations(false);
    setIncludeHistorical(false);
    setCooldownFilter("ALL");
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
    if (onEventClick) {
      onEventClick(null);
    }
    mapRef.current?.flyTo({
      center: [78.9629, 22.5937],
      zoom: 4.8,
      duration: 1200,
    });
  };

  const [locationError, setLocationError] = useState<string | null>(null);

  const userGeofenceCircle = useMemo(() => {
    if (!userLocation) return null;
    return createGeoCircle(userLocation.lon, userLocation.lat, 25000); // 25 km safety shield
  }, [userLocation]);

  useEffect(() => {
    try {
      const savedLat = localStorage.getItem("thermotrace_user_lat");
      const savedLon = localStorage.getItem("thermotrace_user_lon");
      if (savedLat && savedLon) {
        const lat = parseFloat(savedLat);
        const lon = parseFloat(savedLon);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          setUserLocation({ lat, lon });
        }
      }
    } catch {}

    const handleLocationSynced = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && Number.isFinite(detail.lat) && Number.isFinite(detail.lon)) {
        setUserLocation({ lat: detail.lat, lon: detail.lon });
      }
    };
    window.addEventListener("thermotrace-location-synced", handleLocationSynced);
    return () => window.removeEventListener("thermotrace-location-synced", handleLocationSynced);
  }, []);

  const handleMyLocation = () => {
    requestCurrentPosition()
      .then((position) => {
        const coords = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };
        setUserLocation(coords);
        setLocationError(null);
        try {
          localStorage.setItem("thermotrace_user_lat", String(coords.lat));
          localStorage.setItem("thermotrace_user_lon", String(coords.lon));
        } catch {}
        updateAlertLocation(coords.lat, coords.lon).catch(() => {});
        window.dispatchEvent(new CustomEvent("thermotrace-location-synced", { detail: coords }));
        mapRef.current?.flyTo({
          center: [coords.lon, coords.lat],
          zoom: 11.5,
          duration: 1800,
        });
      })
      .catch((error) => {
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

      const currentSeq = ++fetchSequenceRef.current;

      const effectiveHours = cooldownFilter === "COOLED"
        ? (windowHours && windowHours >= 72 ? windowHours : 72)
        : (windowHours ?? undefined);

      const effectiveIncludeHistorical = includeHistorical || cooldownFilter === "COOLED";

      const eventFilters = {
        hours: effectiveHours,
        start_time: effectiveHours === undefined ? startTime : undefined,
        classification: classFilter || undefined,
        anomaly_tier: severityFilter || undefined,
        show_all: showAllDetections,
        focus_event_id: selectedEventId || undefined,
        include_historical: effectiveIncludeHistorical,
      };

      Promise.all([
        fetchGisEvents(viewport, eventFilters),
        showFacilities ? fetchGisFacilities(viewport) : Promise.resolve<GeoCollection | null>(null),
        showObservations ? fetchGisObservations(viewport, { start_time: startTime }) : Promise.resolve<GeoCollection | null>(null),
      ])
        .then(([events, facilities, observations]) => {
          if (currentSeq !== fetchSequenceRef.current) return;
          setGeoData(events);
          setFacilityData(facilities);
          setObservationData(observations);
        })
        .catch((err) => {
          if (currentSeq !== fetchSequenceRef.current) return;
          console.error("Failed to fetch GIS data:", err);
          setError(err instanceof Error ? err.message : "Unknown map error");
        })
        .finally(() => {
          if (currentSeq === fetchSequenceRef.current) {
            setLoadingEvents(false);
          }
        });
    }, 30);

    return () => window.clearTimeout(timer);
  }, [
    viewport,
    startTime,
    windowHours,
    classFilter,
    severityFilter,
    showFacilities,
    showObservations,
    showAllDetections,
    includeHistorical,
    cooldownFilter,
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
  const showHistoricalData = includeHistorical || cooldownFilter === "COOLED";
  const isFilterActive = windowHours !== 24 || !showAllDetections || severityFilter !== "" || classFilter !== "" || includeHistorical || cooldownFilter !== "ALL";

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

  // Partition features into active interactive markers and cooled/historical markers
  const { freshFeatures, historicalFeatures } = useMemo(() => {
    const fresh: GeoFeature[] = [];
    const historical: GeoFeature[] = [];

    for (const f of displayFeatures) {
      const isSelected = selectedEventId === f.properties?.event_id;
      const isActive = f.properties?.is_active === true;
      const normLife = String(f.properties?.lifecycle_status || "").toUpperCase();
      const isCoolingEvent = normLife === "COOLING";
      const isExtinguished = normLife === "EXTINGUISHED" || normLife === "RESOLVED" || normLife === "HISTORICAL";
      const isCooled = !isActive || isCoolingEvent || isExtinguished;

      // Cooldown / Thermal Activity State Filtering:
      if (!isSelected) {
        if (cooldownFilter === "ACTIVE" && isCooled) continue;
        if (cooldownFilter === "COOLED" && !isCooled) continue;
      }

      if (isCooled) {
        if (showHistoricalData || isSelected) {
          historical.push(f);
        }
      } else {
        fresh.push(f);
      }
    }

    return { freshFeatures: fresh, historicalFeatures: historical };
  }, [displayFeatures, selectedEventId, cooldownFilter, showHistoricalData]);

  const historicalGeoJson = useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: historicalFeatures,
    };
  }, [historicalFeatures]);

  // Selected target coordinates (event or facility) for authoritative overlays
  const selectedCoords = useMemo<[number, number] | null>(() => {
    if (selectedEventId) {
      const feat = displayFeatures.find((f) => f.properties?.event_id === selectedEventId);
      if (feat && Array.isArray(feat.geometry?.coordinates)) {
        return [feat.geometry.coordinates[0], feat.geometry.coordinates[1]];
      }
      const lon = Number(selectedEventData?.longitude ?? selectedEventData?.centroid?.coordinates?.[0]);
      const lat = Number(selectedEventData?.latitude ?? selectedEventData?.centroid?.coordinates?.[1]);
      if (Number.isFinite(lon) && Number.isFinite(lat)) {
        return [lon, lat];
      }
    } else if (selectedFacilityForDrawer) {
      const lon = Number(selectedFacilityForDrawer.longitude);
      const lat = Number(selectedFacilityForDrawer.latitude);
      if (Number.isFinite(lon) && Number.isFinite(lat)) {
        return [lon, lat];
      }
    }
    return null;
  }, [selectedEventId, displayFeatures, selectedEventData, selectedFacilityForDrawer]);

  // Authoritative Downwind Awareness Corridor Data using shared pure geometry engine
  const windGeometry = useMemo(() => {
    if (!activeWindVisible || !activeWind?.available || !selectedCoords) return null;
    const [lon, lat] = selectedCoords;
    const toward = Number(activeWind.direction_toward_degrees);
    if (!Number.isFinite(toward)) return null;

    const speed = Number(activeWind.speed_kmh) || 0;
    const gusts = Number(activeWind.gusts_kmh) || null;

    const geo = buildAwarenessCorridorGeoJson({
      longitude: lon,
      latitude: lat,
      towardDeg: toward,
      speedKmh: speed,
      gustsKmh: gusts,
    });

    const isFacilityTarget = !selectedEventId && Boolean(selectedFacilityForDrawer);

    return {
      lon,
      lat,
      toward,
      fromDegrees: Number.isFinite(Number(activeWind.direction_from_degrees))
        ? Number(activeWind.direction_from_degrees)
        : Math.round(((toward - 180) % 360 + 360) % 360),
      fromCardinal: activeWind.direction_from_cardinal || "",
      toCardinal: activeWind.direction_toward_cardinal || "",
      speed,
      gusts,
      isFacilityTarget,
      geo,
    };
  }, [activeWindVisible, activeWind, selectedCoords, selectedEventId, selectedFacilityForDrawer]);

  const isSatellite = mapType === "hybrid";

  // Authoritative MapLibre Lifecycle Synchronizer for Wind-Directed Awareness Corridor
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const sync = () => {
      syncWindCorridorToMap({
        map,
        sourceId: "thermotrace-wind-corridor-source",
        layerPrefix: "thermotrace-wind-corridor",
        corridorResult: windGeometry?.geo || null,
        featureCollection: windGeometry?.geo?.featureCollection || null,
        isSatellite,
        visible: Boolean(activeWindVisible && windGeometry),
      });
    };

    sync();
    map.on("styledata", sync);
    map.on("style.load", sync);
    map.on("load", sync);

    return () => {
      map.off("styledata", sync);
      map.off("style.load", sync);
      map.off("load", sync);
    };
  }, [windGeometry, isSatellite, activeWindVisible]);

  // Dynamic moving chevron animation loop along downwind centreline
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !activeWindVisible || !windGeometry?.geo || windGeometry.geo.isLightVariable) return;

    const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    let animFrameId: number;
    let startTime: number | null = null;
    const speedMultiplier = Math.min(2.5, Math.max(0.5, windGeometry.speed / 10));

    const animate = (timestamp: number) => {
      if (document.hidden) {
        animFrameId = requestAnimationFrame(animate);
        return;
      }

      if (!startTime) startTime = timestamp;
      const elapsedSec = (timestamp - startTime) / 1000;
      const progress = (elapsedSec * 0.35 * speedMultiplier) % 1.0;

      const chevrons = generateChevronsAlongCentreline(
        windGeometry.lon,
        windGeometry.lat,
        windGeometry.geo.reachMeters,
        windGeometry.toward,
        progress,
        6
      );

      syncWindChevronsToMap(
        map,
        "thermotrace-wind-corridor-source",
        "thermotrace-wind-corridor",
        chevrons,
        isSatellite,
        true
      );

      animFrameId = requestAnimationFrame(animate);
    };

    animFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [windGeometry, isSatellite, activeWindVisible]);

  // Dynamic Camera Fit with Padding to prevent right dossier occlusion
  useEffect(() => {
    if (!windGeometry?.geo?.bounds || !mapRef.current) return;
    const [minLon, minLat, maxLon, maxLat] = windGeometry.geo.bounds;
    const isDesktop = typeof window !== "undefined" && window.innerWidth >= 768;
    const padding = isDesktop
      ? { top: 60, bottom: 60, left: 60, right: 540 }
      : { top: 70, bottom: 180, left: 24, right: 24 };

    mapRef.current.fitBounds(
      [
        [minLon, minLat],
        [maxLon, maxLat],
      ],
      {
        padding,
        maxZoom: 14.5,
        duration: 900,
        essential: true,
      }
    );
  }, [windGeometry?.lon, windGeometry?.lat, windGeometry?.toward]);

  return (
    <div data-tour="map-container" className="relative w-full h-full bg-slate-950 overflow-hidden font-sans">
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: 78.9629,
          latitude: 22.5937,
          zoom: 4.8,
        }}
        mapStyle={mapType === "hybrid" ? GOOGLE_HYBRID : GOOGLE_ROADMAP}
        style={{ width: "100%", height: "100%" }}
        onLoad={(e) => {
          syncWindCorridorToMap({
            map: e.target,
            sourceId: "thermotrace-wind-corridor-source",
            layerPrefix: "thermotrace-wind-corridor",
            corridorResult: windGeometry?.geo || null,
            featureCollection: windGeometry?.geo?.featureCollection || null,
            isSatellite,
            visible: Boolean(activeWindVisible && windGeometry),
          });
        }}
        interactiveLayerIds={[
          ...(showFacilities ? ["facilities-circles"] : []),
          ...(showHistoricalData && historicalFeatures.length > 500 ? ["historical-clusters-circle"] : []),
        ]}
        onClick={(e) => {
          const feature = e.features?.[0];
          if (feature && feature.layer?.id === "historical-clusters-circle") {
            const clusterId = feature.properties?.cluster_id;
            const mapboxSource = mapRef.current?.getMap().getSource("historical-clusters") as any;
            if (mapboxSource && clusterId != null) {
              mapboxSource.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
                if (err) return;
                const coords = (feature.geometry as any).coordinates;
                mapRef.current?.easeTo({
                  center: coords,
                  zoom: zoom + 0.5,
                  duration: 500,
                });
              });
            }
            return;
          }
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
                  0, "rgba(0, 255, 0, 0)",
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

        {/* Clustered Historical Events Layer (when >500 historical events to protect DOM & 60fps) */}
        {showHistoricalData && historicalFeatures.length > 500 && (
          <Source
            id="historical-clusters"
            type="geojson"
            data={historicalGeoJson as any}
            cluster={true}
            clusterMaxZoom={12}
            clusterRadius={40}
          >
            <Layer
              id="historical-clusters-circle"
              type="circle"
              filter={["has", "point_count"]}
              paint={{
                "circle-color": [
                  "step",
                  ["get", "point_count"],
                  "#64748b",
                  25,
                  "#475569",
                  100,
                  "#334155",
                ],
                "circle-radius": [
                  "step",
                  ["get", "point_count"],
                  15,
                  25,
                  20,
                  100,
                  26,
                ],
                "circle-stroke-width": 1.5,
                "circle-stroke-color": "#94a3b8",
                "circle-opacity": 0.85,
              }}
            />
            <Layer
              id="historical-clusters-count"
              type="symbol"
              filter={["has", "point_count"]}
              layout={{
                "text-field": "{point_count_abbreviated}",
                "text-size": 11,
              }}
              paint={{
                "text-color": "#f8fafc",
              }}
            />
          </Source>
        )}

        {/* Thermal Event Markers: Fresh features are ALWAYS rendered as unclustered rich interactive markers */}
        {freshFeatures.map((feature) => {
          const [lon, lat] = feature.geometry.coordinates;
          const { event_id, classification, anomaly_tier, peak_frp_mw, max_brightness_k, lifecycle_status, is_active, latest_detected_utc } = feature.properties;
          const isSelected = selectedEventId === event_id;
          const normLife = String(lifecycle_status || "").toUpperCase();
          const isFreshByTimestamp = latest_detected_utc
            ? (Date.now() - new Date(latest_detected_utc).getTime()) < 24 * 3600 * 1000
            : false;
          const isCooled = is_active === false ||
            normLife === "EXTINGUISHED" ||
            normLife === "RESOLVED" ||
            normLife === "COOLING" ||
            normLife === "HISTORICAL" ||
            !isFreshByTimestamp;

          return (
            <Marker
              key={`thermal-marker-${event_id}`}
              longitude={lon}
              latitude={lat}
              anchor="center"
              style={{ zIndex: isSelected ? 40 : 12 }}
              onClick={(e) => {
                e.originalEvent?.stopPropagation();
                handleHotspotClick(event_id, lon, lat);
              }}
            >
              <div 
                data-tour="map-marker"
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
                  <span className="text-slate-500">·</span>
                  <span className={`text-[10px] font-semibold uppercase ${isCooled ? "text-sky-300" : "text-emerald-400"}`}>
                    {isCooled ? (normLife === "COOLING" ? "Aging (24-72h)" : "Historical (>72h)") : "Active (<24h)"}
                  </span>
                </div>
              </div>
            </Marker>
          );
        })}

        {/* Historical Event Markers: Rendered when historical data is present or requested */}
        {(showHistoricalData || cooldownFilter === "COOLED" || historicalFeatures.length > 0) && historicalFeatures.slice(0, 500).map((feature) => {
          const [lon, lat] = feature.geometry.coordinates;
          const { event_id, classification, anomaly_tier, peak_frp_mw, max_brightness_k, lifecycle_status } = feature.properties;
          const isSelected = selectedEventId === event_id;
          const normLife = String(lifecycle_status || "").toUpperCase();

          return (
            <Marker
              key={`historical-marker-${event_id}`}
              longitude={lon}
              latitude={lat}
              anchor="center"
              style={{ zIndex: isSelected ? 40 : 8 }}
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
                  isCooled={true}
                  onClick={() => handleHotspotClick(event_id, lon, lat)}
                />
                <div className="absolute left-1/2 -translate-x-1/2 -top-8 opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap bg-slate-900/95 text-white text-[11px] font-mono px-2.5 py-1 rounded-lg shadow-xl border border-slate-700 z-50 flex items-center gap-1.5 backdrop-blur-md">
                  <span className="font-bold text-slate-300">{classification}</span>
                  <span className="text-slate-500">·</span>
                  <span className="text-emerald-400 font-semibold">{Number(peak_frp_mw || 0).toFixed(1)} MW</span>
                  <span className="text-slate-500">·</span>
                  <span className="text-[10px] font-semibold uppercase text-sky-300">
                    {normLife === "COOLING" ? "Aging (24-72h)" : "Historical (>72h)"}
                  </span>
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

        {/* Anchored Wind Direction & Speed Pill Badge */}
        {windGeometry && (
          <Marker
              key={`selected-target-wind-badge-${selectedEventId || selectedFacilityForDrawer?.id || "target"}`}
              longitude={windGeometry.lon}
              latitude={windGeometry.lat}
              anchor="bottom-left"
              offset={[14, -14]}
              style={{ zIndex: 15, pointerEvents: "none" }}
            >
              <div
                data-testid="wind-vector-overlay"
                aria-label={`Wind ${windGeometry.fromCardinal} to ${windGeometry.toCardinal} at ${Math.round(windGeometry.speed)} kilometres per hour, bearing ${Math.round(windGeometry.toward)} degrees`}
                className="hidden md:flex pointer-events-none rounded-lg border border-slate-700/90 bg-slate-950/90 px-2.5 py-1 shadow-2xl backdrop-blur-md select-none font-mono text-left items-center gap-1.5"
              >
                <div 
                  className="w-4 h-4 rounded-full bg-cyan-500/20 border border-cyan-400/80 flex items-center justify-center text-cyan-400 shrink-0"
                  style={{ transform: `rotate(${Math.round(windGeometry.toward)}deg)` }}
                >
                  <NavigationIcon className="w-2.5 h-2.5 text-cyan-400 fill-cyan-400" />
                </div>
                <span className="text-[11px] font-bold text-white whitespace-nowrap">
                  wind {Math.round(windGeometry.speed)} km/h · {windGeometry.fromCardinal} → {windGeometry.toCardinal} ({Math.round(windGeometry.toward)}°)
                  {windGeometry.isFacilityTarget && (
                    <span className="ml-1 text-[9px] text-amber-300 font-semibold uppercase">[Ambient]</span>
                  )}
                </span>
              </div>
            </Marker>
        )}

        {/* User Proximity Safety Geofence Layer (25km Contextual Shield) */}
        {userGeofenceCircle && (
          <Source id="user-geofence-source" type="geojson" data={userGeofenceCircle as any}>
            <Layer
              id="user-geofence-fill"
              type="fill"
              paint={{
                "fill-color": "#3b82f6",
                "fill-opacity": 0.07,
              }}
            />
            <Layer
              id="user-geofence-glow"
              type="line"
              paint={{
                "line-color": "#60a5fa",
                "line-width": 4,
                "line-opacity": 0.25,
                "line-blur": 2,
              }}
            />
            <Layer
              id="user-geofence-outline"
              type="line"
              paint={{
                "line-color": "#2563eb",
                "line-width": 1.6,
                "line-dasharray": [3, 2],
                "line-opacity": 0.75,
              }}
            />
          </Source>
        )}

        {/* User Alert Location Pulse Beacon Marker */}
        {userLocation && (
          <Marker
            key="user-alert-location-marker"
            longitude={userLocation.lon}
            latitude={userLocation.lat}
            anchor="center"
            style={{ zIndex: 40 }}
          >
            <div 
              className="relative flex items-center justify-center group pointer-events-auto cursor-pointer select-none"
              title="Your Alert Location (Monitoring 25 km Safety Shield)"
            >
              <div className="absolute -top-7 px-2 py-0.5 rounded-md bg-slate-900/90 text-white text-[10px] font-mono whitespace-nowrap border border-blue-400/50 shadow-md flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                <span>My Location · 25km Shield</span>
              </div>
              <span className="absolute w-8 h-8 rounded-full bg-blue-500/30 animate-ping pointer-events-none" />
              <span className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-lg ring-2 ring-blue-400" />
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

        {/* UNIFIED TACTICAL RADAR TOOLBAR */}
        <div className="absolute top-4 left-4 right-4 md:right-auto z-20 max-w-full md:max-w-2xl">
          {/* Mobile Top Floating Bar (<= 768px): Single Filter Icon Button + Live Header */}
          <div className="flex md:hidden items-center justify-between bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl px-3 py-2 shadow-2xl text-white">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold font-mono tracking-wider text-slate-200 truncate">
                THERMAL RADAR
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 shrink-0">
                {cooldownFilter === "COOLED"
                  ? `${historicalFeatures.length} Cooled`
                  : cooldownFilter === "ACTIVE"
                  ? `${freshFeatures.length} Active`
                  : `${freshFeatures.length} Active${historicalFeatures.length > 0 ? ` · ${historicalFeatures.length} Hist` : ""}`}
              </span>
            </div>

            {/* Single Mobile Filter Icon Button with Active Badge */}
            <button
              onClick={() => setIsMobileFilterOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition cursor-pointer relative shrink-0"
              title="Open Radar Filters"
              type="button"
            >
              <Filter className="w-4 h-4 text-orange-400" />
              <span>Filters</span>
              {isFilterActive && (
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse border border-slate-900" />
              )}
            </button>
          </div>

          {/* Desktop Control Card (>= 768px): Full Box Unchanged */}
          <div className="hidden md:flex bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3 shadow-2xl text-white flex-col gap-2.5">
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
                <span id="radar-event-count-pill" className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  {cooldownFilter === "COOLED"
                    ? `${historicalFeatures.length} Cooled Down`
                    : cooldownFilter === "ACTIVE"
                    ? `${freshFeatures.length} Active`
                    : `${freshFeatures.length} Active${historicalFeatures.length > 0 ? ` · ${historicalFeatures.length} Historical` : ""}`} {viewport.zoom >= 9.5 || selectedEventId ? "in view" : "(Pan-India)"}
                </span>
              </div>

              {/* Time Window Buttons */}
              <div className="flex items-center gap-1 bg-slate-800/90 p-0.5 rounded-xl border border-slate-700">
                {([
                  [12, "12h"],
                  [24, "24h"],
                  [168, "7d"],
                  [720, "30d"],
                  [null, "All"],
                ] as const).map(([hours, label]) => (
                  <button
                    key={label}
                    onClick={() => {
                      setWindowHours(hours);
                      if (hours === null || hours > 24) {
                        setIncludeHistorical(true);
                      }
                    }}
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

            {/* Sovereign Evaluation Benchmark Freeze Info Button */}
            <div className="flex items-center gap-1.5 px-1">
              <button
                type="button"
                onClick={() => setShowFreezeModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-950/50 hover:bg-cyan-900/70 border border-cyan-500/30 rounded-lg text-[10.5px] text-cyan-300 transition-colors cursor-pointer"
                title="View Sovereign Evaluation Benchmark Details"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                <span className="font-semibold text-cyan-200">Benchmark Freeze:</span>
                <span className="text-white font-medium">Aug 19 – Sep 20</span>
                <span className="text-[9.5px] text-cyan-400 underline ml-0.5">Details</span>
              </button>
            </div>

            {/* View Mode + Filters */}
            <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-800 text-xs">
              <button
                onClick={() => setShowAllDetections((prev) => !prev)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
                  showAllDetections
                    ? "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
                    : "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm"
                }`}
                title="Toggle high-priority anomalies"
                type="button"
              >
                {showAllDetections ? <Eye className="w-3.5 h-3.5 text-slate-400" /> : <EyeOff className="w-3.5 h-3.5 text-amber-400" />}
                <span>{showAllDetections ? "All Hotspots" : "Priority Only"}</span>
              </button>

              <button
                onClick={() => {
                  setIncludeHistorical((prev) => {
                    const next = !prev;
                    if (!next && cooldownFilter === "COOLED") {
                      setCooldownFilter("ALL");
                    }
                    return next;
                  });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer ${
                  showHistoricalData
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm"
                    : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200"
                }`}
                title="Last observed 24 hours ago or earlier; current activity unconfirmed."
                type="button"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Historical {showHistoricalData ? "(ON)" : ""}</span>
              </button>

              <select
                aria-label="Thermal State / Cooldown Filter"
                value={cooldownFilter}
                onChange={(e) => {
                  const val = e.target.value as "ALL" | "ACTIVE" | "COOLED";
                  setCooldownFilter(val);
                  if (val === "COOLED" && !includeHistorical) {
                    setIncludeHistorical(true);
                  }
                }}
                className={`border rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none cursor-pointer transition ${
                  cooldownFilter !== "ALL"
                    ? "bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:text-slate-200"
                }`}
                title="Filter by thermal activity state: Active or Cooled Down"
              >
                <option value="ALL" className="bg-slate-800 text-slate-300">All States</option>
                <option value="ACTIVE" className="bg-slate-800 text-emerald-400">🔥 Active (&lt;24h)</option>
                <option value="COOLED" className="bg-slate-800 text-sky-300">❄️ Cooled Down</option>
              </select>

              <select
                aria-label="Severity Filter"
                value={severityFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setSeverityFilter(val);
                  if (val) {
                    setShowAllDetections(true);
                    if (val === "CRITICAL" && windowHours === 12) setWindowHours(168);
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

              {isFilterActive && (
                <button
                  onClick={handleClearFilters}
                  type="button"
                  className="px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition cursor-pointer"
                  title="Reset all filters to defaults"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}

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

              <div className="ml-auto pl-1">
                <NearbyAlertCenter />
              </div>
            </div>
          </div>
        </div>

        {/* MOBILE BOTTOM SHEET FILTER OVERLAY MODAL (< md) */}
        {isMobileFilterOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center md:hidden bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
            <div className="w-full bg-slate-900 border-t border-slate-800 rounded-t-2xl p-4 shadow-2xl text-white space-y-4 max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
              {/* Header + Close Button */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-orange-400" />
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                    Radar Filter Settings
                  </h3>
                </div>
                <button
                  onClick={() => setIsMobileFilterOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  type="button"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Time Window Section */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Time Horizon Window
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {([
                    [12, "12h"],
                    [24, "24h"],
                    [168, "7d"],
                    [720, "30d"],
                    [null, "All"],
                  ] as const).map(([hours, label]) => (
                    <button
                      key={label}
                      onClick={() => {
                        setWindowHours(hours);
                        if (hours === null || hours > 24) {
                          setIncludeHistorical(true);
                        }
                      }}
                      className={`py-2 rounded-xl text-xs font-bold transition text-center ${
                        windowHours === hours
                          ? "bg-orange-600 text-white shadow-md shadow-orange-900/40"
                          : "bg-slate-800 text-slate-300 border border-slate-700"
                      }`}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Severity & Classification Filters */}
              <div className="space-y-3 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Thermal Severity Level
                  </label>
                  <select
                    value={severityFilter}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSeverityFilter(val);
                      if (val) {
                        setShowAllDetections(true);
                        if (val === "CRITICAL" && windowHours === 12) setWindowHours(168);
                      }
                    }}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl p-2.5 text-xs font-medium focus:outline-none focus:border-orange-500"
                  >
                    <option value="">All Severities</option>
                    <option value="CRITICAL">🔴 Critical Only</option>
                    <option value="ABNORMAL">🟠 Abnormal</option>
                    <option value="ELEVATED">🟢 Elevated</option>
                    <option value="NORMAL">⚪ Nominal</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Emitter Category
                  </label>
                  <select
                    value={classFilter}
                    onChange={(e) => {
                      setClassFilter(e.target.value);
                      if (e.target.value) setShowAllDetections(true);
                    }}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl p-2.5 text-xs font-medium focus:outline-none focus:border-orange-500"
                  >
                    <option value="">All Categories</option>
                    <option value="INDUSTRY">🏭 Industry (All Levels)</option>
                    <option value="AGRI_BURN">🌾 Agriculture (Crop)</option>
                    <option value="WILDFIRE">🌲 Forest Wildfire</option>
                    <option value="OTHER_UNCERTAIN">❓ Other / Uncertain</option>
                  </select>
                </div>

                {/* Historical Events Toggle */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Historical Observations
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIncludeHistorical((prev) => {
                        const next = !prev;
                        if (!next && cooldownFilter === "COOLED") {
                          setCooldownFilter("ALL");
                        }
                        return next;
                      });
                    }}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-between border transition cursor-pointer ${
                      showHistoricalData
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : "bg-slate-800 text-slate-300 border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span>Show Historical Events</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700">
                      {showHistoricalData ? "ENABLED" : "OFF"}
                    </span>
                  </button>
                  <p className="text-[10.5px] text-slate-400 leading-tight">
                    Last observed 24 hours ago or earlier; current activity unconfirmed.
                  </p>
                </div>

                {/* Thermal Activity / Cooldown State Filter */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Thermal Activity State
                  </label>
                  <select
                    aria-label="Mobile Thermal State Filter"
                    value={cooldownFilter}
                    onChange={(e) => {
                      const val = e.target.value as "ALL" | "ACTIVE" | "COOLED";
                      setCooldownFilter(val);
                      if (val === "COOLED" && !includeHistorical) {
                        setIncludeHistorical(true);
                      }
                    }}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl p-2.5 text-xs font-medium focus:outline-none focus:border-orange-500 cursor-pointer"
                  >
                    <option value="ALL">All Thermal States</option>
                    <option value="ACTIVE">🔥 Active Hotspots (&lt;24h)</option>
                    <option value="COOLED">❄️ Cooled Down (Aging / Extinguished)</option>
                  </select>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800 gap-2">
                {isFilterActive ? (
                  <button
                    onClick={handleClearFilters}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/30 flex items-center gap-1.5"
                    type="button"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset Defaults
                  </button>
                ) : (
                  <span className="text-xs text-slate-500 font-mono">Default 24h Filter</span>
                )}

                <button
                  onClick={() => setIsMobileFilterOpen(false)}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-orange-600 text-white shadow-lg shadow-orange-900/40 hover:bg-orange-500 transition"
                  type="button"
                >
                  Apply & Close
                </button>
              </div>
            </div>
          </div>
        )}

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
              <NavigationIcon className="w-3.5 h-3.5" />
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
          <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-900/90 backdrop-blur-md px-4 py-2 text-xs font-mono text-slate-300 shadow-xl flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            Scanning sovereign thermal spectrum...
          </div>
        )}

        {/* Empty State Card: Positioned at top-40 to prevent any overlap with toolbar horizon controls */}
        {!loadingEvents && !error && displayFeatures.length === 0 && (
          <div className="absolute left-1/2 top-40 z-20 w-96 -translate-x-1/2 rounded-2xl border border-slate-700 bg-slate-900/95 backdrop-blur-md p-5 text-center text-xs text-slate-300 shadow-2xl">
            <p className="font-semibold text-slate-100 text-sm">
              {windowHours === 6 ? "No Observations in 6-Hour Window" : "No Thermal Events Found"}
            </p>
            <div className="mt-1.5 text-slate-400 leading-relaxed space-y-1">
              {windowHours === 6 ? (
                <>
                  <p>No matching satellite observations detected within the past 6 hours.</p>
                  {firmsStatus?.latest_observation_timestamp_utc && (
                    <p className="text-slate-300 font-mono text-[11px]">
                      Latest telemetry: {new Date(firmsStatus.latest_observation_timestamp_utc).toUTCString()}
                    </p>
                  )}
                  {firmsStatus?.last_successful_firms_fetch_utc && (
                    <p className="text-slate-400 font-mono text-[10.5px]">
                      Last NASA FIRMS sync: {new Date(firmsStatus.last_successful_firms_fetch_utc).toUTCString()} (60-min cadence)
                    </p>
                  )}
                </>
              ) : (
                <p>No detections matched your active time window or filters.</p>
              )}
            </div>
            <div className="mt-4 flex items-center justify-center gap-2">
              {windowHours === 6 && (
                <button
                  onClick={() => setWindowHours(24)}
                  className="rounded-xl bg-orange-600 px-3.5 py-1.5 font-semibold text-white hover:bg-orange-500 transition shadow-md shadow-orange-900/40 cursor-pointer"
                  type="button"
                >
                  View 24h Window
                </button>
              )}
              <button
                onClick={handleClearFilters}
                className="rounded-xl bg-slate-800 border border-slate-700 px-3.5 py-1.5 font-semibold text-slate-300 hover:bg-slate-700 transition cursor-pointer"
                type="button"
              >
                Reset All Filters
              </button>
            </div>
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

      {/* Sovereign Evaluation Benchmark Freeze Popup Modal */}
      {showFreezeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden text-slate-100 p-6 space-y-4">
            {/* Accent Header Bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" />
            
            <div className="flex items-start justify-between pt-1">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Sovereign Evaluation Benchmark Freeze
                  </h3>
                </div>
                <p className="text-xs text-cyan-300 font-mono">
                  Benchmark Window: August 19, 2026 – September 20, 2026 (32 Days)
                </p>
              </div>
              <button
                onClick={() => {
                  try { sessionStorage.setItem("thermo_freeze_ack_v1", "true"); } catch {}
                  setShowFreezeModal(false);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                type="button"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed border-y border-slate-800 py-3.5">
              <div className="flex gap-2.5">
                <span className="text-cyan-400 font-bold shrink-0">1.</span>
                <p>
                  <strong className="text-slate-100">Storage Constraints &amp; Paused Polling:</strong> NASA FIRMS automated background polling has been paused to strictly comply with deployment storage quotas and prevent memory starvation.
                </p>
              </div>
              <div className="flex gap-2.5">
                <span className="text-cyan-400 font-bold shrink-0">2.</span>
                <p>
                  <strong className="text-slate-100">Deterministic Audit Integrity:</strong> All 1,957 thermal events across India (Steel, Refineries, Agricultural Stubble Burns, and Wildfires) are anchored to a frozen benchmark timestamp so evaluation results never decay over time.
                </p>
              </div>
              <div className="flex gap-2.5">
                <span className="text-cyan-400 font-bold shrink-0">3.</span>
                <p>
                  <strong className="text-slate-100">Zero-Latency In-Memory Caching:</strong> All time-window filters (12h, 24h, 7d, 30d) now serve directly from memory in under 10 milliseconds with zero repeated database fetches.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                try { sessionStorage.setItem("thermo_freeze_ack_v1", "true"); } catch {}
                setShowFreezeModal(false);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs tracking-wide shadow-lg shadow-cyan-950/50 transition-all cursor-pointer"
            >
              Acknowledge &amp; Inspect Benchmark
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
