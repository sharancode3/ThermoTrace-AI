import uuid
import numpy as np
from datetime import datetime
from typing import List, Dict, Any
from shapely.geometry import Point, MultiPoint, Polygon

def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate haversine distance between two points in meters."""
    R = 6371000.0  # Earth radius in meters
    phi1, phi2 = np.radians(lat1), np.radians(lat2)
    dphi = np.radians(lat2 - lat1)
    dlambda = np.radians(lon2 - lon1)
    a = np.sin(dphi/2.0)**2 + np.cos(phi1) * np.cos(phi2) * np.sin(dlambda/2.0)**2
    return float(2 * R * np.arctan2(np.sqrt(a), np.sqrt(1 - a)))

def run_st_dbscan(
    observations: List[Dict[str, Any]],
    eps_spatial_m: float = 750.0,
    eps_temporal_hours: float = 12.0,
    min_pts: int = 1
) -> List[List[Dict[str, Any]]]:
    """
    ST-DBSCAN algorithm for Spatio-Temporal Event Formation.
    Deterministic clustering based on spatial (750m) and temporal (12h) thresholds.
    """
    n = len(observations)
    if n == 0:
        return []

    times = np.array([obs['observation_timestamp_utc'].timestamp() for obs in observations])
    lats = np.array([float(obs['latitude']) for obs in observations])
    lons = np.array([float(obs['longitude']) for obs in observations])

    eps_temporal_sec = eps_temporal_hours * 3600.0
    visited = np.zeros(n, dtype=bool)
    clusters = []

    for i in range(n):
        if visited[i]:
            continue

        time_diffs = np.abs(times - times[i])
        time_mask = time_diffs <= eps_temporal_sec

        neighbors = []
        for j in np.where(time_mask)[0]:
            dist = haversine_distance_meters(lats[i], lons[i], lats[j], lons[j])
            if dist <= eps_spatial_m:
                neighbors.append(j)

        if len(neighbors) < min_pts:
            continue

        visited[i] = True
        cluster_indices = set(neighbors)
        queue = list(neighbors)

        while queue:
            curr = queue.pop(0)
            if not visited[curr]:
                visited[curr] = True
                c_time_diffs = np.abs(times - times[curr])
                c_time_mask = c_time_diffs <= eps_temporal_sec
                c_neighbors = []
                for k in np.where(c_time_mask)[0]:
                    if haversine_distance_meters(lats[curr], lons[curr], lats[k], lons[k]) <= eps_spatial_m:
                        c_neighbors.append(k)

                if len(c_neighbors) >= min_pts:
                    for k in c_neighbors:
                        if k not in cluster_indices:
                            cluster_indices.add(k)
                            queue.append(k)

        cluster_obs = [observations[idx] for idx in sorted(cluster_indices, key=lambda x: times[x])]
        clusters.append(cluster_obs)

    return clusters

def compute_event_metrics(cluster_obs: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Computes FRP-weighted centroid, bounding geometry, area in Ha, peak/mean/aggregate FRP.
    Single observation -> 375m buffer in degrees (~0.0033 deg).
    Multiple observations -> Convex Hull envelope.
    """
    n_hits = len(cluster_obs)
    frps = np.array([float(obs['frp_mw']) for obs in cluster_obs])
    temps = np.array([float(obs['brightness_temp_k']) for obs in cluster_obs])
    lats = np.array([float(obs['latitude']) for obs in cluster_obs])
    lons = np.array([float(obs['longitude']) for obs in cluster_obs])
    timestamps = [obs['observation_timestamp_utc'] for obs in cluster_obs]

    # FRP-weighted Centroid
    total_frp = float(np.sum(frps))
    if total_frp > 0:
        c_lat = float(np.sum(lats * frps) / total_frp)
        c_lon = float(np.sum(lons * frps) / total_frp)
    else:
        c_lat = float(np.mean(lats))
        c_lon = float(np.mean(lons))

    # Single vs Multi geometry
    if n_hits == 1:
        # Buffer approx 375m in degrees (1 deg ~ 111,320m)
        deg_buffer = 375.0 / 111320.0
        boundary_geom = Point(lons[0], lats[0]).buffer(deg_buffer)
        area_ha = 44.18  # pi * (0.375)^2 km2 = 0.4418 km2 = 44.18 Ha
    else:
        pts = [Point(lon, lat) for lon, lat in zip(lons, lats)]
        multi_pt = MultiPoint(pts)
        hull = multi_pt.convex_hull
        if hull.geom_type == 'Point':
            boundary_geom = hull.buffer(375.0 / 111320.0)
            area_ha = 44.18
        elif hull.geom_type == 'LineString':
            boundary_geom = hull.buffer(375.0 / 111320.0)
            # approximate area
            area_ha = float(hull.length * 111.32 * 0.75 * 100.0)
        else:
            boundary_geom = hull
            # Area in Ha: degrees^2 * (111.32 km/deg * cos(lat) * 111.32 km/deg) * 100 Ha/km2
            cos_lat = np.cos(np.radians(c_lat))
            area_km2 = hull.area * (111.32 * cos_lat) * 111.32
            area_ha = float(area_km2 * 100.0)

    first_dt = min(timestamps)
    latest_dt = max(timestamps)
    duration_h = float((latest_dt - first_dt).total_seconds() / 3600.0)

    return {
        "centroid_lat": c_lat,
        "centroid_lon": c_lon,
        "boundary_wkt": boundary_geom.wkt,
        "bounding_area_ha": max(area_ha, 0.1),
        "first_detected_utc": first_dt,
        "latest_detected_utc": latest_dt,
        "duration_hours": duration_h,
        "observation_count": n_hits,
        "peak_frp_mw": float(np.max(frps)),
        "mean_frp_mw": float(np.mean(frps)),
        "aggregate_frp_mw": total_frp,
        "max_brightness_k": float(np.max(temps))
    }
