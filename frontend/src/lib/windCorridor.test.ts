import assert from "node:assert";
import {
  computeTowardDegrees,
  normalizeWindDegrees,
  buildAwarenessCorridorGeoJson,
  destinationPoint,
  buildArrowheadPolygon,
  MIN_VISIBLE_REACH_M,
  MAX_DISPLAY_REACH_KM,
} from "./corridorGeometry";
import { syncWindCorridorToMap, removeWindCorridorFromMap, syncFootprintSquaresToMap } from "./windLayerHelper";

console.log("==================================================");
console.log("ThermoTrace AI - Wind Visualization Test Suite");
console.log("==================================================\n");

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// 1. DIRECTION TESTS
// ---------------------------------------------------------------------------
console.log("1. Running Direction Tests...");

test("From 0° produces toward 180°", () => {
  assert.strictEqual(computeTowardDegrees(0), 180);
});

test("From 90° produces toward 270°", () => {
  assert.strictEqual(computeTowardDegrees(90), 270);
});

test("From 180° produces toward 0°", () => {
  assert.strictEqual(computeTowardDegrees(180), 0);
});

test("From 219° produces toward 39° (SW to NE event test)", () => {
  assert.strictEqual(computeTowardDegrees(219), 39);
});

test("From 359° produces toward 179°", () => {
  assert.strictEqual(computeTowardDegrees(359), 179);
});

test("A valid 0° bearing is not treated as missing", () => {
  assert.strictEqual(normalizeWindDegrees(0), 0);
  assert.strictEqual(Number.isFinite(normalizeWindDegrees(0)), true);
  const toward = computeTowardDegrees(0);
  assert.strictEqual(toward, 180);
  assert.strictEqual(Number.isFinite(toward), true);
});

// ---------------------------------------------------------------------------
// 2. GEOMETRY TESTS
// ---------------------------------------------------------------------------
console.log("\n2. Running Geometry Tests...");

const testOrigin = { lon: 82.15, lat: 21.75 };
const testWind4kmh = {
  longitude: testOrigin.lon,
  latitude: testOrigin.lat,
  towardDeg: 39,
  speedKmh: 4,
  gustsKmh: null,
};

test("Polygon starts and ends at the correct event origin", () => {
  const result = buildAwarenessCorridorGeoJson(testWind4kmh);
  const ring = result.sectorPolygon.geometry.coordinates[0];
  assert.ok(ring.length >= 10, "Should have enough arc points");
  assert.deepStrictEqual(ring[0], [testOrigin.lon, testOrigin.lat]);
  assert.deepStrictEqual(ring[ring.length - 1], [testOrigin.lon, testOrigin.lat]);
});

test("Polygon ring is closed", () => {
  const result = buildAwarenessCorridorGeoJson(testWind4kmh);
  const ring = result.sectorPolygon.geometry.coordinates[0];
  const first = ring[0];
  const last = ring[ring.length - 1];
  assert.strictEqual(first[0], last[0]);
  assert.strictEqual(first[1], last[1]);
});

test("All coordinates are finite numbers", () => {
  const result = buildAwarenessCorridorGeoJson(testWind4kmh);
  for (const feature of result.featureCollection.features) {
    if (feature.geometry.type === "Polygon") {
      for (const ring of (feature.geometry as any).coordinates) {
        for (const pt of ring) {
          assert.ok(Number.isFinite(pt[0]), `lon must be finite: ${pt[0]}`);
          assert.ok(Number.isFinite(pt[1]), `lat must be finite: ${pt[1]}`);
        }
      }
    } else if (feature.geometry.type === "LineString") {
      for (const pt of (feature.geometry as any).coordinates) {
        assert.ok(Number.isFinite(pt[0]), `lon must be finite: ${pt[0]}`);
        assert.ok(Number.isFinite(pt[1]), `lat must be finite: ${pt[1]}`);
      }
    }
  }
});

test("The centerline follows the downwind bearing", () => {
  const result = buildAwarenessCorridorGeoJson(testWind4kmh);
  const coords = result.centerline.geometry.coordinates;
  assert.deepStrictEqual(coords[0], [testOrigin.lon, testOrigin.lat]);
  // Expected end along bearing 39
  const expectedEnd = destinationPoint(testOrigin.lon, testOrigin.lat, result.reachMeters * 0.96, 39);
  assert.strictEqual(coords[1][0], expectedEnd[0]);
  assert.strictEqual(coords[1][1], expectedEnd[1]);
  // Check that coordinate moves North and East (positive delta)
  assert.ok(coords[1][0] > testOrigin.lon, "Centerline end must have greater longitude (East)");
  assert.ok(coords[1][1] > testOrigin.lat, "Centerline end must have greater latitude (North)");
});

test("A 4 km/h wind creates an approximately 4 km 60-minute corridor before display limits", () => {
  const result = buildAwarenessCorridorGeoJson(testWind4kmh);
  assert.strictEqual(result.reachKm, 4.0);
  assert.strictEqual(result.reachMeters, 4000);
  assert.strictEqual(result.isCapped, false);
});

test("Sector points fall within configured angular range (22° half-angle)", () => {
  const result = buildAwarenessCorridorGeoJson(testWind4kmh);
  assert.strictEqual(result.sectorPolygon.properties?.half_angle_deg, 22.0);
  // Outer arc points: between (39 - 22) = 17° and (39 + 22) = 61°
  const ring = result.sectorPolygon.geometry.coordinates[0];
  // First outer point is index 1
  const ptLeft = ring[1];
  const expectedLeft = destinationPoint(testOrigin.lon, testOrigin.lat, 4000, 17);
  assert.deepStrictEqual(ptLeft, expectedLeft);
  // Last outer point is index ring.length - 2
  const ptRight = ring[ring.length - 2];
  const expectedRight = destinationPoint(testOrigin.lon, testOrigin.lat, 4000, 61);
  assert.deepStrictEqual(ptRight, expectedRight);
});

test("Main and embedded maps receive identical geometry", () => {
  const mainMapGeo = buildAwarenessCorridorGeoJson(testWind4kmh);
  const embeddedMapGeo = buildAwarenessCorridorGeoJson(testWind4kmh);
  assert.deepStrictEqual(mainMapGeo.featureCollection, embeddedMapGeo.featureCollection);
  assert.deepStrictEqual(mainMapGeo.bounds, embeddedMapGeo.bounds);
  assert.strictEqual(mainMapGeo.reachKm, embeddedMapGeo.reachKm);
});

test("Arrowhead polygon generates closed chevron oriented downwind", () => {
  const arrow = buildArrowheadPolygon(testOrigin.lon, testOrigin.lat, 4000, 39);
  assert.strictEqual(arrow.length, 5, "Arrowhead must have 5 points (closed chevron)");
  assert.deepStrictEqual(arrow[0], arrow[4], "Arrowhead must be closed");
  // Tip is furthest out at 98% reach along 39°
  const expectedTip = destinationPoint(testOrigin.lon, testOrigin.lat, 4000 * 0.98, 39);
  assert.deepStrictEqual(arrow[0], expectedTip);
  assert.ok(arrow[0][0] > testOrigin.lon && arrow[0][1] > testOrigin.lat, "Tip must point Northeast");
});

test("Low wind (1-3 km/h) creates shorter, wider sector labeled 'Low wind — direction less certain'", () => {
  const lowWind2kmh = buildAwarenessCorridorGeoJson({
    ...testWind4kmh,
    speedKmh: 2.0,
  });
  assert.strictEqual(lowWind2kmh.isLightVariable, true);
  assert.strictEqual(lowWind2kmh.reachKm, 2.0, "2.0 km/h creates 2.0 km reach");
  assert.strictEqual(lowWind2kmh.sectorPolygon.properties?.notice, "Low wind — direction less certain");
  assert.strictEqual(lowWind2kmh.sectorPolygon.properties?.half_angle_deg, 35.0, "Half angle widened to 35°");

  // Also test minimum visible reach clamping for 1.2 km/h (< 1.5 km)
  const lowWind1_2kmh = buildAwarenessCorridorGeoJson({
    ...testWind4kmh,
    speedKmh: 1.2,
  });
  assert.strictEqual(lowWind1_2kmh.reachKm, 1.5, "1.2 km/h clamped up to 1.5 km minimum visible reach");
});

test("Calm wind (< 1 km/h) creates subtle circular uncertainty area without misleading narrow cone", () => {
  const calmResult = buildAwarenessCorridorGeoJson({
    ...testWind4kmh,
    speedKmh: 0.5,
  });
  assert.strictEqual(calmResult.isLightVariable, true);
  assert.strictEqual(calmResult.radialUncertainty !== null, true);
  assert.strictEqual(calmResult.arrowhead, null, "Calm wind must not display misleading directional arrow");
  const ring = calmResult.sectorPolygon.geometry.coordinates[0];
  assert.ok(ring.length >= 24, "Should be circular polygon");
});

// ---------------------------------------------------------------------------
// 3. MAPLIBRE LIFECYCLE TESTS
// ---------------------------------------------------------------------------
console.log("\n3. Running Lifecycle Tests...");

function createMockMap(isLoaded = true) {
  const sources: Record<string, any> = {};
  const layers: Record<string, any> = {};
  const listeners: Record<string, ((...args: any[]) => void)[]> = {};

  return {
    style: { _loaded: isLoaded },
    isStyleLoaded: () => isLoaded,
    getSource(id: string) {
      return sources[id] || null;
    },
    addSource(id: string, def: any) {
      if (sources[id]) throw new Error(`Source ${id} already exists`);
      sources[id] = {
        ...def,
        setData: (newData: any) => {
          sources[id].data = newData;
        },
      };
    },
    removeSource(id: string) {
      delete sources[id];
    },
    getLayer(id: string) {
      return layers[id] || null;
    },
    addLayer(def: any) {
      if (layers[def.id]) throw new Error(`Layer ${def.id} already exists`);
      layers[def.id] = { ...def, layout: { visibility: "visible" } };
    },
    removeLayer(id: string) {
      delete layers[id];
    },
    setPaintProperty(id: string, prop: string, val: any) {
      if (!layers[id]) throw new Error(`Layer ${id} not found`);
      layers[id].paint = layers[id].paint || {};
      layers[id].paint[prop] = val;
    },
    setLayoutProperty(id: string, prop: string, val: any) {
      if (!layers[id]) throw new Error(`Layer ${id} not found`);
      layers[id].layout = layers[id].layout || {};
      layers[id].layout[prop] = val;
    },
    on(event: string, fn: any) {
      listeners[event] = listeners[event] || [];
      listeners[event].push(fn);
    },
    off(event: string, fn: any) {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((f) => f !== fn);
      }
    },
    once(event: string, fn: any) {
      const wrapper = (...args: any[]) => {
        this.off(event, wrapper);
        fn(...args);
      };
      this.on(event, wrapper);
    },
    trigger(event: string, ...args: any[]) {
      (listeners[event] || []).forEach((fn) => fn(...args));
    },
    _sources: sources,
    _layers: layers,
  };
}

test("Wind layers are added after style load", () => {
  const map = createMockMap(true);
  const geo = buildAwarenessCorridorGeoJson(testWind4kmh);

  const synced = syncWindCorridorToMap({
    map,
    sourceId: "test-wind-source",
    layerPrefix: "test-wind",
    corridorResult: geo,
    isSatellite: false,
    visible: true,
  });

  assert.strictEqual(synced, true);
  assert.ok(map._sources["test-wind-source-fill"], "Fill source must exist");
  assert.ok(map._sources["test-wind-source-outline"], "Outline source must exist");
  assert.ok(map._sources["test-wind-source-centerline"], "Centerline source must exist");
  assert.ok(map._sources["test-wind-source-arrow"], "Arrow source must exist");
  assert.ok(map._layers["test-wind-fill"], "Fill layer must exist");
  assert.ok(map._layers["test-wind-outline"], "Outline layer must exist");
  assert.ok(map._layers["test-wind-centerline"], "Centerline layer must exist");
  assert.ok(map._layers["test-wind-arrow-fill"], "Arrow fill layer must exist");
  assert.ok(map._layers["test-wind-arrow-outline"], "Arrow outline layer must exist");
});

test("Existing sources use setData on update without throwing", () => {
  const map = createMockMap(true);
  const geo1 = buildAwarenessCorridorGeoJson(testWind4kmh);

  syncWindCorridorToMap({
    map,
    sourceId: "test-wind-source",
    layerPrefix: "test-wind",
    corridorResult: geo1,
    isSatellite: false,
    visible: true,
  });

  // Second call with different wind
  const geo2 = buildAwarenessCorridorGeoJson({
    ...testWind4kmh,
    towardDeg: 270,
    speedKmh: 10,
  });

  assert.doesNotThrow(() => {
    syncWindCorridorToMap({
      map,
      sourceId: "test-wind-source",
      layerPrefix: "test-wind",
      corridorResult: geo2,
      isSatellite: false,
      visible: true,
    });
  });

  assert.deepStrictEqual(map._sources["test-wind-source-fill"].data, geo2.sectorPolygon);
});

test("Map rerenders do not create duplicate layers", () => {
  const map = createMockMap(true);
  const geo = buildAwarenessCorridorGeoJson(testWind4kmh);

  for (let i = 0; i < 5; i++) {
    syncWindCorridorToMap({
      map,
      sourceId: "test-wind-source",
      layerPrefix: "test-wind",
      corridorResult: geo,
      isSatellite: false,
      visible: true,
    });
  }

  // Count total layers with prefix
  const layerKeys = Object.keys(map._layers).filter((k) => k.startsWith("test-wind"));
  assert.strictEqual(layerKeys.length, 6, "Should have exactly 6 unique layers, no duplicates");
});

test("Roadmap/Satellite switching updates layer paint properties", () => {
  const map = createMockMap(true);
  const geo = buildAwarenessCorridorGeoJson(testWind4kmh);

  // 1. Roadmap
  syncWindCorridorToMap({
    map,
    sourceId: "test-wind-source",
    layerPrefix: "test-wind",
    corridorResult: geo,
    isSatellite: false,
    visible: true,
  });
  assert.strictEqual(map._layers["test-wind-fill"].paint["fill-opacity"], 0.24);

  // 2. Switch to Satellite
  syncWindCorridorToMap({
    map,
    sourceId: "test-wind-source",
    layerPrefix: "test-wind",
    corridorResult: geo,
    isSatellite: true,
    visible: true,
  });
  assert.strictEqual(map._layers["test-wind-fill"].paint["fill-opacity"], 0.32);
});

test("The wind-vector toggle hides and restores the fill, outline, centerline, and arrow together", () => {
  const map = createMockMap(true);
  const geo = buildAwarenessCorridorGeoJson(testWind4kmh);

  syncWindCorridorToMap({
    map,
    sourceId: "test-wind-source",
    layerPrefix: "test-wind",
    corridorResult: geo,
    isSatellite: false,
    visible: true,
  });

  // Toggle off
  syncWindCorridorToMap({
    map,
    sourceId: "test-wind-source",
    layerPrefix: "test-wind",
    corridorResult: geo,
    isSatellite: false,
    visible: false,
  });

  assert.strictEqual(map._layers["test-wind-fill"].layout.visibility, "none");
  assert.strictEqual(map._layers["test-wind-outline"].layout.visibility, "none");
  assert.strictEqual(map._layers["test-wind-centerline"].layout.visibility, "none");
  assert.strictEqual(map._layers["test-wind-arrow-fill"].layout.visibility, "none");
  assert.strictEqual(map._sources["test-wind-source-fill"].data.features.length, 0);

  // Toggle back on
  syncWindCorridorToMap({
    map,
    sourceId: "test-wind-source",
    layerPrefix: "test-wind",
    corridorResult: geo,
    isSatellite: false,
    visible: true,
  });

  assert.strictEqual(map._layers["test-wind-fill"].layout.visibility, "visible");
  assert.strictEqual(map._layers["test-wind-outline"].layout.visibility, "visible");
  assert.strictEqual(map._layers["test-wind-centerline"].layout.visibility, "visible");
  assert.strictEqual(map._layers["test-wind-arrow-fill"].layout.visibility, "visible");
  assert.ok(map._sources["test-wind-source-fill"].data.geometry);
});

test("Closing an event clears the source and removeWindCorridorFromMap cleans up", () => {
  const map = createMockMap(true);
  const geo = buildAwarenessCorridorGeoJson(testWind4kmh);

  syncWindCorridorToMap({
    map,
    sourceId: "test-wind-source",
    layerPrefix: "test-wind",
    featureCollection: geo.featureCollection,
    isSatellite: false,
    visible: true,
  });

  removeWindCorridorFromMap(map, "test-wind-source", "test-wind");

  assert.strictEqual(map._sources["test-wind-source"], undefined);
  assert.strictEqual(map._layers["test-wind-fill"], undefined);
  assert.strictEqual(map._layers["test-wind-centerline"], undefined);
  assert.strictEqual(map._layers["test-wind-arrow-fill"], undefined);
});

test("syncFootprintSquaresToMap creates footprint fill and outline layers", () => {
  const map = createMockMap(true);
  const mockFootprints: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [82.14, 21.74],
              [82.16, 21.74],
              [82.16, 21.76],
              [82.14, 21.76],
              [82.14, 21.74],
            ],
          ],
        },
        properties: { frp: 12 },
      },
    ],
  };

  syncFootprintSquaresToMap(map, mockFootprints);
  assert.ok(map._sources["footprint-squares-source"]);
  assert.ok(map._layers["footprint-squares-fill"]);
  assert.ok(map._layers["footprint-squares-outline"]);
  assert.strictEqual(map._layers["footprint-squares-fill"].paint["fill-color"], "#22c55e");
});

console.log(`\n==================================================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`==================================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log("ALL TESTS PASSED SUCCESSFULLY! ✓");
}
