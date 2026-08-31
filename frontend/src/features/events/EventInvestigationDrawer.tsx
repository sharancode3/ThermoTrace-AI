"use client";

import { useEffect, useState } from "react";
import { Activity, BarChart3, MapPin, X } from "lucide-react";
import { fetchEventComparison, fetchEventHistory, fetchEventIntelligence } from "@/lib/apiClient";

type Tab = "overview" | "timeline" | "geography" | "baseline";
const format = (value: number | null | undefined, unit = "") => value === null || value === undefined ? "Unavailable" : `${value.toFixed(1)}${unit}`;
const when = (value?: string) => value ? new Date(value).toLocaleString() : "Unavailable";

export function EventInvestigationDrawer({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [detail, setDetail] = useState<any>();
  const [history, setHistory] = useState<any>();
  const [comparison, setComparison] = useState<any>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDetail(undefined); setHistory(undefined); setComparison(undefined); setError(null);
    Promise.all([fetchEventIntelligence(eventId), fetchEventHistory(eventId), fetchEventComparison(eventId)])
      .then(([nextDetail, nextHistory, nextComparison]) => { setDetail(nextDetail); setHistory(nextHistory); setComparison(nextComparison); })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load investigation"));
  }, [eventId]);

  const tabs: [Tab, string][] = [["overview", "Overview"], ["timeline", "Timeline"], ["geography", "Geographic Context"], ["baseline", "Historical Baseline"]];
  return <aside className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col rounded-t-lg border border-slate-200 bg-white shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:w-[440px] md:max-h-none md:rounded-none" aria-label="Event investigation">
    <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><div><p className="font-mono text-sm font-semibold text-slate-900">{detail?.event_id ?? eventId}</p><p className="text-xs text-slate-500">{detail?.facility_name ?? detail?.location_name ?? "Loading location…"}</p></div><button aria-label="Close investigation" onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button></header>
    <nav className="flex overflow-x-auto border-b border-slate-200 px-2" aria-label="Investigation tabs">{tabs.map(([value, label]) => <button key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={`whitespace-nowrap border-b-2 px-3 py-3 text-xs font-medium ${tab === value ? "border-orange-600 text-orange-700" : "border-transparent text-slate-600"}`}>{label}</button>)}</nav>
    <div className="flex-1 overflow-y-auto p-4 text-sm">
      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700">Investigation unavailable: {error}</p>}
      {!detail && !error && <p className="text-slate-500">Loading verified event intelligence…</p>}
      {detail && tab === "overview" && <div className="space-y-4">
        <section className="rounded-md border border-slate-200 p-3"><div className="flex items-center justify-between"><span className="font-semibold text-slate-900">{detail.classification}</span><span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium">{detail.anomaly_tier}</span></div><p className="mt-2 text-xs text-slate-500">First detected {when(detail.first_detected_utc)}</p></section>
        <section className="grid grid-cols-2 gap-2">{[["Peak FRP", format(detail.peak_frp_mw, " MW")], ["Mean FRP", format(detail.mean_frp_mw, " MW")], ["Brightness", format(detail.max_brightness_k, " K")], ["Observations", String(detail.observation_count ?? "Unavailable")], ["Duration", format(detail.duration_hours, " h")], ["Confidence", format((detail.classification_confidence ?? 0) * 100, "%")]].map(([label, value]) => <div key={label} className="rounded-md border border-slate-200 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-mono font-semibold text-slate-900">{value}</p></div>)}</section>
        <section className="rounded-md border border-slate-200 p-3"><h2 className="font-semibold text-slate-900">Evidence</h2><p className="mt-2 text-xs text-slate-600">Persistence: {detail.persistence_tier} · Thermal trend: {detail.thermal_trend} · Evidence completeness: {detail.evidence_completeness}</p>{Object.keys(detail.shap_top_contributors ?? {}).length > 0 && <ul className="mt-2 space-y-1 text-xs">{Object.entries(detail.shap_top_contributors).map(([key, value]) => <li key={key} className="flex justify-between"><span>{key}</span><span className="font-mono">{String(value)}</span></li>)}</ul>}</section>
      </div>}
      {detail && tab === "timeline" && <div className="space-y-3"><h2 className="flex items-center gap-2 font-semibold text-slate-900"><Activity className="h-4 w-4" /> Observation timeline</h2>{!history?.history?.length ? <p className="rounded-md border border-slate-200 p-3 text-slate-500">INSUFFICIENT DATA</p> : <><div className="rounded-md border border-slate-200 p-3 text-xs"><p>First detected: {when(detail.first_detected_utc)}</p><p>Peak FRP: {format(detail.peak_frp_mw, " MW")}</p><p>Latest observation: {when(detail.latest_detected_utc)}</p></div><div className="space-y-2">{history.history.map((point: any) => <div key={point.id} className="flex justify-between border-b border-slate-100 pb-2 text-xs"><span>{when(point.acquired_at)}</span><span className="font-mono">{format(point.frp_mw, " MW")} · {format(point.brightness_k, " K")}</span></div>)}</div></>}</div>}
      {detail && tab === "geography" && <div className="space-y-3"><h2 className="flex items-center gap-2 font-semibold text-slate-900"><MapPin className="h-4 w-4" /> Geographic context</h2><section className="rounded-md border border-slate-200 p-3 text-xs space-y-2"><p><strong>Facility:</strong> {detail.facility_name ?? "No associated facility"}</p><p><strong>Distance:</strong> {format(detail.distance_to_facility_m, " m")}</p><p><strong>Land cover:</strong> {detail.primary_land_use ?? "Unavailable"}</p><p><strong>Footprint:</strong> {format(detail.bounding_area_ha, " ha")}</p><p><strong>Coordinates:</strong> {detail.centroid?.coordinates ? `${detail.centroid.coordinates[1].toFixed(4)}, ${detail.centroid.coordinates[0].toFixed(4)}` : "Unavailable"}</p></section></div>}
      {detail && tab === "baseline" && <div className="space-y-3"><h2 className="flex items-center gap-2 font-semibold text-slate-900"><BarChart3 className="h-4 w-4" /> Earlier vs. now</h2><section className="grid grid-cols-2 gap-2 text-xs">{[["Earlier", comparison?.earlier], ["Now", comparison?.now]].map(([label, value]: any) => <div key={label} className="rounded-md border border-slate-200 p-3"><p className="font-semibold">{label}</p>{value ? <><p>{when(value.timestamp)}</p><p className="mt-1 font-mono">FRP {format(value.total_frp_mw, " MW")}</p><p className="font-mono">Observations {value.observation_count}</p></> : <p className="mt-1 text-slate-500">HISTORICAL COMPARISON UNAVAILABLE</p>}</div>)}</section>{comparison?.change && <section className="rounded-md border border-slate-200 p-3 text-xs"><p className="font-semibold">Observed change</p><p className="mt-1 font-mono">Δ FRP {format(comparison.change.frp_change_mw, " MW")}</p><p className="font-mono">Δ brightness {format(comparison.change.brightness_change_k, " K")}</p><p className="mt-2 text-slate-500">This is a comparison of recorded satellite observations and does not establish causality.</p></section>}<section className="rounded-md border border-slate-200 p-3 text-xs"><p>Baseline mean: {format(detail.baseline_mean_frp_mw, " MW")}</p><p>Baseline deviation: {format(detail.baseline_std_frp_mw, " MW")}</p><p>Z-score: {format(detail.anomaly_z_score)}</p></section></div>}
    </div>
  </aside>;
}
