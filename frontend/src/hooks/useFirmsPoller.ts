"use client";

import { useEffect, useRef } from "react";

/**
 * Foreground-Triggered Polling Hook for NASA FIRMS Telemetry.
 * Active ONLY when the browser tab/window is active and visible.
 * Triggers poll strictly every 30 minutes (1,800,000ms) to conserve cloud quota.
 */
export function useFirmsPoller(onNewData?: () => void) {
  const isPollingRef = useRef<boolean>(false);
  const lastPollTimeRef = useRef<number>(0);

  const executePoll = async (force: boolean = false) => {
    const now = Date.now();
    // Guard: Prevent polling more than once per 30 minutes (1,800,000 ms) across all tabs unless explicitly forced
    if (typeof window !== "undefined") {
      const storedLast = window.localStorage.getItem("thermo_last_firms_poll_time");
      if (!force && storedLast && (now - parseInt(storedLast, 10)) < 1800000) {
        return;
      }
    }

    if (!force && lastPollTimeRef.current > 0 && (now - lastPollTimeRef.current) < 1800000) {
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
    // 1. Initial check on mount respects 30-min cooldown
    executePoll();

    // 2. Strict 30-minute foreground interval
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        executePoll();
      }
    }, 1800000);

    return () => {
      clearInterval(interval);
    };
  }, []);
}
