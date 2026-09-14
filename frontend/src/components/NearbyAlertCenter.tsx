"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { Bell, BellOff, CircleCheck, CheckCheck, LocateFixed, MapPin, RefreshCw, Search, Settings2, X } from "lucide-react";
import { requestCurrentPosition } from "@/lib/geolocation";
import {
  enableWebPush, fetchNearbyAlerts, fetchNearbyPreferences, getDeviceUserId,
  markAllNearbyRead, markNearbyRead, NearbyAlert, NearbyPreferences,
  updateAlertLocation, updateNearbyPreferences,
} from "@/lib/nearbyAlerts";

function relativeTime(value?: string | null) {
  if (!value) return "Time unavailable";
  const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function PreferenceSwitch({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative h-[18px] w-8 shrink-0 rounded-full border transition-colors hover:border-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ${checked ? "border-orange-700 bg-orange-600" : "border-slate-300 bg-slate-200"}`}><span className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform motion-reduce:transition-none ${checked ? "translate-x-3.5" : "translate-x-0"}`} /></button>;
}

export function NearbyAlertCenter() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [alerts, setAlerts] = useState<NearbyAlert[]>([]);
  const [preferences, setPreferences] = useState<NearbyPreferences | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "UNREAD" | "READ" | "CRITICAL" | "ABNORMAL">("ALL");
  const [toastQueue, setToastQueue] = useState<NearbyAlert[]>([]);
  const [toastClosing, setToastClosing] = useState(false);
  const alertStateReady = useRef(false);
  const knownAlertIds = useRef(new Set<string>());

  const load = useCallback(async () => {
    try {
      const [nextPreferences, nextAlerts] = await Promise.all([fetchNearbyPreferences(), fetchNearbyAlerts()]);
      if (!alertStateReady.current) {
        nextAlerts.forEach((alert) => knownAlertIds.current.add(alert.id));
        alertStateReady.current = true;
      } else {
        const newAlerts = nextAlerts
          .filter((alert) => !knownAlertIds.current.has(alert.id))
          .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
        nextAlerts.forEach((alert) => knownAlertIds.current.add(alert.id));
        if (newAlerts.length) setToastQueue((queue) => [...queue, ...newAlerts]);
      }
      setPreferences(nextPreferences); setAlerts(nextAlerts);
      if (!nextPreferences.has_alert_location && !localStorage.getItem("thermotrace_nearby_prompt_answered")) setShowPrompt(true);
    } catch { setStatus("Nearby alerts are temporarily unavailable."); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const id = getDeviceUserId();
    const source = new EventSource(`/api/v1/stream/news?user_id=${encodeURIComponent(id)}`);
    let fallback: number | undefined;
    source.onopen = () => { setStreaming(true); if (fallback) window.clearInterval(fallback); };
    source.addEventListener("NOTIFICATION_CREATED", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data || "{}");
        if (String(payload.notification_type || "").startsWith("NEARBY_")) void load();
      } catch {}
    });
    source.onerror = () => {
      setStreaming(false); source.close();
      fallback = window.setInterval(() => void load(), 20000);
    };
    return () => { source.close(); if (fallback) window.clearInterval(fallback); };
  }, [load]);

  const dismissToast = useCallback(() => {
    if (toastClosing) return;
    setToastClosing(true);
    window.setTimeout(() => {
      setToastQueue((queue) => queue.slice(1));
      setToastClosing(false);
    }, 180);
  }, [toastClosing]);

  const activeToast = toastQueue[0];
  useEffect(() => {
    if (!activeToast) return;
    const timer = window.setTimeout(dismissToast, 60_000);
    return () => window.clearTimeout(timer);
  }, [activeToast, dismissToast]);

  const unread = useMemo(() => alerts.filter((alert) => !alert.is_read).length, [alerts]);
  const read = alerts.length - unread;
  const visibleAlerts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return alerts.filter((alert) => {
      const matchesFilter = filter === "ALL"
        || (filter === "UNREAD" && !alert.is_read)
        || (filter === "READ" && alert.is_read)
        || filter === alert.severity;
      if (!matchesFilter) return false;
      if (!query) return true;
      return [alert.event_id, alert.title, alert.message, alert.classification, alert.severity]
        .filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  }, [alerts, filter, search]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const acknowledge = async (alert: NearbyAlert) => {
    if (alert.is_read) return;
    setAlerts((items) => items.map((item) => item.id === alert.id ? { ...item, is_read: true } : item));
    try { await markNearbyRead(alert.id); }
    catch { setStatus("Alert could not be marked as read."); await load(); }
  };

  const acknowledgeAll = async () => {
    if (!unread) return;
    setAlerts((items) => items.map((item) => ({ ...item, is_read: true })));
    try { await markAllNearbyRead(); await load(); }
    catch { setStatus("Alerts could not be marked as read."); await load(); }
  };
  const saveLocation = async () => {
    setLoading(true); setStatus("Requesting your location…");
    try {
      const position = await requestCurrentPosition();
      const next = await updateAlertLocation(position.coords.latitude, position.coords.longitude);
      setPreferences(next); setShowPrompt(false); localStorage.setItem("thermotrace_nearby_prompt_answered", "enabled");
      setStatus("Alert location updated. Exact coordinates are not displayed.");
      if ("Notification" in window && Notification.permission !== "denied" && next.vapid_public_key) {
        try { await enableWebPush(next.vapid_public_key); setStatus("Nearby alerts and browser notifications are enabled."); }
        catch (error) { setStatus(error instanceof Error ? error.message : "Browser notifications could not be enabled."); }
      }
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Location could not be updated.";
      if (/denied|permission/i.test(message)) localStorage.setItem("thermotrace_nearby_prompt_answered", "denied");
      setStatus(message);
    }
    finally { setLoading(false); }
  };

  const savePreferences = async (updates: Partial<NearbyPreferences>) => {
    if (!preferences) return;
    const next = await updateNearbyPreferences({
      enabled: updates.enabled ?? preferences.enabled,
      notify_critical: updates.notify_critical ?? preferences.notify_critical,
      notify_abnormal: updates.notify_abnormal ?? preferences.notify_abnormal,
    });
    setPreferences(next);
  };

  const viewOnMap = async (alert: NearbyAlert) => {
    if (!alert.is_read) { await markNearbyRead(alert.id); setAlerts((items) => items.map((item) => item.id === alert.id ? { ...item, is_read: true } : item)); }
    setOpen(false);
    if (pathname === "/monitor") {
      router.push(`/monitor?eventId=${encodeURIComponent(alert.event_id)}`, { scroll: false });
    } else {
      router.push(`/monitor?eventId=${encodeURIComponent(alert.event_id)}`, { scroll: false });
    }
  };

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label={`Nearby alerts, ${unread} unread`}
      className="relative flex h-8 items-center gap-1.5 rounded-lg border border-orange-700 bg-orange-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-orange-700 active:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900">
      <Bell className="h-3.5 w-3.5" /><span>Nearby Alerts</span>
      {unread > 0 && <span aria-label={`${unread} unread`} className="ml-0.5 inline-grid min-w-4 place-items-center rounded-full bg-slate-950 px-1 py-0.5 text-[9px] font-bold leading-none text-white">{unread > 9 ? "9+" : unread}</span>}
    </button>

    {typeof document !== "undefined" && activeToast && document.getElementById("nearby-alert-toast-layer") && createPortal(<div role="status" aria-label="New nearby alert" className={`pointer-events-auto w-full rounded-lg border border-l-2 bg-white p-3 text-slate-800 shadow-xl ${activeToast.severity === "CRITICAL" ? "border-red-200 border-l-red-500" : "border-orange-200 border-l-orange-500"} ${toastClosing ? "animate-[nearby-toast-out_180ms_ease-in_forwards]" : "animate-[nearby-toast-in_180ms_ease-out]"}`}>
      <div className="flex items-start gap-2">
        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${activeToast.severity === "CRITICAL" ? "bg-red-500" : "bg-orange-500"}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><span className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide ${activeToast.severity === "CRITICAL" ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-700"}`}>{activeToast.severity}</span><span className="ml-auto shrink-0 text-[10px] text-slate-400">{relativeTime(activeToast.created_at)}</span></div>
          <p className="mt-1.5 text-[13px] font-bold leading-5 text-slate-950">{activeToast.title}</p>
          {activeToast.message && <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-slate-600">{activeToast.message}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 text-[10px] text-slate-500">{activeToast.peak_frp_mw != null && <span className={`font-mono font-bold ${activeToast.severity === "CRITICAL" ? "text-red-700" : "text-orange-700"}`}>{activeToast.peak_frp_mw.toFixed(1)} MW</span>}{activeToast.distance_km != null && <span>{activeToast.distance_km.toFixed(1)} km away</span>}<button type="button" className="ml-auto flex min-h-7 items-center gap-1 rounded-md border border-orange-300 px-2 text-[10px] font-semibold text-orange-700 hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" onClick={() => { setToastQueue((queue) => queue.slice(1)); setToastClosing(false); void viewOnMap(activeToast); }}><MapPin className="h-3 w-3" /> View on Map</button></div>
        </div>
        <button type="button" aria-label="Dismiss nearby alert" onClick={dismissToast} className="-mr-1 -mt-1 shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"><X className="h-3.5 w-3.5" /></button>
      </div>
    </div>, document.getElementById("nearby-alert-toast-layer")!)}

    {typeof document !== "undefined" && showPrompt && createPortal(<div role="dialog" aria-modal="true" aria-labelledby="nearby-optin-title" className="fixed inset-x-3 bottom-20 z-[80] mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-4 text-slate-800 shadow-2xl md:bottom-6">
      <h2 id="nearby-optin-title" className="font-semibold">Enable Nearby Thermal Alerts</h2>
      <p className="mt-2 text-sm text-slate-600">ThermoTrace AI can use your location to warn you when a critical or abnormal thermal event is detected nearby.</p>
      <p className="mt-1 text-xs text-slate-500">Your registered location is used only to determine whether an event is relevant to you.</p>
      {status && <p role="status" className="mt-2 text-xs text-amber-700">{status}</p>}
      <div className="mt-4 flex justify-end gap-2"><button className="min-h-10 px-3 text-sm" onClick={() => { setShowPrompt(false); localStorage.setItem("thermotrace_nearby_prompt_answered", "not-now"); }}>Not Now</button><button disabled={loading} className="min-h-10 rounded-md bg-orange-600 px-4 text-sm font-semibold text-white" onClick={() => void saveLocation()}>Enable Location Alerts</button></div>
    </div>, document.body)}

    {typeof document !== "undefined" && open && createPortal(<div className="fixed inset-0 z-[75] bg-black/30" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <section role="dialog" aria-modal="true" aria-label="Nearby Alerts" className="absolute inset-x-0 bottom-0 flex h-[92vh] min-h-0 flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-slate-50 text-slate-800 shadow-2xl md:inset-y-0 md:left-auto md:h-auto md:w-[460px] md:rounded-none md:border-y-0 md:border-r-0">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-orange-50 text-orange-600"><Bell className="h-4 w-4" /></span><div className="min-w-0"><h2 className="font-bold text-slate-950">Nearby Alerts</h2><p className="truncate text-[11px] text-slate-500">Last 24 hours · {unread} unread · {streaming ? "Live" : "Polling"}</p></div></div>
          <div className="flex items-center gap-1"><button type="button" title="Refresh nearby alerts" aria-label="Refresh nearby alerts" disabled={refreshing} onClick={() => void refresh()} className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin motion-reduce:animate-none" : ""}`} /></button><button type="button" title="Close nearby alerts" aria-label="Close nearby alerts" onClick={() => setOpen(false)} className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"><X className="h-5 w-5" /></button></div>
        </header>
        {showSettings && preferences && <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 text-sm">
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Alert Preferences</h3>
          <div className="flex items-center gap-2.5 pb-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-orange-50 text-orange-600"><Bell className="h-3.5 w-3.5" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900">Nearby Thermal Alerts</p><p className="text-[11px] text-slate-500">Alerts near your registered location</p></div><PreferenceSwitch label="Nearby Thermal Alerts" checked={preferences.enabled} onChange={(checked) => void savePreferences({ enabled: checked })} /></div>
          <div className="ml-3 space-y-2 border-l border-slate-200 py-1 pl-4">
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-red-500"/><div className="min-w-0 flex-1"><p className="text-xs font-bold text-red-700">CRITICAL</p><p className="text-[11px] text-slate-500">25 km contextual radius</p></div><PreferenceSwitch label="Critical nearby notifications" checked={preferences.notify_critical} onChange={(checked) => void savePreferences({ notify_critical: checked })} /></div>
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-orange-500"/><div className="min-w-0 flex-1"><p className="text-xs font-bold text-orange-700">ABNORMAL</p><p className="text-[11px] text-slate-500">10 km contextual radius</p></div><PreferenceSwitch label="Abnormal nearby notifications" checked={preferences.notify_abnormal} onChange={(checked) => void savePreferences({ notify_abnormal: checked })} /></div>
          </div>
          <div className="mt-2 grid gap-2 border-t border-slate-100 pt-2 sm:grid-cols-2">
            <div className="flex items-center gap-2"><LocateFixed className="h-4 w-4 shrink-0 text-slate-500"/><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-800">Alert Location</p><p className="text-[11px] text-slate-500">{preferences.has_alert_location ? "Registered location" : "Not registered"}</p></div><button className="min-h-8 shrink-0 rounded-md border border-slate-300 px-2 text-[11px] font-semibold text-slate-700 hover:border-orange-300 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" onClick={() => void saveLocation()}>Update</button></div>
            {(() => { const permission = typeof Notification === "undefined" ? "unsupported" : Notification.permission; const enabled = permission === "granted"; return <div className="flex items-center gap-2 rounded-md bg-slate-50 px-2.5 py-2"><span className={`h-2 w-2 shrink-0 rounded-full ${enabled ? "bg-emerald-500" : permission === "denied" ? "bg-red-500" : "bg-amber-500"}`}/><div><p className="text-xs font-semibold text-slate-800">Browser Notifications</p><p className={`text-[11px] ${enabled ? "text-emerald-700" : "text-slate-500"}`}>{enabled ? "Enabled" : permission === "denied" ? "Disabled by browser" : permission === "unsupported" ? "Unsupported" : "Permission required"}</p></div></div>; })()}
          </div>
          {status && <p role="status" className="mt-2 text-xs text-amber-700">{status}</p>}
        </div>}
        <div className="shrink-0 border-b border-slate-200 bg-white">
          <div className="flex items-start gap-2 border-b border-slate-100 px-4 py-2 text-[11px] leading-4 text-slate-500"><span className="flex-1">Notification radius is contextual relevance, not a danger or evacuation radius.</span><button type="button" aria-label="Nearby alert settings" title="Nearby alert settings" className="shrink-0 rounded-md p-1.5 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" onClick={() => setShowSettings((value) => !value)}><Settings2 className="h-4 w-4" /></button></div>
          <div className="flex gap-2 px-4 pt-3">
            <label className="relative min-w-0 flex-1"><span className="sr-only">Search nearby alerts</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search nearby alerts..." className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100" /></label>
            <button type="button" disabled={!unread} onClick={() => void acknowledgeAll()} className="flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-orange-300 px-3 text-xs font-semibold text-orange-700 transition-colors hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"><CheckCheck className="h-4 w-4"/> Mark All Read</button>
          </div>
          <div className="flex flex-wrap gap-1.5 px-4 py-3" role="group" aria-label="Filter nearby alerts">
            {([['ALL', `All (${alerts.length})`], ['UNREAD', `Unread (${unread})`], ['READ', `Read (${read})`], ['CRITICAL', 'Critical'], ['ABNORMAL', 'Abnormal']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${filter === value ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-orange-300 hover:text-orange-700"}`}>{label}</button>)}
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
          {alerts.length === 0 ? <div className="py-12 text-center"><BellOff className="mx-auto h-7 w-7 text-slate-400"/><p className="mt-3 font-semibold">No nearby alerts.</p><p className="mt-1 text-xs text-slate-500">Your area has no qualifying ThermoTrace thermal notifications during this period.</p></div> : visibleAlerts.length === 0 ? <div className="py-12 text-center"><Search className="mx-auto h-7 w-7 text-slate-400"/><p className="mt-3 font-semibold">No alerts match your search.</p><p className="mt-1 text-xs text-slate-500">Try another search term or filter.</p></div> : visibleAlerts.map((alert) => {
            const critical = alert.severity === "CRITICAL";
            return <article key={alert.id} className={`rounded-lg border bg-white p-3 shadow-sm transition-shadow hover:shadow-md ${alert.is_read ? "border-slate-200" : critical ? "border-red-200" : "border-orange-200"}`}>
              <div className="flex items-center gap-2"><span className={`rounded px-2 py-0.5 text-[10px] font-extrabold tracking-wide ${critical ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-700"}`}>{alert.severity}</span><span className="min-w-0 flex-1 truncate font-mono text-[10px] font-semibold text-slate-500" title={alert.event_id}>{alert.event_id}</span><span className="shrink-0 text-[11px] text-slate-400">{relativeTime(alert.created_at)}</span></div>
              <h3 className="mt-1.5 text-[13px] font-bold leading-5 text-slate-950">{alert.title}</h3>
              {alert.message && <p className="mt-0.5 text-[11px] leading-[1.45] text-slate-600">{alert.message}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-100 pt-2 text-[10px] text-slate-500"><div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">{alert.peak_frp_mw != null && <span className={`font-mono font-bold ${critical ? "text-red-700" : "text-orange-700"}`}>{alert.peak_frp_mw.toFixed(1)} MW</span>}{alert.classification && <span className="font-mono font-semibold text-slate-600">{alert.classification}</span>}{alert.distance_km != null && <span><MapPin className="mr-0.5 inline h-3 w-3"/> {alert.distance_km.toFixed(1)} km away</span>}</div><div className="ml-auto flex shrink-0 items-center gap-1.5"><button aria-label={`View event ${alert.event_id} on map`} className="flex min-h-7 items-center justify-center gap-1 rounded-md border border-orange-300 px-2 text-[10px] font-semibold text-orange-700 transition-colors hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" onClick={() => void viewOnMap(alert)}><MapPin className="h-3 w-3"/> Show on Map</button>{alert.is_read ? <span className="flex min-h-7 items-center gap-1 px-1 text-[10px] font-semibold text-emerald-700"><CircleCheck className="h-3.5 w-3.5"/> Read</span> : <button type="button" className="min-h-7 rounded-md border border-slate-300 px-2 text-[10px] font-semibold text-slate-700 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" onClick={() => void acknowledge(alert)}>Acknowledge</button>}</div></div>
            </article>;
          })}
        </div>
      </section>
    </div>, document.body)}
  </>;
}
