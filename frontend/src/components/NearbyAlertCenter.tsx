"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { Bell, BellOff, CircleCheck, CheckCheck, LocateFixed, MapPin, RefreshCw, Search, Settings2, Wind, Volume2, VolumeX, X } from "lucide-react";
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

function playTacticalAlertChime() {
  try {
    if (localStorage.getItem("thermotrace_chime_enabled") === "false") return;
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") void ctx.resume();

    const now = ctx.currentTime;
    // Radar Double-Ping Tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(440, now + 0.12);
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.12);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(1174.66, now + 0.15);
    osc2.frequency.exponentialRampToValueAtTime(587.33, now + 0.35);
    gain2.gain.setValueAtTime(0.2, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.35);
  } catch {
    // AudioContext blocked or awaiting user gesture
  }
}

function dispatchDesktopNotification(alert: NearbyAlert) {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const title = `🚨 [${alert.severity}] Nearby Thermal Event: ${alert.event_id}`;
    const dir = alert.bearing_cardinal ? ` (${alert.bearing_cardinal})` : "";
    const dist = alert.distance_km != null ? `${alert.distance_km.toFixed(1)} km${dir} · ` : "";
    const frp = alert.peak_frp_mw != null ? `${alert.peak_frp_mw.toFixed(1)} MW · ` : "";
    const downwind = alert.is_downwind_hazard ? "⚠️ DOWNWIND PLUME HAZARD · " : "";
    const body = `${dist}${frp}${downwind}${alert.title}`;

    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, {
          body,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          tag: alert.id,
          data: { eventId: alert.event_id, url: `/monitor?eventId=${encodeURIComponent(alert.event_id)}` },
        });
      }).catch(() => {
        new Notification(title, { body, icon: "/favicon.ico", tag: alert.id });
      });
    } else {
      new Notification(title, { body, icon: "/favicon.ico", tag: alert.id });
    }
  } catch (err) {
    console.warn("Could not dispatch desktop notification:", err);
  }
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
  const [chimeEnabled, setChimeEnabled] = useState(true);
  const alertStateReady = useRef(false);
  const knownAlertIds = useRef(new Set<string>());

  useEffect(() => {
    const pref = localStorage.getItem("thermotrace_chime_enabled");
    if (pref !== null) setChimeEnabled(pref === "true");
  }, []);

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
        if (newAlerts.length) {
          setToastQueue((queue) => [...queue, ...newAlerts]);
          playTacticalAlertChime();
          newAlerts.forEach(dispatchDesktopNotification);
        }
      }
      setPreferences(nextPreferences);
      setAlerts(nextAlerts);
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
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      localStorage.setItem("thermotrace_user_lat", String(lat));
      localStorage.setItem("thermotrace_user_lon", String(lon));
      window.dispatchEvent(new CustomEvent("thermotrace-location-synced", { detail: { lat, lon } }));

      const next = await updateAlertLocation(lat, lon);
      setPreferences(next); setShowPrompt(false); localStorage.setItem("thermotrace_nearby_prompt_answered", "enabled");
      setStatus("Alert location updated & 25 km safety perimeter active.");

      if ("Notification" in window) {
        if (Notification.permission === "default") {
          const perm = await Notification.requestPermission();
          if (perm === "granted" && next.vapid_public_key) {
            try { await enableWebPush(next.vapid_public_key); setStatus("Nearby alerts, 25km geofence, and desktop notifications active."); }
            catch (error) { setStatus(error instanceof Error ? error.message : "Browser notifications could not be enabled."); }
          }
        } else if (Notification.permission === "granted" && next.vapid_public_key) {
          try { await enableWebPush(next.vapid_public_key); setStatus("Nearby alerts and browser notifications enabled."); }
          catch (error) { setStatus(error instanceof Error ? error.message : "Browser notifications could not be enabled."); }
        }
      }
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Location could not be updated.";
      if (/denied|permission/i.test(message)) localStorage.setItem("thermotrace_nearby_prompt_answered", "denied");
      setStatus(message);
    }
    finally { setLoading(false); }
  };

  const requestDesktopPermissionDirectly = async () => {
    if (!("Notification" in window)) {
      setStatus("Desktop notifications are not supported in this browser.");
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        if (preferences?.vapid_public_key) {
          await enableWebPush(preferences.vapid_public_key);
        }
        setStatus("Desktop notifications enabled successfully.");
        await load();
      } else {
        setStatus("Notification permission was denied or dismissed.");
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to enable notifications.");
    }
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
    router.push(`/monitor?eventId=${encodeURIComponent(alert.event_id)}`, { scroll: false });
  };

  const toggleChime = (enabled: boolean) => {
    setChimeEnabled(enabled);
    localStorage.setItem("thermotrace_chime_enabled", String(enabled));
    if (enabled) playTacticalAlertChime();
  };

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label={`Nearby alerts, ${unread} unread`}
      className="relative flex h-8 items-center gap-1.5 rounded-lg border border-orange-700 bg-orange-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-orange-700 active:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900">
      <Bell className="h-3.5 w-3.5" /><span>Nearby Alerts</span>
      {unread > 0 && <span aria-label={`${unread} unread`} className="ml-0.5 inline-grid min-w-4 place-items-center rounded-full bg-slate-950 px-1 py-0.5 text-[9px] font-bold leading-none text-white">{unread > 9 ? "9+" : unread}</span>}
    </button>

    {typeof document !== "undefined" && activeToast && document.getElementById("nearby-alert-toast-layer") && createPortal(<div role="status" aria-label="New nearby alert" className={`pointer-events-auto w-full rounded-lg border border-l-4 bg-white p-3.5 text-slate-800 shadow-2xl ${activeToast.severity === "CRITICAL" ? "border-red-200 border-l-red-600" : "border-orange-200 border-l-orange-500"} ${toastClosing ? "animate-[nearby-toast-out_180ms_ease-in_forwards]" : "animate-[nearby-toast-in_180ms_ease-out]"}`}>
      <div className="flex items-start gap-2.5">
        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full animate-ping ${activeToast.severity === "CRITICAL" ? "bg-red-500" : "bg-orange-500"}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide ${activeToast.severity === "CRITICAL" ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "bg-orange-50 text-orange-700 ring-1 ring-orange-200"}`}>{activeToast.severity}</span>
            {activeToast.is_downwind_hazard && (
              <span className="flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-800 ring-1 ring-amber-300">
                <Wind className="h-3 w-3 text-amber-600" /> Downwind Hazard
              </span>
            )}
            <span className="ml-auto shrink-0 text-[10px] text-slate-400">{relativeTime(activeToast.created_at)}</span>
          </div>
          <p className="mt-1.5 text-[13px] font-bold leading-5 text-slate-950">{activeToast.title}</p>
          {activeToast.message && <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-slate-600">{activeToast.message}</p>}
          <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 text-[10px] text-slate-500">
            {activeToast.peak_frp_mw != null && <span className={`font-mono font-bold ${activeToast.severity === "CRITICAL" ? "text-red-700" : "text-orange-700"}`}>{activeToast.peak_frp_mw.toFixed(1)} MW</span>}
            {activeToast.distance_km != null && <span className="font-semibold text-slate-700">{activeToast.distance_km.toFixed(1)} km {activeToast.bearing_cardinal ? `(${activeToast.bearing_cardinal})` : ""} away</span>}
            <button type="button" className="ml-auto flex min-h-7 items-center gap-1 rounded-md border border-orange-300 px-2.5 text-[10px] font-semibold text-orange-700 hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" onClick={() => { setToastQueue((queue) => queue.slice(1)); setToastClosing(false); void viewOnMap(activeToast); }}><MapPin className="h-3 w-3" /> View on Map</button>
          </div>
        </div>
        <button type="button" aria-label="Dismiss nearby alert" onClick={dismissToast} className="-mr-1 -mt-1 shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"><X className="h-3.5 w-3.5" /></button>
      </div>
    </div>, document.getElementById("nearby-alert-toast-layer")!)}

    {typeof document !== "undefined" && showPrompt && createPortal(<div role="dialog" aria-modal="true" aria-labelledby="nearby-optin-title" className="fixed inset-x-3 bottom-20 z-[80] mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-5 text-slate-800 shadow-2xl md:bottom-6">
      <div className="flex items-center gap-2.5 text-orange-600 font-bold text-sm">
        <LocateFixed className="h-5 w-5" />
        <h2 id="nearby-optin-title">Enable Nearby Thermal Alerts & Safety Perimeter</h2>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">ThermoTrace AI scans 25 km around your location for critical and abnormal thermal events. When active, you receive in-app toasts, synthetic tactical radar chimes, and native desktop notifications.</p>
      <p className="mt-1.5 text-[11px] text-slate-400">Your coordinates stay localized and are solely used for proximity scanning.</p>
      {status && <p role="status" className="mt-2 text-xs text-amber-700">{status}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button className="min-h-9 px-3 text-xs font-semibold text-slate-600 hover:text-slate-900" onClick={() => { setShowPrompt(false); localStorage.setItem("thermotrace_nearby_prompt_answered", "not-now"); }}>Not Now</button>
        <button disabled={loading} className="min-h-9 rounded-md bg-orange-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-orange-700" onClick={() => void saveLocation()}>Enable Geofence & Notifications</button>
      </div>
    </div>, document.body)}

    {typeof document !== "undefined" && open && createPortal(<div className="fixed inset-0 z-[75] bg-black/30" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <section role="dialog" aria-modal="true" aria-label="Nearby Alerts" className="absolute inset-x-0 bottom-0 flex h-[92vh] min-h-0 flex-col overflow-hidden rounded-t-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 shadow-2xl md:inset-y-0 md:left-auto md:h-auto md:w-[460px] md:rounded-none md:border-y-0 md:border-r-0">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-orange-50 dark:bg-orange-950/80 text-orange-600 dark:text-orange-400"><Bell className="h-4 w-4" /></span><div className="min-w-0"><h2 className="font-bold text-slate-950 dark:text-white">Nearby Alerts</h2><p className="truncate text-[11px] text-slate-500 dark:text-slate-300">Last 24 hours · {unread} unread · {streaming ? "Live" : "Polling"}</p></div></div>
          <div className="flex items-center gap-1"><button type="button" title="Refresh nearby alerts" aria-label="Refresh nearby alerts" disabled={refreshing} onClick={() => void refresh()} className="rounded-md p-2 text-slate-500 dark:text-slate-300 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin motion-reduce:animate-none" : ""}`} /></button><button type="button" title="Close nearby alerts" aria-label="Close nearby alerts" onClick={() => setOpen(false)} className="rounded-md p-2 text-slate-500 dark:text-slate-300 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"><X className="h-5 w-5" /></button></div>
        </header>
        {showSettings && preferences && <div className="shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-sm">
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">Alert Preferences</h3>
          <div className="flex items-center gap-2.5 pb-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-orange-50 dark:bg-orange-950/80 text-orange-600 dark:text-orange-400"><Bell className="h-3.5 w-3.5" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900 dark:text-white">Nearby Thermal Alerts</p><p className="text-[11px] text-slate-500 dark:text-slate-300">Alerts near your registered location</p></div><PreferenceSwitch label="Nearby Thermal Alerts" checked={preferences.enabled} onChange={(checked) => void savePreferences({ enabled: checked })} /></div>
          <div className="ml-3 space-y-2 border-l border-slate-200 dark:border-slate-800 py-1 pl-4">
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-red-500"/><div className="min-w-0 flex-1"><p className="text-xs font-bold text-red-700 dark:text-red-400">CRITICAL</p><p className="text-[11px] text-slate-500 dark:text-slate-300">25 km contextual perimeter</p></div><PreferenceSwitch label="Critical nearby notifications" checked={preferences.notify_critical} onChange={(checked) => void savePreferences({ notify_critical: checked })} /></div>
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-orange-500"/><div className="min-w-0 flex-1"><p className="text-xs font-bold text-orange-700 dark:text-orange-400">ABNORMAL</p><p className="text-[11px] text-slate-500 dark:text-slate-300">10 km contextual perimeter</p></div><PreferenceSwitch label="Abnormal nearby notifications" checked={preferences.notify_abnormal} onChange={(checked) => void savePreferences({ notify_abnormal: checked })} /></div>
            <div className="flex items-center gap-2 pt-1"><div className="grid h-5 w-5 place-items-center text-slate-600 dark:text-slate-300">{chimeEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />}</div><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Tactical Audio Chime</p><p className="text-[11px] text-slate-500 dark:text-slate-300">Dual-tone radar sound on alert</p></div><PreferenceSwitch label="Tactical audio chime" checked={chimeEnabled} onChange={toggleChime} /></div>
          </div>
          <div className="mt-2 grid gap-2 border-t border-slate-100 dark:border-slate-800 pt-2 sm:grid-cols-2">
            <div className="flex items-center gap-2"><LocateFixed className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-300"/><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Alert Location</p><p className="text-[11px] text-slate-500 dark:text-slate-300">{preferences.has_alert_location ? "Registered & perimeter active" : "Not registered"}</p></div><button className="min-h-8 shrink-0 rounded-md border border-slate-300 dark:border-slate-700 px-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-orange-300 dark:hover:border-orange-500 hover:text-orange-700 dark:hover:text-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" onClick={() => void saveLocation()}>Update</button></div>
            {(() => {
              const permission = typeof Notification === "undefined" ? "unsupported" : Notification.permission;
              const enabled = permission === "granted";
              return <div className="flex items-center justify-between rounded-md bg-slate-50 dark:bg-slate-800 px-2.5 py-2">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${enabled ? "bg-emerald-500" : permission === "denied" ? "bg-red-500" : "bg-amber-500"}`}/>
                  <div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Desktop Push</p>
                    <p className={`text-[10px] ${enabled ? "text-emerald-700 dark:text-emerald-300" : "text-slate-500 dark:text-slate-300"}`}>{enabled ? "Windows / Browser Active" : permission === "denied" ? "Disabled in browser" : "Permission required"}</p>
                  </div>
                </div>
                {!enabled && permission !== "denied" && (
                  <button onClick={() => void requestDesktopPermissionDirectly()} className="rounded border border-orange-300 dark:border-orange-600 bg-orange-50 dark:bg-orange-950/80 px-2 py-1 text-[10px] font-bold text-orange-700 dark:text-orange-300 hover:bg-orange-100">
                    Enable
                  </button>
                )}
              </div>;
            })()}
          </div>
          {status && <p role="status" className="mt-2 text-xs text-amber-700 dark:text-amber-400">{status}</p>}
        </div>}
        <div className="shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-start gap-2 border-b border-slate-100 dark:border-slate-800 px-4 py-2 text-[11px] leading-4 text-slate-500 dark:text-slate-300"><span className="flex-1">Notification radius is contextual relevance, not a danger or evacuation radius.</span><button type="button" aria-label="Nearby alert settings" title="Nearby alert settings" className="shrink-0 rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" onClick={() => setShowSettings((value) => !value)}><Settings2 className="h-4 w-4" /></button></div>
          <div className="flex gap-2 px-4 pt-3">
            <label className="relative min-w-0 flex-1"><span className="sr-only">Search nearby alerts</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search nearby alerts..." className="h-10 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 pl-9 pr-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900/50" /></label>
            <button type="button" disabled={!unread} onClick={() => void acknowledgeAll()} className="flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-orange-300 dark:border-orange-600 px-3 text-xs font-semibold text-orange-700 dark:text-orange-300 transition-colors hover:bg-orange-50 dark:hover:bg-orange-950/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:cursor-not-allowed disabled:border-slate-200 dark:disabled:border-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600"><CheckCheck className="h-4 w-4"/> Mark All Read</button>
          </div>
          <div className="flex flex-wrap gap-1.5 px-4 py-3" role="group" aria-label="Filter nearby alerts">
            {([['ALL', `All (${alerts.length})`], ['UNREAD', `Unread (${unread})`], ['READ', `Read (${read})`], ['CRITICAL', 'Critical'], ['ABNORMAL', 'Abnormal']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${filter === value ? "border-slate-800 bg-slate-800 dark:bg-orange-600 dark:border-orange-600 text-white" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-orange-300 hover:text-orange-700"}`}>{label}</button>)}
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin] bg-slate-50 dark:bg-slate-950">
          {alerts.length === 0 ? <div className="py-12 text-center"><BellOff className="mx-auto h-7 w-7 text-slate-400 dark:text-slate-500"/><p className="mt-3 font-semibold text-slate-800 dark:text-slate-100">No nearby alerts.</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Your area has no qualifying ThermoTrace thermal notifications during this period.</p></div> : visibleAlerts.length === 0 ? <div className="py-12 text-center"><Search className="mx-auto h-7 w-7 text-slate-400 dark:text-slate-500"/><p className="mt-3 font-semibold text-slate-800 dark:text-slate-100">No alerts match your search.</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Try another search term or filter.</p></div> : visibleAlerts.map((alert) => {
            const critical = alert.severity === "CRITICAL";
            return <article key={alert.id} className={`rounded-lg border bg-white dark:bg-slate-900 p-3.5 shadow-sm transition-shadow hover:shadow-md ${alert.is_read ? "border-slate-200 dark:border-slate-800" : critical ? "border-red-200 dark:border-red-800/70" : "border-orange-200 dark:border-orange-800/70"}`}>
              <div className="flex items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-[10px] font-extrabold tracking-wide ${critical ? "bg-red-50 dark:bg-red-950/90 text-red-700 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-800" : "bg-orange-50 dark:bg-orange-950/90 text-orange-700 dark:text-orange-300 ring-1 ring-orange-200 dark:ring-orange-800"}`}>{alert.severity}</span>
                {alert.is_downwind_hazard && (
                  <span className="flex items-center gap-1 rounded bg-amber-50 dark:bg-amber-950/90 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:text-amber-300 ring-1 ring-amber-300 dark:ring-amber-800">
                    <Wind className="h-3 w-3 text-amber-600 dark:text-amber-400" /> Downwind Hazard
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate font-mono text-[10px] font-bold text-slate-500 dark:text-slate-300" title={alert.event_id}>{alert.event_id}</span>
                <span className="shrink-0 text-[11px] text-slate-400 dark:text-slate-400">{relativeTime(alert.created_at)}</span>
              </div>
              <h3 className="mt-1.5 text-[13px] font-bold leading-5 text-slate-950 dark:text-white">{alert.title}</h3>
              {alert.message && <p className="mt-0.5 text-[11px] leading-[1.45] text-slate-600 dark:text-slate-300">{alert.message}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-100 dark:border-slate-800/80 pt-2 text-[10px] text-slate-500 dark:text-slate-300">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                  {alert.peak_frp_mw != null && <span className={`font-mono font-bold ${critical ? "text-red-700 dark:text-red-400" : "text-orange-700 dark:text-orange-400"}`}>{alert.peak_frp_mw.toFixed(1)} MW</span>}
                  {alert.classification && <span className="font-mono font-semibold text-slate-600 dark:text-slate-300">{alert.classification}</span>}
                  {alert.distance_km != null && <span className="font-semibold text-slate-700 dark:text-slate-200"><MapPin className="mr-0.5 inline h-3 w-3 text-slate-400 dark:text-slate-400"/> {alert.distance_km.toFixed(1)} km {alert.bearing_cardinal ? `(${alert.bearing_cardinal})` : ""}</span>}
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  <button aria-label={`View event ${alert.event_id} on map`} className="flex min-h-7 items-center justify-center gap-1 rounded-md border border-orange-300 dark:border-orange-700/80 bg-orange-50 dark:bg-orange-950/60 px-2.5 text-[10px] font-bold text-orange-700 dark:text-orange-300 transition-colors hover:bg-orange-100 dark:hover:bg-orange-900/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" onClick={() => void viewOnMap(alert)}><MapPin className="h-3 w-3"/> Show on Map</button>
                  {alert.is_read ? <span className="flex min-h-7 items-center gap-1 px-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300"><CircleCheck className="h-3.5 w-3.5"/> Read</span> : <button type="button" className="min-h-7 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2.5 text-[10px] font-bold text-slate-700 dark:text-slate-200 transition-colors hover:border-orange-300 dark:hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/60 hover:text-orange-700 dark:hover:text-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" onClick={() => void acknowledge(alert)}>Acknowledge</button>}
                </div>
              </div>
            </article>;
          })}
        </div>
      </section>
    </div>, document.body)}
  </>;
}
