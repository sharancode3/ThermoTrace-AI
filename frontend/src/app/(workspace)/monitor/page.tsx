"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import MapComponent from "@/components/MapComponent";
import { EventInvestigationDrawer } from "@/features/events/EventInvestigationDrawer";
import { useState } from "react";

export default function MonitorPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const selectedEventId = searchParams.get("eventId");
  const [windowHours, setWindowHours] = useState<number | null>(24);
  const [showFacilities, setShowFacilities] = useState(false);
  const [showObservations, setShowObservations] = useState(false);
  const [classification, setClassification] = useState("");
  const [anomalyTier, setAnomalyTier] = useState("");
  const startTime = windowHours ? new Date(Date.now() - windowHours * 3600000).toISOString() : undefined;

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
      <MapComponent onEventClick={setSelectedEventId} onClearFilters={() => { setWindowHours(null); setClassification(""); setAnomalyTier(""); }} selectedEventId={selectedEventId} startTime={startTime} classification={classification || undefined} anomalyTier={anomalyTier || undefined} showFacilities={showFacilities} showObservations={showObservations} />
      <section aria-label="Map layers and filters" className="absolute left-4 top-4 z-20 w-60 rounded-md border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-2 text-xs font-semibold text-slate-700">Monitor window</div>
        <div className="flex gap-1">{[[6, "6h"], [24, "24h"], [168, "7d"], [720, "30d"], [null, "All"]].map(([hours, label]) => <button key={label as string} onClick={() => setWindowHours(hours as number | null)} className={`rounded px-2 py-1 text-xs ${windowHours === hours ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-700"}`}>{label}</button>)}</div>
        <label className="mt-3 flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={showFacilities} onChange={(event) => setShowFacilities(event.target.checked)} /> Facilities</label>
        <label className="mt-2 flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={showObservations} onChange={(event) => setShowObservations(event.target.checked)} /> FIRMS observations</label>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-700">Severity<select aria-label="Severity" value={anomalyTier} onChange={(event) => setAnomalyTier(event.target.value)} className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs"><option value="">All</option><option>CRITICAL</option><option>ABNORMAL</option><option>ELEVATED</option><option>NORMAL</option></select></label>
          <label className="text-xs text-slate-700">Class<select aria-label="Classification" value={classification} onChange={(event) => setClassification(event.target.value)} className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs"><option value="">All</option><option>IND_FIRE</option><option>IND_FLARE</option><option>IND_ROUTINE</option><option>AGRI_BURN</option><option>WILDFIRE</option><option>OTHER_UNCERTAIN</option></select></label>
        </div>
      </section>
      {selectedEventId && (
        <EventInvestigationDrawer
          eventId={selectedEventId} 
          onClose={() => setSelectedEventId(null)} 
        />
      )}
    </>
  );
}
