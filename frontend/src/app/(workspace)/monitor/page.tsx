"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import MapComponent from "@/components/MapComponent";
import { EventDetailPanel } from "@/components/EventDetailPanel";
import { clearEventCache, fetchEventWind, WindData } from "@/lib/apiClient";

function MonitorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [selectedEventId, setSelectedEventIdState] = useState<string | null>(() => searchParams.get("eventId"));
  const [wind, setWind] = useState<WindData | null>(null);
  const [windVisible, setWindVisible] = useState(true);

  // Sync state if URL searchParams changes externally
  useEffect(() => {
    const urlEventId = searchParams.get("eventId");
    if (urlEventId !== selectedEventId) {
      setSelectedEventIdState(urlEventId);
    }
  }, [searchParams]);

  const setSelectedEventId = (id: string | null) => {
    setSelectedEventIdState(id);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (id) {
        params.set("eventId", id);
      } else {
        params.delete("eventId");
      }
      const newQuery = params.toString();
      const newUrl = `${pathname}${newQuery ? "?" + newQuery : ""}`;
      window.history.pushState({}, "", newUrl);
      try {
        router.replace(newUrl);
      } catch {
        // ignore navigation errors
      }
    }
  };

  useEffect(() => {
    if (!selectedEventId) {
      setWind(null);
      return;
    }
    let cancelled = false;
    setWind(null);
    fetchEventWind(selectedEventId)
      .then((result) => {
        if (!cancelled) setWind(result);
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof Error && error.message.includes("(404)")) {
          void clearEventCache().finally(() => {
            if (!cancelled) setSelectedEventId(null);
          });
          return;
        }
        setWind({
          available: false,
          status: "WIND_DATA_UNAVAILABLE",
          reason: error instanceof Error ? error.message : "Wind provider request failed",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedEventId]);

  return (
    <div className="relative w-full h-full">
      <MapComponent
        onEventClick={setSelectedEventId}
        selectedEventId={selectedEventId}
        wind={wind}
        windVisible={windVisible}
      />
      {selectedEventId && (
        <EventDetailPanel
          eventId={selectedEventId}
          onClose={() => setSelectedEventId(null)}
          wind={wind}
          windVisible={windVisible}
          onWindVisibilityChange={setWindVisible}
        />
      )}
    </div>
  );
}

export default function MonitorPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full h-full bg-slate-950 flex items-center justify-center text-orange-500 font-mono text-xs tracking-wider animate-pulse">
          INITIALIZING SOVEREIGN THERMAL RADAR...
        </div>
      }
    >
      <MonitorContent />
    </Suspense>
  );
}
