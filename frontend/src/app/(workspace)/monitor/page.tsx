"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import MapComponent from "@/components/MapComponent";

function MonitorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const selectedEventId = searchParams.get("eventId");

  const setSelectedEventId = (id: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id) {
      params.set("eventId", id);
    } else {
      params.delete("eventId");
    }
    const newQuery = params.toString();
    router.push(`${pathname}${newQuery ? "?" + newQuery : ""}`);
  };

  return (
    <div className="relative w-full h-full">
      <MapComponent
        onEventClick={setSelectedEventId}
        selectedEventId={selectedEventId}
      />
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
