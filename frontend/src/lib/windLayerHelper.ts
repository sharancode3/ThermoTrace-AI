import type { Map as MapLibreMap } from "maplibre-gl";
import type { CorridorGeometryResult } from "./corridorGeometry";

export interface SyncWindCorridorOptions {
  map: MapLibreMap | any;
  sourceId: string;
  layerPrefix: string;
  corridorResult?: CorridorGeometryResult | null;
  featureCollection?: GeoJSON.FeatureCollection | null;
  isSatellite: boolean;
  visible?: boolean;
}

function syncSource(map: any, id: string, data: any) {
  const existing = map.getSource(id);
  const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
  const payload = data || empty;
  if (existing) {
    if (typeof existing.setData === "function") {
      try {
        existing.setData(payload);
      } catch (e) {
        console.warn(`[WindLayerHelper] Failed setData on ${id}:`, e);
      }
    }
  } else {
    try {
      map.addSource(id, {
        type: "geojson",
        data: payload,
      });
    } catch (e) {
      console.warn(`[WindLayerHelper] Error adding source ${id}:`, e);
    }
  }
}

function syncLayer(map: any, def: any, visible: boolean) {
  const existing = map.getLayer(def.id);
  if (!existing) {
    try {
      map.addLayer({
        ...def,
        layout: { ...(def.layout || {}), visibility: visible ? "visible" : "none" },
      });
    } catch (e) {
      console.warn(`[WindLayerHelper] Error adding layer ${def.id}:`, e);
    }
  } else {
    for (const [propName, propVal] of Object.entries(def.paint || {})) {
      try {
        map.setPaintProperty(def.id, propName, propVal);
      } catch {}
    }
    try {
      map.setLayoutProperty(def.id, "visibility", visible ? "visible" : "none");
    } catch {}
  }
}

/**
 * Authoritative MapLibre Lifecycle Synchronizer for Wind-Directed Awareness Corridor
 */
export function syncWindCorridorToMap({
  map,
  sourceId,
  layerPrefix,
  corridorResult,
  featureCollection,
  isSatellite,
  visible = true,
}: SyncWindCorridorOptions): boolean {
  if (!map) return false;

  const styleReady = Boolean(
    map.style &&
    ((map.style as any)._loaded || (typeof map.isStyleLoaded === "function" && map.isStyleLoaded()))
  );

  if (!styleReady) {
    map.once("styledata", () => {
      syncWindCorridorToMap({
        map,
        sourceId,
        layerPrefix,
        corridorResult,
        featureCollection,
        isSatellite,
        visible,
      });
    });
    return false;
  }

  const isVisible = Boolean(visible && (corridorResult || featureCollection));
  const emptyFc: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

  // 1. Sync Dedicated Sources
  const fillData = isVisible ? (corridorResult?.sectorPolygon || featureCollection || emptyFc) : emptyFc;
  const outlineData = isVisible ? (corridorResult?.sectorOutline || featureCollection || emptyFc) : emptyFc;
  const centerlineData = isVisible ? (corridorResult?.centerline || featureCollection || emptyFc) : emptyFc;
  const arrowData = isVisible && corridorResult?.arrowhead ? corridorResult.arrowhead : emptyFc;
  const arcsData = isVisible && corridorResult?.advectionArcs ? corridorResult.advectionArcs : emptyFc;

  syncSource(map, `${sourceId}-fill`, fillData);
  syncSource(map, `${sourceId}-outline`, outlineData);
  syncSource(map, `${sourceId}-centerline`, centerlineData);
  syncSource(map, `${sourceId}-arrow`, arrowData);
  syncSource(map, `${sourceId}-arcs`, arcsData);

  // 2. Sync Layers
  // 1. Shaded Fill (semi-transparent sector fan)
  syncLayer(
    map,
    {
      id: `${layerPrefix}-fill`,
      type: "fill",
      source: `${sourceId}-fill`,
      paint: {
        "fill-color": isSatellite ? "#0284c7" : "#06b6d4",
        "fill-opacity": isSatellite ? 0.32 : 0.24,
      },
    },
    isVisible
  );

  // 2. Sector Boundary Line
  syncLayer(
    map,
    {
      id: `${layerPrefix}-outline`,
      type: "line",
      source: `${sourceId}-outline`,
      paint: {
        "line-color": isSatellite ? "#38bdf8" : "#0284c7",
        "line-width": 2,
        "line-opacity": 0.95,
      },
    },
    isVisible
  );

  // 3. Central Downwind Line
  syncLayer(
    map,
    {
      id: `${layerPrefix}-centerline`,
      type: "line",
      source: `${sourceId}-centerline`,
      paint: {
        "line-color": isSatellite ? "#bae6fd" : "#0369a1",
        "line-width": 2.5,
        "line-opacity": 0.95,
      },
    },
    isVisible
  );

  // 4. Arrowhead Fill
  syncLayer(
    map,
    {
      id: `${layerPrefix}-arrow-fill`,
      type: "fill",
      source: `${sourceId}-arrow`,
      paint: {
        "fill-color": isSatellite ? "#38bdf8" : "#0284c7",
        "fill-opacity": 0.95,
      },
    },
    isVisible && Boolean(corridorResult?.arrowhead)
  );

  // 5. Arrowhead Outline
  syncLayer(
    map,
    {
      id: `${layerPrefix}-arrow-outline`,
      type: "line",
      source: `${sourceId}-arrow`,
      paint: {
        "line-color": "#ffffff",
        "line-width": 1.5,
        "line-opacity": 1.0,
      },
    },
    isVisible && Boolean(corridorResult?.arrowhead)
  );

  // 6. Advection Arcs
  syncLayer(
    map,
    {
      id: `${layerPrefix}-arcs`,
      type: "line",
      source: `${sourceId}-arcs`,
      paint: {
        "line-color": isSatellite ? "#bae6fd" : "#38bdf8",
        "line-width": 1.5,
        "line-opacity": 0.85,
      },
    },
    isVisible
  );

  try {
    if (typeof map.triggerRepaint === "function") {
      map.triggerRepaint();
    }
  } catch {}

  return true;
}

/**
 * Cleanly removes wind corridor source and layers from a map instance.
 */
export function removeWindCorridorFromMap(map: MapLibreMap | any, sourceId: string, layerPrefix: string): void {
  if (!map) return;
  const isLoaded = typeof map.isStyleLoaded === "function" ? map.isStyleLoaded() : Boolean(map.style);
  if (!isLoaded) return;

  const layerSuffixes = [
    "fill",
    "radial-fill",
    "outline",
    "radial-outline",
    "centerline",
    "arrow-fill",
    "arrow-outline",
    "arcs",
    "gust-envelope",
  ];

  for (const suffix of layerSuffixes) {
    const id = `${layerPrefix}-${suffix}`;
    if (map.getLayer(id)) {
      try {
        map.removeLayer(id);
      } catch {}
    }
  }

  if (map.getSource(sourceId)) {
    try {
      map.removeSource(sourceId);
    } catch {}
  }
}

/**
 * Authoritative MapLibre Synchronizer for Nominal 375m VIIRS Footprint Squares
 */
export function syncFootprintSquaresToMap(map: MapLibreMap | any, data: GeoJSON.FeatureCollection | null): boolean {
  if (!map) return false;

  const styleReady = Boolean(
    map.style &&
    ((map.style as any)._loaded || (typeof map.isStyleLoaded === "function" && map.isStyleLoaded()))
  );

  if (!styleReady) {
    map.once("styledata", () => syncFootprintSquaresToMap(map, data));
    return false;
  }

  const sourceId = "footprint-squares-source";
  const emptyFc: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
  const activeData = data && data.features ? data : emptyFc;

  const existingSource = map.getSource(sourceId);
  if (existingSource) {
    if (typeof existingSource.setData === "function") {
      try {
        existingSource.setData(activeData);
      } catch (e) {
        console.warn("[FootprintSquares] Failed setData:", e);
      }
    }
  } else {
    try {
      map.addSource(sourceId, {
        type: "geojson",
        data: activeData,
      });
    } catch (e) {
      console.warn("[FootprintSquares] Failed addSource:", e);
    }
  }

  if (!map.getLayer("footprint-squares-fill")) {
    try {
      map.addLayer({
        id: "footprint-squares-fill",
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": "#22c55e",
          "fill-opacity": 0.22,
        },
      });
    } catch (e) {
      console.warn("[FootprintSquares] Failed addLayer fill:", e);
    }
  }

  if (!map.getLayer("footprint-squares-outline")) {
    try {
      map.addLayer({
        id: "footprint-squares-outline",
        type: "line",
        source: sourceId,
        paint: {
          "line-color": "#4ade80",
          "line-width": 2,
          "line-opacity": 0.95,
        },
      });
    } catch (e) {
      console.warn("[FootprintSquares] Failed addLayer outline:", e);
    }
  }

  return true;
}
