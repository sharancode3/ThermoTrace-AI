"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { fetchEventWind, fetchFacilityWind, WindData } from "@/lib/apiClient";

export type TargetWindStatus =
  | "IDLE"
  | "LOADING"
  | "AVAILABLE"
  | "STALE"
  | "LIGHT_VARIABLE_WIND"
  | "UNAVAILABLE"
  | "NOT_FOUND";

export interface UseTargetWindResult {
  wind: WindData | null;
  status: TargetWindStatus;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useTargetWind(
  targetType: "event" | "facility" | null,
  targetId: string | null,
  targetCoords?: { latitude?: number; longitude?: number },
  timestamp?: string
): UseTargetWindResult {
  const [wind, setWind] = useState<WindData | null>(null);
  const [status, setStatus] = useState<TargetWindStatus>("IDLE");
  const [error, setError] = useState<string | null>(null);
  const sequenceRef = useRef(0);

  const fetchWind = useCallback(() => {
    if (!targetType || !targetId) {
      setWind(null);
      setStatus("IDLE");
      setError(null);
      return;
    }

    const currentSequence = ++sequenceRef.current;
    setStatus("LOADING");
    setError(null);

    const promise =
      targetType === "facility"
        ? fetchFacilityWind(targetId, {
            latitude: targetCoords?.latitude,
            longitude: targetCoords?.longitude,
            timestamp,
          })
        : fetchEventWind(targetId, {
            latitude: targetCoords?.latitude,
            longitude: targetCoords?.longitude,
            timestamp,
          });

    promise
      .then((res) => {
        if (sequenceRef.current !== currentSequence) return;

        if (res.available) {
          setWind(res);
          if (res.status === "LIGHT_VARIABLE_WIND") {
            setStatus("LIGHT_VARIABLE_WIND");
          } else if (res.stale || res.status === "STALE") {
            setStatus("STALE");
          } else {
            setStatus("AVAILABLE");
          }
        } else {
          setWind(res);
          if (res.status === "EVENT_NOT_FOUND" || res.status === "FACILITY_NOT_FOUND") {
            setStatus("NOT_FOUND");
          } else {
            setStatus("UNAVAILABLE");
          }
        }
      })
      .catch((err) => {
        if (sequenceRef.current !== currentSequence) return;
        const errMsg = err instanceof Error ? err.message : "Weather provider error";
        setError(errMsg);
        setStatus("UNAVAILABLE");
        setWind({
          available: false,
          status: "WIND_DATA_UNAVAILABLE",
          reason: errMsg,
          target_type: targetType === "facility" ? "FACILITY" : "EVENT",
          target_id: targetId,
        });
      });
  }, [targetType, targetId, targetCoords?.latitude, targetCoords?.longitude, timestamp]);

  useEffect(() => {
    fetchWind();
    return () => {
      sequenceRef.current++;
    };
  }, [fetchWind]);

  return {
    wind,
    status,
    isLoading: status === "LOADING",
    error,
    refetch: fetchWind,
  };
}
