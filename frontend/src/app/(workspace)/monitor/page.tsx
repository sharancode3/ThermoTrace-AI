"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import MapComponent from "@/components/MapComponent";
import { useTargetWind } from "@/hooks/useTargetWind";

const EventDetailPanel = dynamic(
  () => import("@/components/EventDetailPanel").then((mod) => mod.EventDetailPanel),
  { ssr: false }
);

function MonitorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [selectedEventId, setSelectedEventIdState] = useState<string | null>(() => searchParams.get("eventId"));
  const [windVisible, setWindVisible] = useState(true);

  // Authoritative single-owner wind state with automatic race-condition abort
  const { wind } = useTargetWind(
    selectedEventId ? "event" : null,
    selectedEventId
  );

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

  return (
    <div className="relative w-full h-full">
      <MapComponent
        onEventClick={setSelectedEventId}
        selectedEventId={selectedEventId}
        wind={wind}
        windVisible={windVisible}
        onWindVisibilityChange={setWindVisible}
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
