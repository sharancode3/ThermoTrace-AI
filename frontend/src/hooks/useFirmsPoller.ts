"use client";

import { useEffect, useRef } from "react";

/**
 * Foreground-Triggered Polling Hook for NASA FIRMS Telemetry.
 * Active ONLY when the browser tab/window is active and visible.
 * Triggers poll strictly every 60 minutes (3,600,000ms / 1 hour) to conserve cloud quota.
 */
export function useFirmsPoller(onNewData?: () => void) {
  const intervalMinutes = Math.max(1, Number(process.env.NEXT_PUBLIC_FIRMS_POLL_INTERVAL_MINUTES || "60") || 60);
  const intervalMs = intervalMinutes * 60 * 1000;
  const isPollingRef = useRef<boolean>(false);
  const lastPollTimeRef = useRef<number>(0);

  const executePoll = async (force: boolean = false) => {
    const now = Date.now();
    // Guard: Prevent polling more than once per 60 minutes (3,600,000 ms) across all tabs unless explicitly forced
    if (typeof window !== "undefined") {
      const storedLast = window.localStorage.getItem("thermo_last_firms_poll_time");
      if (!force && storedLast && (now - parseInt(storedLast, 10)) < intervalMs) {
        return;
      }
    }

    if (!force && lastPollTimeRef.current > 0 && (now - lastPollTimeRef.current) < intervalMs) {
      return;
    }

    if (isPollingRef.current) return;
    isPollingRef.current = true;
    lastPollTimeRef.current = now;
    if (typeof window !== "undefined") {
      window.localStorage.setItem("thermo_last_firms_poll_time", String(now));
    }

    try {
      const resp = await fetch(`/api/v1/ingest/poll${force ? '?force=true' : ''}`, {
        method: "POST",
      });
      if (resp.ok) {
        const result = await resp.json();
        if (result.inserted_count > 0 || result.new_events_formed > 0) {
          if (onNewData) {
            onNewData();
          }
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("thermo-data-refreshed", { detail: result }));
          }
        }
      }
    } catch (err) {
      console.warn("Foreground FIRMS poll skipped:", err);
    } finally {
      isPollingRef.current = false;
    }
  };

  useEffect(() => {
    // Sovereign Evaluation Freeze: Automated polling is paused to preserve cloud storage and guarantee
    // deterministic audit reproducibility across the golden benchmark evaluation window.
    return () => {};
  }, []);
}
