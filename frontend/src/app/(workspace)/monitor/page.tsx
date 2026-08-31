"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import MapComponent from "@/components/MapComponent";
import { EventDetailPanel } from "@/components/EventDetailPanel";

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
    <>
      <MapComponent onEventClick={setSelectedEventId} selectedEventId={selectedEventId} />
      {selectedEventId && (
        <EventDetailPanel 
          eventId={selectedEventId} 
          onClose={() => setSelectedEventId(null)} 
        />
      )}
    </>
  );
}

export default function MonitorPage() {
  return (
    <Suspense fallback={<div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-400 font-mono text-xs">Loading Tactical Map...</div>}>
      <MonitorContent />
    </Suspense>
  );
}
