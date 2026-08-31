"use client";

import { useEffect, useRef } from "react";

/**
 * Foreground-Triggered Polling Hook for NASA FIRMS Telemetry.
 * Active ONLY when the browser tab/window is active and visible.
 * Triggers initial poll on mount to recover any gap while app was closed,
 * then polls at a 2-minute (120,000ms) cadence.
 */
export function useFirmsPoller(onNewData?: () => void) {
  const isPollingRef = useRef<boolean>(false);

  const executePoll = async (force: boolean = false) => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;
    try {
      const resp = await fetch(`/api/v1/ingest/poll${force ? '?force=true' : ''}`, {
        method: "POST",
      });
      if (resp.ok) {
        const result = await resp.json();
        if (result.inserted_count > 0 && onNewData) {
          onNewData();
        }
      }
    } catch (err) {
      console.warn("Foreground FIRMS poll skipped:", err);
    } finally {
      isPollingRef.current = false;
    }
  };

  useEffect(() => {
    // 1. Initial poll on application mount
    executePoll();

    // 2. 2-minute foreground cadence
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        executePoll();
      }
    }, 120000);

    // 3. Tab visibility change listener: poll immediately when user returns to tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        executePoll();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}
