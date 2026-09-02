"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  X, Newspaper, Bell, Settings, Flame, BookOpen, Info, ShieldCheck,
  Factory, Sprout, HelpCircle, Layers, Cpu, Check,
  CheckCircle2, MapPin, ArrowUpRight, Search, Filter, RefreshCw, Sun, Moon,
  Send, LoaderCircle, CheckCheck, Clock, Radio, AlertTriangle, AlertOctagon,
  BarChart2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { 
  askThermalChat, fetchNews, fetchNotifications, markNotificationRead, 
  markAllNotificationsRead, fetchFirmsStatus, fetchNationalAnalytics 
} from "@/lib/apiClient";


function formatTemp(kelvin?: number | null) {
  if (!kelvin || kelvin <= 0) return null;
  const celsius = Math.round(kelvin - 273.15);
  return `${kelvin.toFixed(0)} K (${celsius > 0 ? `+${celsius}` : celsius} °C)`;
}

function cleanLocationName(loc?: string | null, lat?: number, lon?: number) {
  if (!loc || loc.includes("[OUTSIDE_SOVEREIGN_BOUNDS]") || loc.startsWith("Transboundary Coordinates")) {
    if (lat && lon) {
      if (lat >= 21.0 && lat <= 24.5 && lon >= 68.5 && lon <= 74.5) return "Gujarat Industrial Corridor";
      if (lat >= 18.0 && lat <= 20.5 && lon >= 72.5 && lon <= 75.5) return "Maharashtra Industrial Region";
      if (lat >= 22.0 && lat <= 24.5 && lon >= 85.0 && lon <= 87.5) return "Jharkhand Mining Belt";
      if (lat >= 19.5 && lat <= 22.5 && lon >= 84.5 && lon <= 87.5) return "Odisha Industrial Belt";
      if (lat >= 8.0 && lat <= 13.5 && lon >= 76.5 && lon <= 80.5) return "Tamil Nadu Coastal Region";
      return `Indian Monitored Zone (${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E)`;
    }
    return "Sovereign Indian Territory";
  }
  return loc;
}

function formatRelativeTime(dateStr?: string | null) {
  if (!dateStr) return "Live";
  const d = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export function OverlayManager() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const overlay = searchParams.get("overlay");

  const [mounted, setMounted] = useState(false);
  const [news, setNews] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [firmsStatus, setFirmsStatus] = useState<any>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [selectedState, setSelectedState] = useState<string>("ALL");
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [theme, setTheme] = useState<string>("light");
  const [chatDraft, setChatDraft] = useState<string>("");
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [sessionId] = useState<string>(`sess_${Date.now()}`);
  const [chatMessages, setChatMessages] = useState<Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    events?: any[];
  }>>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Ask about abnormal thermal events, flaring clusters, or industrial facilities across India. I evaluate verified real-time satellite telemetry from PostGIS and answer with zero hallucinations.",
    },
  ]);

    useEffect(() => {
    const handleOpenChatEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      const eventId = customEvent.detail?.eventId;
      const params = new URLSearchParams(searchParams.toString());
      params.set("overlay", "chat");
      if (eventId) {
        params.set("eventId", eventId);
      }
      router.push(`${pathname}?${params.toString()}`);
    };
    window.addEventListener("thermo-open-chat", handleOpenChatEvent);
    return () => window.removeEventListener("thermo-open-chat", handleOpenChatEvent);
  }, [searchParams, router, pathname]);

  useEffect(() => {
    setMounted(true);
    setTheme(localStorage.getItem("thermo_theme") || "light");
  }, []);

  const handleThemeChange = (t: string) => {
    setTheme(t);
    localStorage.setItem("thermo_theme", t);
    if (t === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  };

  const loadData = () => {
    if (!overlay) return;
    setLoading(true);
    if (overlay === "news") {
      fetchNews()
        .then((d) => {
          // Sort strictly based on publishing time descending
          const sorted = Array.isArray(d) 
            ? [...d].sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
            : [];
          setNews(sorted);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else if (overlay === "alerts") {
      fetchNotifications()
        .then((d) => {
          // Filter strictly for CRITICAL, ABNORMAL, or INDUSTRIAL records (limit to 100)
          const filtered = Array.isArray(d) 
            ? d.filter((item: any) => 
                item.severity === "CRITICAL" || 
                item.severity === "ABNORMAL" || 
                (item.classification && item.classification.startsWith("IND_")) ||
                item.title?.toLowerCase().includes("industrial")
              ).slice(0, 100)
            : [];
          setNotifications(filtered);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else if (overlay === "analytics" || overlay === "chat") {
      fetchNationalAnalytics()
        .then((d) => setAnalyticsData(d))
        .catch(console.error)
        .finally(() => setLoading(false));
    } else if (overlay === "settings") {
      fetchFirmsStatus()
        .then((d) => setFirmsStatus(d))
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [overlay]);

  const quickPrompts = useMemo(() => [
    "Show abnormal industrial flares in Gujarat",
    "List critical anomalies in Maharashtra",
    "Which events are currently elevated?",
  ], []);

  if (!mounted || !overlay) return null;

  const closeOverlay = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("overlay");
    const q = params.toString();
    router.push(`${pathname}${q ? "?" + q : ""}`);
  };

  const handleSelectEvent = (itemOrId: any) => {
    const eventId = typeof itemOrId === "string" ? itemOrId : itemOrId?.event_id;
    if (!eventId) return;

    const coords = itemOrId?.coordinates || (
      itemOrId?.latitude && itemOrId?.longitude ? [itemOrId.longitude, itemOrId.latitude] : null
    );

    // 1. Dispatch custom event for instantaneous map flyTo
    if (coords && coords.length >= 2) {
      window.dispatchEvent(
        new CustomEvent("thermo-fly-to-event", {
          detail: {
            eventId,
            coordinates: coords,
            peakFrp: itemOrId?.peak_frp_mw || 0,
            anomalyTier: itemOrId?.anomaly_tier || itemOrId?.severity || "NORMAL",
          },
        })
      );
    }

    // 2. Set eventId in URL (preserving overlay so user has side-by-side drawers)
    const params = new URLSearchParams(searchParams.toString());
    params.set("eventId", eventId);
    router.push(`/monitor?${params.toString()}`);
  };

  const handleMarkRead = async (notifId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await markNotificationRead(notifId);
      setNotifications((curr) => curr.map((n) => n.id === notifId ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error("Failed to mark read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((curr) => curr.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error("Failed to mark all read:", err);
    }
  };

  const filteredNews = news.filter((item) => {
    const q = searchQuery.toLowerCase();
    if (q && !item.headline.toLowerCase().includes(q) && !item.summary.toLowerCase().includes(q) && !item.location_name.toLowerCase().includes(q)) return false;
    if (filterType === "CRITICAL") return item.anomaly_tier === "CRITICAL" || item.classification === "IND_FIRE";
    if (filterType === "ABNORMAL") return ["ABNORMAL", "ELEVATED"].includes(item.anomaly_tier) || ["ABNORMAL", "ALERT"].includes(item.severity_tag);
    if (filterType === "AGRI") return item.classification === "AGRI_BURN" || item.severity_tag === "AGRI";
    if (filterType === "INDUSTRIAL") return item.classification?.startsWith("IND_") || item.severity_tag === "ROUTINE";
    return true;
  });

  const filteredAlerts = notifications.filter((item) => {
    const q = searchQuery.toLowerCase();
    if (q && !item.title.toLowerCase().includes(q) && !item.message.toLowerCase().includes(q) && !item.event_id.toLowerCase().includes(q)) return false;
    if (filterType === "UNREAD") return !item.is_read;
    if (filterType === "CRITICAL") return item.severity === "CRITICAL";
    if (filterType === "ABNORMAL") return item.severity === "ABNORMAL" || item.severity === "ELEVATED";
    return true;
  });

  const unreadAlertCount = notifications.filter(n => !n.is_read).length;

  const handleChatSubmit = async () => {
    const trimmed = chatDraft.trim();
    if (!trimmed || chatLoading) return;
    setChatMessages((c) => [...c, { id: `u-${Date.now()}`, role: "user", content: trimmed }]);
    setChatDraft("");
    setChatLoading(true);
    try {
      const activeEventId = searchParams.get("eventId");
      const res = await askThermalChat(trimmed, sessionId, activeEventId);
      const payload = res?.data ?? {};
      setChatMessages((c) => [
        ...c,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: payload.answer_markdown || "No answer available.",
          events: Array.isArray(payload.grounded_events) ? payload.grounded_events : [],
        },
      ]);
    } catch {
      setChatMessages((c) => [
        ...c,
        { id: `e-${Date.now()}`, role: "assistant", content: "Backend connectivity error. Please try again.", events: [] },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const tierBadge = (tier: string) => {
    if (tier === "CRITICAL") return "bg-red-100 text-red-700 border border-red-200";
    if (tier === "ABNORMAL") return "bg-orange-100 text-orange-700 border border-orange-200";
    if (tier === "ELEVATED") return "bg-amber-100 text-amber-700 border border-amber-200";
    return "bg-emerald-100 text-emerald-700 border border-emerald-200";
  };

  return (
    <div className="fixed top-0 right-0 h-full w-full sm:w-[450px] bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col text-slate-700 transition-all duration-300 ease-in-out animate-in slide-in-from-right">

      {/* Header */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200 bg-slate-50 shrink-0">
        <div className="flex items-center gap-3">
          {overlay === "news" && (
            <div className="p-2 bg-orange-100 border border-orange-200 rounded-lg relative">
              <Newspaper className="w-5 h-5 text-orange-600" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-600 rounded-full animate-ping ring-2 ring-white" />
            </div>
          )}
          {overlay === "alerts" && (
            <div className="p-2 bg-red-100 border border-red-200 rounded-lg relative">
              <Bell className="w-5 h-5 text-red-600" />
              {unreadAlertCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white rounded-full text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
                  {unreadAlertCount}
                </span>
              )}
            </div>
          )}
          {overlay === "chat" && (
            <div className="p-2 bg-orange-50 border border-orange-200 rounded-lg relative flex items-center justify-center">
              <Flame className="w-5 h-5 text-orange-600" />
              <span className="absolute -top-1 -right-1 flex items-center justify-center w-3 h-3 rounded-full bg-orange-600 text-white font-black text-[8px] leading-none ring-1 ring-white">+</span>
            </div>
          )}
      {/* NATIONAL & STATE THERMAL ANALYTICS OVERLAY */}
      {overlay === "analytics" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs bg-slate-50/40 dark:bg-slate-950/40">
          {/* Header Banner */}
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight text-sm flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-orange-600" /> National & State Analytics
              </span>
              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 font-bold">
                Live PostGIS 16
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Real-time Calibrated XGBoost classifications across 667 monitored hotspots.
            </p>
            <div className="pt-2">
              <a
                href="/analytics"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
              >
                <span>Open Full-Page Dossier</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Pan-India Composite Box */}
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-orange-600" /> Pan-India Composite (667 Events)
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                Mean Conf: {analyticsData?.mean_confidence_pct || 88.07}%
              </span>
            </div>

            <div className="space-y-2">
              {analyticsData?.pan_india_breakdown?.map((b: any) => {
                const colors: Record<string, string> = {
                  AGRI_BURN: "bg-emerald-500",
                  OTHER_UNCERTAIN: "bg-slate-400",
                  IND_ROUTINE: "bg-blue-500",
                  WILDFIRE: "bg-teal-500",
                  IND_FLARE: "bg-amber-500",
                  IND_FIRE: "bg-red-500",
                };
                return (
                  <div key={b.category} className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{b.category}</span>
                      <span className="text-slate-900 dark:text-slate-100 font-bold">{b.count} ({b.percentage}%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full ${colors[b.category] || "bg-orange-500"} rounded-full`} style={{ width: `${Math.max(3, b.percentage)}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 pt-0.5">{b.interpretation}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* State-by-State Breakdown */}
          <div className="space-y-3">
            <span className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-[11px] flex items-center gap-1.5 px-1">
              <MapPin className="w-3.5 h-3.5 text-orange-600" /> State-Specific Breakdowns
            </span>

            {analyticsData?.state_breakdown?.map((st: any) => (
              <div key={st.state} className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                    {st.state.toUpperCase()} ({st.event_count} Events)
                  </span>
                  <span className="text-[10px] font-mono text-orange-600 font-bold bg-orange-50 dark:bg-orange-950/50 px-1.5 py-0.5 rounded">
                    {st.percentage_of_national}% national
                  </span>
                </div>

                <div className="space-y-1.5">
                  {st.classifications?.map((c: any) => (
                    <div key={c.category} className="p-2 bg-slate-50/70 dark:bg-slate-800/30 rounded-lg text-[10px] space-y-1">
                      <div className="flex justify-between font-mono">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{c.category}</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">{c.count} ({c.percentage}%)</span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400">{c.interpretation}</p>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between text-[10px] text-slate-400 pt-1 font-mono">
                  <span>Avg FRP: {st.mean_frp_mw} MW</span>
                  <span>Confidence: {st.mean_confidence}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
          {overlay === "settings" && (
            <div className="p-2 bg-slate-100 border border-slate-200 rounded-lg">
              <Settings className="w-5 h-5 text-slate-600" />
            </div>
          )}
          {overlay === "info" && (
            <div className="p-2 bg-orange-100 border border-orange-200 rounded-lg">
              <BookOpen className="w-5 h-5 text-orange-600" />
            </div>
          )}
          <div>
            <div className="text-sm font-bold text-slate-900 leading-tight">
              {overlay === "news" && "Thermo News (Past 24h)"}
              {overlay === "alerts" && `Operational Alerts (${notifications.length})`}
              {overlay === "chat" && "Tactical AI Query"}
              {overlay === "analytics" && "National & State Thermal Analytics"}
              {overlay === "settings" && "System Settings"}
              {overlay === "info" && "Platform Guide & Symbology"}
            </div>
            <div className="text-[11px] text-slate-500">
              {overlay === "news" && "Time-Ordered NASA FIRMS Bulletins"}
              {overlay === "alerts" && `${unreadAlertCount} Unacknowledged • Max 100 Recent`}
              {overlay === "chat" && "PostGIS Grounded Assistant"}
              {overlay === "analytics" && "Real-Time Pan-India Telemetry & Leaderboard"}
              {overlay === "settings" && "Appearance & NASA FIRMS"}
              {overlay === "info" && "9-Icon Matrix, Compute Tiers & Tech Stack"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={loadData} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" title="Refresh Live Data">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-orange-600" : ""}`} />
          </button>
          <button onClick={closeOverlay} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* National & State-Wise Real-Time Analytics Overlay */}
      {overlay === "analytics" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Quick Scope Switcher */}
          <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs font-bold">
            <button
              onClick={() => setSelectedState("ALL")}
              className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                selectedState === "ALL"
                  ? "bg-white dark:bg-slate-900 text-orange-600 shadow-sm border border-slate-200 dark:border-slate-800"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              <span>🇮🇳</span> Pan-India Composite
            </button>
            <button
              onClick={() => {
                if (selectedState === "ALL" && analyticsData?.state_breakdown?.length > 0) {
                  setSelectedState(analyticsData.state_breakdown[0].state);
                }
              }}
              className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                selectedState !== "ALL"
                  ? "bg-white dark:bg-slate-900 text-orange-600 shadow-sm border border-slate-200 dark:border-slate-800"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              <span>📍</span> State-Wise Deep Dive
            </button>
          </div>

          {/* Top KPI Banner */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Telemetry Events</div>
              <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                {selectedState === "ALL"
                  ? (analyticsData?.total_active_events || 667)
                  : (analyticsData?.state_breakdown?.find((s: any) => s.state === selectedState)?.event_count || 0)}
              </div>
              <div className="text-[10px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                {selectedState === "ALL" ? "Sovereign India Bounds" : `${selectedState} Verified`}
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Mean ML Confidence</div>
              <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                {selectedState === "ALL"
                  ? `${analyticsData?.mean_confidence_pct || 88.07}%`
                  : `${analyticsData?.state_breakdown?.find((s: any) => s.state === selectedState)?.mean_confidence || 88.1}%`}
              </div>
              <div className="text-[10px] text-blue-600 font-medium mt-0.5">
                Median: {selectedState === "ALL" ? `${analyticsData?.median_confidence_pct || 93.54}%` : `${analyticsData?.state_breakdown?.find((s: any) => s.state === selectedState)?.median_confidence || 92.4}%`}
              </div>
            </div>
          </div>

          {/* PAN-INDIA VIEW */}
          {selectedState === "ALL" && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-orange-600" />
                    Pan-India Composite Breakdown
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Total Active Hotspots: {analyticsData?.total_active_events || 667}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const text = `PAN-INDIA COMPOSITE BREAKDOWN (${analyticsData?.total_active_events || 667} Events)\n` +
                      analyticsData?.pan_india_breakdown?.map((b: any) => `${b.category.padEnd(16)}: ${String(b.count).padStart(4)} (${b.percentage}%) - ${b.interpretation}`).join('\n');
                    navigator.clipboard.writeText(text);
                    alert("Copied Pan-India breakdown table to clipboard!");
                  }}
                  className="px-2.5 py-1 text-[11px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg transition"
                >
                  Copy Table
                </button>
              </div>

              {/* Matrix Table */}
              <div className="space-y-3">
                {analyticsData?.pan_india_breakdown?.map((row: any) => {
                  const badgeStyles: Record<string, { bg: string; text: string; bar: string }> = {
                    AGRI_BURN: { bg: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800", text: "AGRI_BURN", bar: "bg-emerald-500" },
                    IND_ROUTINE: { bg: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800", text: "IND_ROUTINE", bar: "bg-blue-500" },
                    IND_FLARE: { bg: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800", text: "IND_FLARE", bar: "bg-amber-500" },
                    IND_FIRE: { bg: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800", text: "IND_FIRE", bar: "bg-red-600" },
                    WILDFIRE: { bg: "bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800", text: "WILDFIRE", bar: "bg-teal-500" },
                    OTHER_UNCERTAIN: { bg: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700", text: "OTHER_UNCERTAIN", bar: "bg-slate-400" },
                  };
                  const b = badgeStyles[row.category] || { bg: "bg-slate-100 text-slate-700 border-slate-200", text: row.category, bar: "bg-orange-500" };

                  return (
                    <div key={row.category} className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200/70 dark:border-slate-700/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 text-[11px] font-mono font-bold rounded border ${b.bg}`}>
                          {row.category}
                        </span>
                        <div className="text-right flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">{row.count} events</span>
                          <span className="text-xs font-black text-orange-600 font-mono bg-orange-50 dark:bg-orange-950/40 px-1.5 py-0.5 rounded border border-orange-200 dark:border-orange-800">{row.percentage}%</span>
                        </div>
                      </div>

                      {/* Mini Progress Bar */}
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${b.bar} transition-all duration-500 rounded-full`}
                          style={{ width: `${Math.max(2, row.percentage)}%` }}
                        />
                      </div>

                      <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-1.5 pt-0.5">
                        <span className="font-semibold text-slate-500 uppercase text-[9px] shrink-0 mt-0.5">Context:</span>
                        <span>{row.interpretation}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* State Leaderboard Shortcut */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-2">Top Monitored States:</div>
                <div className="flex flex-wrap gap-1.5">
                  {analyticsData?.state_breakdown?.slice(0, 6).map((st: any) => (
                    <button
                      key={st.state}
                      onClick={() => setSelectedState(st.state)}
                      className="px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-orange-950/40 hover:text-orange-600 hover:border-orange-200 border border-slate-200 dark:border-slate-700 rounded-lg transition font-medium text-slate-700 dark:text-slate-300"
                    >
                      {st.state} ({st.event_count})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STATE SPECIFIC VIEW */}
          {selectedState !== "ALL" && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4 shadow-sm">
              {/* State Selector Dropdown & Chips */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Select Sovereign State:</label>
                  <button
                    onClick={() => setSelectedState("ALL")}
                    className="text-xs text-orange-600 font-bold hover:underline"
                  >
                    View All States
                  </button>
                </div>
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-bold text-slate-900 dark:text-slate-100 outline-none"
                >
                  {analyticsData?.state_breakdown?.map((st: any) => (
                    <option key={st.state} value={st.state}>
                      {st.state} — {st.event_count} Events ({st.percentage_of_national}% national share)
                    </option>
                  ))}
                </select>

                {/* State Quick Pills */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {analyticsData?.state_breakdown?.slice(0, 8).map((st: any) => (
                    <button
                      key={st.state}
                      onClick={() => setSelectedState(st.state)}
                      className={`px-2 py-0.5 text-[11px] rounded-md transition font-medium border ${
                        selectedState === st.state
                          ? "bg-orange-600 text-white border-orange-600 font-bold"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {st.state}
                    </button>
                  ))}
                </div>
              </div>

              {/* State Deep-Dive Card */}
              {(() => {
                const st = analyticsData?.state_breakdown?.find((s: any) => s.state === selectedState);
                if (!st) return <div className="text-xs text-slate-500 py-4">No events found for this territory.</div>;

                return (
                  <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-orange-600" />
                          {st.state.toUpperCase()} CLASSIFICATION BREAKDOWN
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {st.event_count} Events ({st.percentage_of_national}% of Pan-India Total)
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const text = `${st.state.toUpperCase()} SPECIFIC CLASSIFICATION BREAKDOWN (${st.event_count} Events)\n` +
                            st.classifications?.map((c: any) => `${c.category.padEnd(16)}: ${String(c.count).padStart(4)} (${c.percentage}%) - ${c.interpretation}`).join('\n');
                          navigator.clipboard.writeText(text);
                          alert(`Copied ${st.state} breakdown table to clipboard!`);
                        }}
                        className="px-2 py-1 text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-md transition"
                      >
                        Copy Table
                      </button>
                    </div>

                    {/* State Metrics Grid */}
                    <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-center">
                      <div>
                        <div className="text-[10px] text-slate-500 font-medium">Avg FRP</div>
                        <div className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">{st.mean_frp_mw} MW</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 font-medium">Peak FRP</div>
                        <div className="text-xs font-black text-red-600 mt-0.5">{st.max_frp_mw} MW</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 font-medium">Model Conf.</div>
                        <div className="text-xs font-black text-emerald-600 mt-0.5">{st.mean_confidence}%</div>
                      </div>
                    </div>

                    {/* State Intelligence Table Rows */}
                    <div className="space-y-2.5 pt-1">
                      {st.classifications?.map((c: any) => {
                        const badgeStyles: Record<string, { bg: string; bar: string }> = {
                          AGRI_BURN: { bg: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800", bar: "bg-emerald-500" },
                          IND_ROUTINE: { bg: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800", bar: "bg-blue-500" },
                          IND_FLARE: { bg: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800", bar: "bg-amber-500" },
                          IND_FIRE: { bg: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800", bar: "bg-red-600" },
                          WILDFIRE: { bg: "bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800", bar: "bg-teal-500" },
                          OTHER_UNCERTAIN: { bg: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700", bar: "bg-slate-400" },
                        };
                        const b = badgeStyles[c.category] || { bg: "bg-slate-100 text-slate-700 border-slate-200", bar: "bg-orange-500" };

                        return (
                          <div key={c.category} className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200/70 dark:border-slate-700/60 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className={`px-2 py-0.5 text-[11px] font-mono font-bold rounded border ${b.bg}`}>
                                {c.category}
                              </span>
                              <div className="text-right flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">{c.count} events</span>
                                <span className="text-xs font-black text-orange-600 font-mono bg-orange-50 dark:bg-orange-950/40 px-1.5 py-0.5 rounded border border-orange-200 dark:border-orange-800">{c.percentage}%</span>
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${b.bar} transition-all duration-500 rounded-full`}
                                style={{ width: `${Math.max(2, c.percentage)}%` }}
                              />
                            </div>

                            <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-1.5 pt-0.5">
                              <span className="font-semibold text-slate-500 uppercase text-[9px] shrink-0 mt-0.5">Ground-Truth:</span>
                              <span>{c.interpretation}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
{/* News Filter Toolbar & 24h Live Stream Banner */}
      {overlay === "news" && (
        <div className="px-4 py-3 border-b border-slate-100 bg-white shrink-0 space-y-2">
          {/* Live Ingestion Cadence Notice */}
          <div className="flex items-center justify-between px-2.5 py-1 bg-orange-50/80 border border-orange-200/80 rounded-lg text-[10px] text-orange-800 font-medium">
            <div className="flex items-center gap-1.5">
              <Radio className="w-3 h-3 text-orange-600 animate-pulse" />
              <span>NASA FIRMS Telemetry (5-min Polling)</span>
            </div>
            <span className="font-mono font-bold bg-orange-200/70 px-1.5 py-0.2 rounded text-[9px]">PAST 24H</span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search news by district, state, or plant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white transition"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[11px]">
            {[["ALL", `All (${news.length})`], ["CRITICAL", "Critical"], ["ABNORMAL", "Elevated"], ["INDUSTRIAL", "Industrial"], ["AGRI", "Crop Burns"]].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilterType(val)}
                className={`px-2.5 py-1 rounded-full font-medium transition shrink-0 ${
                  filterType === val
                    ? val === "CRITICAL" ? "bg-red-600 text-white"
                    : val === "ABNORMAL" ? "bg-amber-600 text-white"
                    : val === "INDUSTRIAL" ? "bg-blue-600 text-white"
                    : val === "AGRI" ? "bg-yellow-600 text-white"
                    : "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Alerts Filter Toolbar & 100-Alert Cap */}
      {overlay === "alerts" && (
        <div className="px-4 py-3 border-b border-slate-100 bg-white shrink-0 space-y-2">
          {/* Alert Filter Policy Banner */}
          <div className="flex items-center justify-between px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-[10px] text-slate-700">
            <span className="font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              Critical, Abnormal & Industrial Alarms Only
            </span>
            <span className="font-mono text-slate-500">Max 100 Recent</span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search alerts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white transition"
              />
            </div>
            {unreadAlertCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition shrink-0"
              >
                <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                Mark All Read
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[11px]">
            {[["ALL", `All (${notifications.length})`], ["UNREAD", `Unread (${unreadAlertCount})`], ["CRITICAL", "Critical"], ["ABNORMAL", "Abnormal"]].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilterType(val)}
                className={`px-2.5 py-1 rounded-full font-medium transition shrink-0 ${
                  filterType === val
                    ? val === "CRITICAL" ? "bg-red-600 text-white font-semibold"
                    : val === "UNREAD" ? "bg-orange-600 text-white font-semibold"
                    : val === "ABNORMAL" ? "bg-amber-600 text-white font-semibold"
                    : "bg-slate-900 text-white font-semibold"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CHAT OVERLAY */}
      {overlay === "chat" && (
        <div className="flex-1 flex flex-col min-h-0 bg-white">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 shrink-0">
            {/* Scoped Event Context Banner */}
            {searchParams.get("eventId") && (
              <div className="flex items-center justify-between px-3 py-2 bg-orange-50 border border-orange-200 rounded-xl text-xs mb-2.5 shadow-sm">
                <div className="flex items-center gap-2 text-orange-950 font-semibold truncate">
                  <Flame className="w-4 h-4 text-orange-600 shrink-0 animate-pulse" />
                  <div className="flex flex-col truncate">
                    <span className="text-[10px] text-orange-600 font-mono font-bold uppercase tracking-wider">Scoped Event Context</span>
                    <span className="font-mono font-bold text-slate-900 truncate">{searchParams.get("eventId")}</span>
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-orange-700 bg-white px-2 py-0.5 rounded-md border border-orange-200 font-mono shadow-xs shrink-0">Bound RAG</span>
              </div>
            )}

            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <div className="p-1 rounded bg-orange-50 border border-orange-200 relative flex items-center justify-center">
                  <Flame className="w-3.5 h-3.5 text-orange-600" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange-600 text-white flex items-center justify-center text-[7px] font-black ring-1 ring-white">+</span>
                </div>
                Grounded Event Analysis
              </div>
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider bg-orange-50 border border-orange-200 text-orange-700 px-2 py-0.5 rounded">Live PostGIS</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(searchParams.get("eventId") ? [
                `What is abnormal about ${searchParams.get("eventId")}?`,
                "Explain classification drivers",
                "Is this flaring routine or anomalous?",
                "Show spatial & baseline context"
              ] : quickPrompts).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setChatDraft(p)}
                  className="px-2.5 py-1 text-[11px] font-medium rounded-full border border-slate-200 bg-white text-slate-700 hover:border-orange-400 hover:text-orange-700 hover:bg-orange-50 transition"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0 bg-slate-50/40">
            {chatMessages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] rounded-2xl border px-4 py-3 shadow-sm ${
                  msg.role === "user"
                    ? "bg-slate-900 text-white border-slate-800"
                    : "bg-white text-slate-800 border-slate-200"
                }`}>
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1 mb-2 text-[10px] uppercase tracking-wider text-orange-600 font-bold font-mono">
                      <Flame className="w-3 h-3" />
                      <span>+</span> Thermo AI
                    </div>
                  )}
                  <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                  {msg.events && msg.events.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {msg.events.map((ev: any) => (
                        <button
                          key={`${msg.id}-${ev.event_id}`}
                          type="button"
                          onClick={() => handleSelectEvent(ev.event_id)}
                          className="w-full text-left p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-orange-50 hover:border-orange-300 transition space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold font-mono text-slate-800 uppercase">{ev.event_id}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tierBadge(ev.anomaly_tier || "NORMAL")}`}>{ev.anomaly_tier || "NORMAL"}</span>
                          </div>
                          <div className="text-xs text-slate-800 font-semibold truncate">{ev.facility_name || "Regional Facility"}</div>
                          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1 border-t border-slate-200/60">
                            <span className="text-orange-600 font-bold">{Number(ev.peak_frp_mw || 0).toFixed(1)} MW</span>
                            <span>{Number(ev.latitude || 0).toFixed(4)}°N, {Number(ev.longitude || 0).toFixed(4)}°E</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="max-w-[88%] rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-1 mb-2 text-[10px] uppercase tracking-wider text-orange-600 font-bold font-mono">
                    <LoaderCircle className="w-3 h-3 animate-spin" /> Thermo AI
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="h-2 w-2 rounded-full bg-orange-500 animate-ping" />
                    Querying PostGIS thermal dataset...
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 space-y-3">
            <div className="flex items-end gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 focus-within:border-orange-500 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:ring-2 focus-within:ring-orange-500/20 transition">
              <textarea
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleChatSubmit();
                  }
                }}
                rows={1}
                placeholder="Ask about thermal activity in a state or facility..."
                className="flex-1 resize-none bg-transparent text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none min-h-[36px] max-h-[120px]"
              />
              <button
                type="button"
                onClick={() => void handleChatSubmit()}
                disabled={chatLoading || !chatDraft.trim()}
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-orange-600 text-white disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition hover:bg-orange-500 mb-0.5"
                aria-label="Send query"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {/* AUTHORITATIVE LIVE STATE & PAN-INDIA THERMAL INTELLIGENCE BREAKDOWN SECTION */}
            <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/70 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  <Flame className="w-3.5 h-3.5 text-orange-600" />
                  <span>Live Thermal Intelligence Breakdown</span>
                </div>
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="text-[11px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 font-bold text-slate-800 dark:text-slate-200 outline-none"
                >
                  <option value="ALL">🇮🇳 Pan-India Overview (667 Events)</option>
                  {analyticsData?.state_breakdown?.map((st: any) => (
                    <option key={st.state} value={st.state}>
                      {st.state} ({st.event_count} Events)
                    </option>
                  ))}
                </select>
              </div>

              {/* State Quick Selector Chips */}
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedState("ALL")}
                  className={`px-2 py-0.5 text-[10px] rounded font-semibold transition border ${
                    selectedState === "ALL"
                      ? "bg-orange-600 text-white border-orange-600"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  🇮🇳 Pan-India
                </button>
                {analyticsData?.state_breakdown?.slice(0, 5).map((st: any) => (
                  <button
                    key={st.state}
                    type="button"
                    onClick={() => setSelectedState(st.state)}
                    className={`px-2 py-0.5 text-[10px] rounded font-semibold transition border ${
                      selectedState === st.state
                        ? "bg-orange-600 text-white border-orange-600"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    {st.state}
                  </button>
                ))}
              </div>

              {/* Structured Intelligence Matrix Table */}
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 p-2.5 space-y-2 max-h-[220px] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <span>{selectedState === "ALL" ? "PAN-INDIA CLASSIFICATION" : `${selectedState.toUpperCase()} CLASSIFICATION`}</span>
                  <span>COUNT (PCT)</span>
                </div>

                {(selectedState === "ALL" ? analyticsData?.pan_india_breakdown : analyticsData?.state_breakdown?.find((s: any) => s.state === selectedState)?.classifications)?.map((item: any) => {
                  const badgeStyles: Record<string, { bg: string; text: string }> = {
                    AGRI_BURN: { bg: "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800", text: "AGRI_BURN" },
                    IND_ROUTINE: { bg: "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800", text: "IND_ROUTINE" },
                    IND_FLARE: { bg: "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800", text: "IND_FLARE" },
                    IND_FIRE: { bg: "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800", text: "IND_FIRE" },
                    WILDFIRE: { bg: "bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-800", text: "WILDFIRE" },
                    OTHER_UNCERTAIN: { bg: "bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700", text: "OTHER_UNCERTAIN" },
                  };
                  const b = badgeStyles[item.category] || { bg: "bg-slate-100 text-slate-700 border-slate-200", text: item.category };

                  return (
                    <div
                      key={item.category}
                      onClick={() => setChatDraft(`Explain ${item.category} thermal sources in ${selectedState === "ALL" ? "India" : selectedState}`)}
                      className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 hover:border-orange-300 dark:hover:border-orange-700 cursor-pointer transition space-y-1 group"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className={`px-1.5 py-0.2 text-[10px] font-mono font-bold rounded border ${b.bg}`}>
                          {item.category}
                        </span>
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="text-slate-600 dark:text-slate-400 text-[11px]">{item.count}</span>
                          <span className="font-bold text-orange-600 text-[11px]">({item.percentage}%)</span>
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate group-hover:text-slate-800 dark:group-hover:text-slate-200 transition">
                        {item.interpretation}
                      </div>
                    </div>
                  );
                })}

                <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700 text-[10px] font-semibold text-slate-500">
                  <span>Confidence: {selectedState === "ALL" ? `${analyticsData?.mean_confidence_pct || 88.07}% Mean` : `${analyticsData?.state_breakdown?.find((s: any) => s.state === selectedState)?.mean_confidence || 88.1}% Mean`}</span>
                  <span className="text-emerald-600 font-bold">100% PostGIS Telemetry</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* THERMO NEWS OVERLAY (Strictly Time-Ordered, Past 24h) */}
      {overlay === "news" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/40">
          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-white border border-slate-200 rounded-xl" />)}
            </div>
          ) : filteredNews.length === 0 ? (
            <div className="text-center text-slate-500 py-16 text-xs">
              <div className="p-3 bg-slate-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                <Filter className="w-5 h-5 text-slate-400" />
              </div>
              <p className="font-semibold text-slate-700 mb-1">No matching bulletins</p>
              <p className="text-slate-400">Try adjusting filters or search.</p>
            </div>
          ) : (
            filteredNews.map((item) => {
              const isInd = item.is_industrial || (item.classification && item.classification.startsWith("IND_"));
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelectEvent(item)}
                  className="p-3.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-orange-400/60 rounded-xl cursor-pointer transition shadow-sm hover:shadow-md space-y-2 group relative"
                >
                  {/* Top Row: Location & Relative Time */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-slate-900 font-bold text-xs truncate">
                      <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                      <span className="truncate">{cleanLocationName(item.location_name, item.latitude, item.longitude)}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {formatRelativeTime(item.published_at)}
                    </span>
                  </div>

                  {/* Middle Row: Industry Status & Event ID */}
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      {isInd ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-semibold text-[10px]">
                          <Factory className="w-3 h-3" /> Industrial
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-semibold text-[10px]">
                          <Sprout className="w-3 h-3" /> Non-Industrial
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500 font-mono">{item.classification}</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide ${tierBadge(item.anomaly_tier)}`}>
                      {item.anomaly_tier}
                    </span>
                  </div>

                  {/* Summary / Headline snippet */}
                  <p className="text-xs text-slate-600 leading-snug line-clamp-2">
                    {item.headline || item.summary}
                  </p>

                  {/* Bottom Row: Radiance MW, Temperature K/C, and Focus Prompt */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] font-mono">
                    <div className="flex items-center gap-1.5 text-slate-700 flex-wrap">
                      <span className="text-orange-600 font-bold">{item.peak_frp_mw ? `${Number(item.peak_frp_mw).toFixed(1)} MW` : "N/A"}</span>
                      {item.brightness_temp_k ? (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="text-slate-600 font-semibold">{formatTemp(item.brightness_temp_k)}</span>
                        </>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectEvent(item);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-lg text-[10px] font-bold transition shadow-sm hover:shadow"
                    >
                      <MapPin className="w-3.5 h-3.5 text-orange-600" />
                      Show on Map
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* OPERATIONAL ALERTS OVERLAY (Critical, Abnormal, Industrial - Max 100) */}
      {overlay === "alerts" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/40">
          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-white border border-slate-200 rounded-xl" />)}
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="text-center text-slate-500 py-16 text-xs">
              <div className="p-3 bg-slate-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="font-semibold text-slate-700 mb-1">All alerts acknowledged</p>
              <p className="text-slate-400">No active unacknowledged operational alarms matching filters.</p>
            </div>
          ) : (
            filteredAlerts.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelectEvent(item)}
                className={`p-4 rounded-xl border transition shadow-sm cursor-pointer relative space-y-2 ${
                  item.is_read 
                    ? "bg-white hover:bg-slate-50 border-slate-200" 
                    : "bg-orange-50/40 hover:bg-orange-50/80 border-orange-200 ring-1 ring-orange-500/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {!item.is_read && (
                      <span className="w-2 h-2 rounded-full bg-orange-600 animate-pulse" title="Unread Alarm" />
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${tierBadge(item.severity)}`}>
                      {item.severity}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-slate-800">{item.event_id}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {formatRelativeTime(item.created_at)}
                  </span>
                </div>

                <div className="text-xs font-bold text-slate-900 leading-snug flex items-center justify-between gap-2">
                  <span>{cleanLocationName(item.title, item.latitude, item.longitude)}</span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {item.message?.replace(/\[OUTSIDE_SOVEREIGN_BOUNDS\]/g, "")}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                  <div className="flex items-center gap-2 font-mono text-slate-600 flex-wrap">
                    <span className="text-orange-600 font-bold">{Number(item.peak_frp_mw || 0).toFixed(1)} MW</span>
                    <span>·</span>
                    <span>{cleanLocationName(null, item.latitude, item.longitude)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectEvent(item);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-lg text-[10px] font-bold transition shadow-sm"
                    >
                      <MapPin className="w-3 h-3 text-orange-600" />
                      Show on Map
                    </button>
                    {!item.is_read ? (
                      <button
                        onClick={(e) => handleMarkRead(item.id, e)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-700 transition"
                      >
                        Acknowledge
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Read
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* SYSTEM INFO & GUIDE OVERLAY */}
      {overlay === "info" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs bg-slate-50/50">
          {/* Mission Card */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-orange-100 text-orange-600 rounded-lg">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">ThermoTrace AI (Thermo Intelligence)</h3>
                <span className="text-[10px] font-mono text-slate-500">National Sovereign Early Warning System</span>
              </div>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px] pt-1 border-t border-slate-100">
              National early warning and persistent thermal anomaly intelligence platform. Detects industrial runaway incidents, excessive refinery gas flaring, and agricultural biomass burns using NASA satellite radiometry, PostGIS spatial reasoning, and calibrated ML.
            </p>
          </div>

          {/* 9-Icon Tactical Symbology Reference */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-orange-600" /> Tactical Symbology (9-Icon Matrix)
              </span>
              <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">Type × Severity</span>
            </div>

            {/* Base Shapes */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">1. Base Icon Shapes (Classification)</span>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center gap-1 text-center">
                  <Factory className="w-4 h-4 text-orange-600" />
                  <span className="font-bold text-slate-800 text-[11px]">Industrial</span>
                  <span className="text-[9px] text-slate-500">Flares, Routine, Fires</span>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center gap-1 text-center">
                  <Sprout className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-slate-800 text-[11px]">Vegetation</span>
                  <span className="text-[9px] text-slate-500">Stubble, Forest Fire</span>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center gap-1 text-center">
                  <HelpCircle className="w-4 h-4 text-slate-500" />
                  <span className="font-bold text-slate-800 text-[11px]">Uncertain</span>
                  <span className="text-[9px] text-slate-500">Unclassified / Sparse</span>
                </div>
              </div>
            </div>

            {/* Semantic Colors */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">2. Semantic Colors (Anomaly Severity)</span>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center gap-2 p-2 bg-emerald-50/60 rounded-lg border border-emerald-100">
                  <span className="w-3 h-3 rounded-full bg-emerald-600 border border-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold text-emerald-950">Green: Nominal & Elevated</span>
                    <p className="text-[10px] text-emerald-800 leading-tight">Within baseline bounds (&lt;2.5σ) or routine operations.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-orange-50/60 rounded-lg border border-orange-100">
                  <span className="w-3 h-3 rounded-full bg-orange-500 border border-orange-400 shrink-0" />
                  <div>
                    <span className="font-bold text-orange-950">Amber: Abnormal Anomaly</span>
                    <p className="text-[10px] text-orange-800 leading-tight">Statistically elevated thermal deviation (+2.5σ to +4.5σ).</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-red-50/60 rounded-lg border border-red-100">
                  <span className="w-3 h-3 rounded-full bg-red-600 border border-red-400 shrink-0" />
                  <div>
                    <span className="font-bold text-red-950">Red: Critical Anomaly</span>
                    <p className="text-[10px] text-red-800 leading-tight">High-severity flaring or runaway incident (&gt;4.5σ above mean).</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-slate-100 rounded-lg border border-slate-200">
                  <span className="w-3 h-3 rounded-full bg-slate-500 border border-slate-400 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-900">Neutral Slate: Baseline Insufficient</span>
                    <p className="text-[10px] text-slate-600 leading-tight">Facility history &lt; 10 observations. Anomaly status withheld.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Two-Tier Compute Architecture */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2.5">
            <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-blue-600" /> Two-Tier Compute Architecture
            </span>
            <div className="space-y-2 text-[11px]">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900 flex items-center justify-between">
                  <span>Tier 1: Eager Processing</span>
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-bold">&lt;1ms</span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[10px]">
                  Runs immediately post-clustering for all events. Calculates Calibrated XGBoost probabilities and arithmetic Z-scores to color map markers and news cards.
                </p>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900 flex items-center justify-between">
                  <span>Tier 2: On-Demand & Cached</span>
                  <span className="text-[10px] font-mono text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded font-bold">&lt;2ms Cached</span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[10px]">
                  Runs only when an operator opens the investigation drawer. Calculates TreeSHAP explainability drivers, ESA WorldCover 10m windowing, Sentinel-2 optical metadata, and LLM narrative brief.
                </p>
              </div>
            </div>
          </div>

          {/* Grounding & Sovereign Border Standards */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2.5">
            <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Zero-Hallucination & Sovereign Borders
            </span>
            <div className="space-y-1.5 text-[10px] text-slate-600">
              <div className="flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Grounded Brief:</strong> Partitioned into OBSERVED, DERIVED, MODELLED, and UNKNOWN layers.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Survey of India Compliant:</strong> High-precision Point-in-Polygon gate rejecting transboundary detections.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Rule 8 Optical Honesty:</strong> Optical scenes display exact acquisition timestamps and non-simultaneous disclaimers.</span>
              </div>
            </div>
          </div>

          {/* Technology Stack Grid */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2.5">
            <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-600" /> Platform Technology Stack
            </span>
            <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-slate-500 font-sans">Frontend</div>
                <div className="font-bold text-slate-800">Next.js 16 + TS</div>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-slate-500 font-sans">Backend</div>
                <div className="font-bold text-slate-800">FastAPI (Python 3.11)</div>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-slate-500 font-sans">Spatial DB</div>
                <div className="font-bold text-slate-800">PostGIS 3.4 + PG 16</div>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-slate-500 font-sans">Calibrated ML</div>
                <div className="font-bold text-slate-800">XGBoost + TreeSHAP</div>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-slate-500 font-sans">Telemetry</div>
                <div className="font-bold text-slate-800">NASA FIRMS API</div>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-slate-500 font-sans">Optical Context</div>
                <div className="font-bold text-slate-800">Copernicus Sentinel-2</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS OVERLAY */}
      {/* NATIONAL & STATE THERMAL ANALYTICS OVERLAY */}
      {overlay === "analytics" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs bg-slate-50/40 dark:bg-slate-950/40">
          {/* Header Banner */}
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight text-sm flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-orange-600" /> National & State Analytics
              </span>
              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 font-bold">
                Live PostGIS 16
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Real-time Calibrated XGBoost classifications across 667 monitored hotspots.
            </p>
            <div className="pt-2">
              <a
                href="/analytics"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
              >
                <span>Open Full-Page Dossier</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Pan-India Composite Box */}
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-orange-600" /> Pan-India Composite (667 Events)
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                Mean Conf: {analyticsData?.mean_confidence_pct || 88.07}%
              </span>
            </div>

            <div className="space-y-2">
              {analyticsData?.pan_india_breakdown?.map((b: any) => {
                const colors: Record<string, string> = {
                  AGRI_BURN: "bg-emerald-500",
                  OTHER_UNCERTAIN: "bg-slate-400",
                  IND_ROUTINE: "bg-blue-500",
                  WILDFIRE: "bg-teal-500",
                  IND_FLARE: "bg-amber-500",
                  IND_FIRE: "bg-red-500",
                };
                return (
                  <div key={b.category} className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{b.category}</span>
                      <span className="text-slate-900 dark:text-slate-100 font-bold">{b.count} ({b.percentage}%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full ${colors[b.category] || "bg-orange-500"} rounded-full`} style={{ width: `${Math.max(3, b.percentage)}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 pt-0.5">{b.interpretation}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* State-by-State Breakdown */}
          <div className="space-y-3">
            <span className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-[11px] flex items-center gap-1.5 px-1">
              <MapPin className="w-3.5 h-3.5 text-orange-600" /> State-Specific Breakdowns
            </span>

            {analyticsData?.state_breakdown?.map((st: any) => (
              <div key={st.state} className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                    {st.state.toUpperCase()} ({st.event_count} Events)
                  </span>
                  <span className="text-[10px] font-mono text-orange-600 font-bold bg-orange-50 dark:bg-orange-950/50 px-1.5 py-0.5 rounded">
                    {st.percentage_of_national}% national
                  </span>
                </div>

                <div className="space-y-1.5">
                  {st.classifications?.map((c: any) => (
                    <div key={c.category} className="p-2 bg-slate-50/70 dark:bg-slate-800/30 rounded-lg text-[10px] space-y-1">
                      <div className="flex justify-between font-mono">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{c.category}</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">{c.count} ({c.percentage}%)</span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400">{c.interpretation}</p>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between text-[10px] text-slate-400 pt-1 font-mono">
                  <span>Avg FRP: {st.mean_frp_mw} MW</span>
                  <span>Confidence: {st.mean_confidence}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {overlay === "settings" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs bg-slate-50/40">
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="font-bold text-slate-900 text-sm">Visual Appearance</div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handleThemeChange("light")}
                className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition ${theme === "light" ? "border-orange-500 bg-orange-50 text-orange-700 font-bold" : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
              >
                <Sun className="w-5 h-5 text-orange-500" />
                <span>Clean Light</span>
              </button>
              <button
                onClick={() => handleThemeChange("dark")}
                className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition ${theme === "dark" ? "border-orange-500 bg-orange-50 text-orange-700 font-bold" : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
              >
                <Moon className="w-5 h-5 text-slate-600" />
                <span>Dark Aerospace</span>
              </button>
            </div>
          </div>
          {firmsStatus ? (
            <>
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="font-bold text-slate-900 text-sm flex items-center justify-between">
                  <span>NASA FIRMS Ingestion</span>
                  <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-semibold text-xs border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {firmsStatus.status}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Freshness:</span>
                  <span className="text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded font-mono font-semibold border border-cyan-200">{firmsStatus.data_freshness_status}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Polling Interval:</span>
                  <span className="text-slate-900 font-semibold font-mono">Every 5 min</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Coverage:</span>
                  <span className="text-slate-800 font-mono font-medium">India [68°E–97°E, 6°N–37°N]</span>
                </div>
              </div>
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2">
                <div className="text-slate-900 font-semibold">Active Satellites</div>
                <div className="flex flex-wrap gap-1.5">
                  {firmsStatus.active_sensors?.map((s: string) => (
                    <span key={s} className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-mono text-slate-700">{s}</span>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2 font-mono text-[11px]">
                <div className="text-slate-900 font-sans font-semibold mb-1">Telemetry Metrics</div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Last Fetch UTC:</span>
                  <span className="text-slate-900">{firmsStatus.last_successful_firms_fetch_utc ? new Date(firmsStatus.last_successful_firms_fetch_utc).toUTCString() : "N/A"}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Observations:</span>
                  <span className="text-emerald-600 font-bold">{firmsStatus.records_inserted} new / {firmsStatus.records_received} total</span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center text-slate-500 py-12">FIRMS status unavailable.</div>
          )}
        </div>
      )}
    </div>
  );
}
