/**
 * Offline-First IndexedDB Delta Cache for Thermal Events.
 * Persists thermal events across reloads and tab navigations.
 * Enables incremental syncing (downloading ONLY new events instead of the full dataset).
 */
import { GeoCollection, GeoFeature, EventFilters, Viewport } from "./apiClient";

const DB_NAME = "thermotrace_local_store";
const DB_VERSION = 1;
const EVENTS_STORE = "events";
const META_STORE = "meta";

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memoryStore = new Map<string, GeoFeature>();
let memoryLastSyncUtc: string | null = null;
let memoryLastSyncTime: number = 0;

function getDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(EVENTS_STORE)) {
            db.createObjectStore(EVENTS_STORE, { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains(META_STORE)) {
            db.createObjectStore(META_STORE, { keyPath: "key" });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          console.warn("[DeltaCache] IndexedDB open failed, using memory fallback");
          resolve(null);
        };
      } catch (err) {
        console.warn("[DeltaCache] IndexedDB exception:", err);
        resolve(null);
      }
    });
  }
  return dbPromise;
}

export async function getLastSyncUtc(): Promise<string | null> {
  const db = await getDb();
  if (!db) return memoryLastSyncUtc;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(META_STORE, "readonly");
      const store = tx.objectStore(META_STORE);
      const req = store.get("last_sync_utc");
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => resolve(memoryLastSyncUtc);
    } catch {
      resolve(memoryLastSyncUtc);
    }
  });
}

export async function getLastSyncTime(): Promise<number> {
  const db = await getDb();
  if (!db) return memoryLastSyncTime;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(META_STORE, "readonly");
      const store = tx.objectStore(META_STORE);
      const req = store.get("last_sync_time");
      req.onsuccess = () => resolve(req.result ? req.result.value : 0);
      req.onerror = () => resolve(memoryLastSyncTime);
    } catch {
      resolve(memoryLastSyncTime);
    }
  });
}

export async function setLastSyncMeta(timestampUtc: string | null, unixTime: number): Promise<void> {
  if (timestampUtc) memoryLastSyncUtc = timestampUtc;
  memoryLastSyncTime = unixTime;

  const db = await getDb();
  if (!db) return;

  try {
    const tx = db.transaction(META_STORE, "readwrite");
    const store = tx.objectStore(META_STORE);
    if (timestampUtc) {
      store.put({ key: "last_sync_utc", value: timestampUtc });
    }
    store.put({ key: "last_sync_time", value: unixTime });
  } catch (err) {
    console.warn("[DeltaCache] Failed to store metadata:", err);
  }
}

export async function getAllCachedFeatures(): Promise<GeoFeature[]> {
  const db = await getDb();
  if (!db) {
    return Array.from(memoryStore.values());
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(EVENTS_STORE, "readonly");
      const store = tx.objectStore(EVENTS_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const records = (req.result || []) as Array<{ id: string; feature: GeoFeature }>;
        if (records.length > 0) {
          records.forEach((r) => memoryStore.set(r.id, r.feature));
          resolve(records.map((r) => r.feature));
        } else {
          resolve(Array.from(memoryStore.values()));
        }
      };
      req.onerror = () => resolve(Array.from(memoryStore.values()));
    } catch {
      resolve(Array.from(memoryStore.values()));
    }
  });
}

export async function deleteFeaturesFromCache(eventIds: string[]): Promise<void> {
  if (!eventIds || eventIds.length === 0) return;
  eventIds.forEach((id) => memoryStore.delete(id));

  const db = await getDb();
  if (!db) return;

  try {
    const tx = db.transaction(EVENTS_STORE, "readwrite");
    const store = tx.objectStore(EVENTS_STORE);
    eventIds.forEach((id) => store.delete(id));
  } catch (err) {
    console.warn("[DeltaCache] Failed to delete features from IndexedDB:", err);
  }
}

export async function pruneStaleFeatures(retentionDays: number = 30): Promise<number> {
  const cutoff = Date.now() - retentionDays * 24 * 3600 * 1000;
  const idsToDelete: string[] = [];

  memoryStore.forEach((feature, id) => {
    const ts = feature.properties?.latest_detected_utc;
    if (ts && new Date(ts).getTime() < cutoff) {
      idsToDelete.push(id);
    }
  });

  if (idsToDelete.length > 0) {
    await deleteFeaturesFromCache(idsToDelete);
  }

  return idsToDelete.length;
}

export async function saveFeaturesToCache(features: GeoFeature[]): Promise<void> {
  if (!features || features.length === 0) return;

  let newestTs = memoryLastSyncUtc;

  // 1. Update / Insert features in memory store
  features.forEach((f) => {
    const id = f.properties?.event_id || (f as any).id || `${f.geometry.coordinates[0]}_${f.geometry.coordinates[1]}`;
    memoryStore.set(id, f);

    const ts = f.properties?.latest_detected_utc;
    if (ts && (!newestTs || new Date(ts) > new Date(newestTs))) {
      newestTs = ts;
    }
  });

  await setLastSyncMeta(newestTs, Date.now());

  const db = await getDb();
  if (!db) return;

  try {
    const tx = db.transaction(EVENTS_STORE, "readwrite");
    const store = tx.objectStore(EVENTS_STORE);
    features.forEach((f) => {
      const id = f.properties?.event_id || (f as any).id || `${f.geometry.coordinates[0]}_${f.geometry.coordinates[1]}`;
      store.put({ id, feature: f });
    });
  } catch (err) {
    console.warn("[DeltaCache] Failed to save features to IndexedDB:", err);
  }

  // 2. Automatically prune old events outside the 30-day active application retention window
  void pruneStaleFeatures(30);
}

export async function clearEventCache(): Promise<void> {
  memoryStore.clear();
  memoryLastSyncUtc = null;
  memoryLastSyncTime = 0;
  const db = await getDb();
  if (!db) return;

  try {
    const tx = db.transaction([EVENTS_STORE, META_STORE], "readwrite");
    tx.objectStore(EVENTS_STORE).clear();
    tx.objectStore(META_STORE).clear();
  } catch (err) {
    console.warn("[DeltaCache] Failed to clear IndexedDB:", err);
  }
}

/**
 * Filter cached features locally in memory according to active viewport and filters.
 * Runs in microseconds, 100% offline, 0 bytes network transfer.
 */
export function filterCachedFeatures(
  features: GeoFeature[],
  viewport?: Viewport,
  filters: EventFilters = {}
): GeoCollection {
  let filtered = features;

  if (filters.classification) {
    const cl = filters.classification.toUpperCase();
    if (cl === "INDUSTRY" || cl === "INDUSTRIAL") {
      filtered = filtered.filter((f) =>
        ["IND_ROUTINE", "IND_FLARE", "IND_FIRE"].includes(f.properties?.classification)
      );
    } else {
      filtered = filtered.filter((f) => f.properties?.classification === filters.classification);
    }
  }

  if (filters.anomaly_tier) {
    filtered = filtered.filter((f) => f.properties?.anomaly_tier === filters.anomaly_tier);
  }

  if (filters.hours) {
    const now = Date.now();
    const windowMs = filters.hours * 3600 * 1000;
    
    // Satellite Orbit Cadence Awareness:
    // Polar-orbiting satellites (VIIRS/MODIS) pass over India in periodic orbital cycles.
    // If the latest detected pass is outside the immediate rolling window (e.g. inter-orbit gap or deployment sync latency),
    // anchor to the latest satellite overpass timestamp so the map displays the active pass instead of an empty screen.
    let latestMs = 0;
    for (const f of filtered) {
      const ts = f.properties?.latest_detected_utc;
      if (ts) {
        const t = new Date(ts).getTime();
        if (t > latestMs) latestMs = t;
      }
    }

    let cutoff = now - windowMs;
    if (latestMs > 0 && (now - latestMs) > windowMs) {
      cutoff = latestMs - windowMs;
    }

    filtered = filtered.filter((f) => {
      const ts = f.properties?.latest_detected_utc;
      return ts ? new Date(ts).getTime() >= cutoff : true;
    });
  }

  if (filters.start_time) {
    const startMs = new Date(filters.start_time).getTime();
    filtered = filtered.filter((f) => {
      const ts = f.properties?.latest_detected_utc;
      return ts ? new Date(ts).getTime() >= startMs : true;
    });
  }

  if (filters.end_time) {
    const endMs = new Date(filters.end_time).getTime();
    filtered = filtered.filter((f) => {
      const ts = f.properties?.first_detected_utc;
      return ts ? new Date(ts).getTime() <= endMs : true;
    });
  }

  if (filters.focus_event_id) {
    const focused = features.find((f) => f.properties?.event_id === filters.focus_event_id);
    if (focused && !filtered.some((f) => f.properties?.event_id === filters.focus_event_id)) {
      filtered = [focused, ...filtered];
    }
  }

  return {
    type: "FeatureCollection",
    features: filtered,
  };
}
