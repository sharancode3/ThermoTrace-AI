"use client";

import { useEffect, useRef } from "react";

/**
 * Foreground-Triggered Polling Hook for NASA FIRMS Telemetry.
 * Active ONLY when the browser tab/window is active and visible.
 * Triggers poll strictly every 5 minutes (300,000ms).
 */
export function useFirmsPoller(onNewData?: () => void) {
  const isPollingRef = useRef<boolean>(false);
  const lastPollTimeRef = useRef<number>(0);

  const executePoll = async (force: boolean = false) => {
    const now = Date.now();
    // Guard: Prevent polling more than once per 5 minutes (300,000 ms) unless explicitly forced
    if (!force && lastPollTimeRef.current > 0 && (now - lastPollTimeRef.current) < 300000) {
      return;
    }

    if (isPollingRef.current) return;
    isPollingRef.current = true;
    lastPollTimeRef.current = now;

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
    // 1. Initial check on mount
    executePoll();

    // 2. Strict 5-minute foreground interval
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        executePoll();
      }
    }, 300000);

    return () => {
      clearInterval(interval);
    };
  }, []);
}
