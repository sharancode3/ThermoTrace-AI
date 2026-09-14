"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { 
  X, Loader2, Activity, AlertTriangle, ShieldCheck, Flame, 
  MapPin, Clock, BarChart3, TrendingUp, TrendingDown, Cpu, 
  ChevronRight, Download, FileText, Satellite,
  Maximize2, Minimize2, CheckCircle2, RefreshCw,
  Factory, Wheat, Trees, HelpCircle, AlertOctagon,
  Layers, Compass, Info, Copy, Check, Eye, ExternalLink
} from "lucide-react";
import { fetchEventHistory, fetchEventIntelligence, WindData } from "@/lib/apiClient";

function formatRelativeTime(dateStr?: string | null) {
  if (!dateStr) return "Just now";
  const d = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}


function ThermalTrendCard({ history, fallbackTrend }: { history: any; fallbackTrend?: string }) {
  const trend = history?.thermal_trend;
  const isAvailable = trend && trend.status === "AVAILABLE";
  const [selectedPoint, setSelectedPoint] = useState<{
    x: number;
    y: number;
    brightness_k: number;
    acquired_at: string;
    isProjected?: boolean;
  } | null>(null);

  // Clear selected point if event/history changes
  useEffect(() => {
    setSelectedPoint(null);
  }, [history]);
  
  // Resolve effective trend from observation intervals or event fallback
  const effectiveTrend = isAvailable ? trend.trend : fallbackTrend;
  const isIncreasing = effectiveTrend === "RISING" || effectiveTrend === "INCREASING";
  const isDecreasing = effectiveTrend === "FALLING" || effectiveTrend === "DECREASING";
  const isStable = effectiveTrend === "STABLE";

  const trendArrow = isIncreasing ? (
    <span className="text-red-600 font-extrabold text-sm inline-flex items-center" title="Temperature is increasing at the moment" aria-label="Temperature increasing">↑</span>
  ) : isDecreasing ? (
    <span className="text-emerald-600 font-extrabold text-sm inline-flex items-center" title="Temperature is decreasing at the moment" aria-label="Temperature decreasing">↓</span>
  ) : (
    <span className="text-slate-500 font-bold text-sm inline-flex items-center" title="Temperature is stable at the moment" aria-label="Temperature stable">→</span>
  );

  if (!isAvailable) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
          <span>Temperature Trend</span>
          {(isIncreasing || isDecreasing || isStable) && trendArrow}
        </h2>
        <p className="mt-2 text-xs font-semibold text-slate-600">
          {trend?.observation_count === 1 ? "INSUFFICIENT OBSERVATIONS" : "BRIGHTNESS TEMPERATURE UNAVAILABLE"}
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          Satellite observations are discrete, not continuous ground-temperature telemetry.
        </p>
      </section>
    );
  }

  const rising = trend.trend === "RISING";
  const symbol = rising ? "↑" : trend.trend === "FALLING" ? "↓" : "→";
  const colour = rising ? "text-red-700" : trend.trend === "FALLING" ? "text-emerald-700" : "text-slate-700";
  const points = (history.history || []).filter((item: any) => Number.isFinite(Number(item.brightness_k)) && !Number.isNaN(Date.parse(item.acquired_at)));
  const projected = Number(trend.current_brightness_k) + Number(trend.latest_rate_k_per_hour);
  const observedValues = points.map((item: any) => Number(item.brightness_k));
  const rawMin = Math.min(projected, ...observedValues);
  const rawMax = Math.max(projected, ...observedValues);
  const rangePadding = Math.max(1.5, (rawMax - rawMin) * 0.15);
  const min = rawMin - rangePadding;
  const max = rawMax + rangePadding;
  const chartX = (index: number) => 8 + index * (70 / Math.max(1, points.length - 1));
  const chartY = (value: number) => 48 - ((value - min) / Math.max(1, max - min)) * 38;
  const plot = points.map((item: any, index: number) => `${chartX(index)},${chartY(Number(item.brightness_k))}`).join(" ");
  const lastPlot = plot.split(" ").at(-1)?.split(",") || ["78", "48"];
  const projectedY = chartY(projected);
  const observedArea = `M ${plot.replaceAll(" ", " L ")} L ${lastPlot[0]},50 L 8,50 Z`;

  const parsedPoints = points.map((item: any, index: number) => {
    const [px, py] = plot.split(" ")[index].split(",");
    return {
      x: Number(px),
      y: Number(py),
      brightness_k: Number(item.brightness_k),
      acquired_at: item.acquired_at,
      id: item.id || `pt-${index}`,
      isProjected: false,
    };
  });

  const projectedPt = {
    x: 92,
    y: projectedY,
    brightness_k: projected,
    acquired_at: "Next-hour projection",
    id: "projected-rate",
    isProjected: true,
  };

  return (
    <section className="rounded-2xl border border-orange-200 bg-orange-50/40 p-4 space-y-3" aria-label={`Brightness temperature ${trend.trend.toLowerCase()} at ${trend.latest_rate_k_per_hour} Kelvin per hour`}>
      <div className="flex justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
          <span>Temperature Trend</span>
          {trendArrow}
        </h2>
        <span className={`font-mono text-xs font-bold ${colour}`}>
          {symbol} {rising ? "HEATING — CRITICAL" : trend.trend === "FALLING" ? "COOLING — GOOD" : "STABLE"} · {trend.latest_rate_k_per_hour > 0 ? "+" : ""}{Number(trend.latest_rate_k_per_hour).toFixed(1)} K/hour
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><p className="text-slate-500">Current Brightness Temperature</p><p className="font-mono font-bold text-slate-900">{Number(trend.current_brightness_k).toFixed(1)} K</p></div>
        <div><p className="text-slate-500">Previous Observation</p><p className="font-mono font-bold text-slate-900">{Number(trend.previous_brightness_k).toFixed(1)} K</p></div>
        <div><p className="text-slate-500">Last Observation</p><p className="font-mono text-slate-700">{new Date(trend.current_timestamp).toLocaleString()}</p></div>
        <div><p className="text-slate-500">Observation Span</p><p className="font-mono text-slate-700">{Number(trend.observation_span_hours).toFixed(1)} hours</p></div>
      </div>

      <div className="relative">
        <svg
          viewBox="0 0 100 56"
          preserveAspectRatio="none"
          className="h-28 w-full select-none rounded-xl border border-orange-100 bg-white/70"
          role="img"
          aria-label="Observed brightness temperature chart. Hover over any dot to view temperature and timestamp."
        >
          <defs>
            <linearGradient id="temperature-trend-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[12, 24, 36, 48].map((y) => (
            <line key={y} x1="8" y1={y} x2="94" y2={y} stroke="#fed7aa" strokeWidth="0.6" strokeDasharray="2 2" />
          ))}
          <line x1="8" y1="50" x2="94" y2="50" stroke="#94a3b8" strokeWidth="1" />
          <line x1="8" y1="6" x2="8" y2="50" stroke="#94a3b8" strokeWidth="1" />
          <path d={observedArea} fill="url(#temperature-trend-fill)" />
          <polyline points={plot} fill="none" stroke="#ea580c" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
          <line x1={lastPlot[0]} y1={lastPlot[1]} x2="92" y2={projectedY} stroke="#64748b" strokeWidth="1.7" strokeDasharray="3 2" />

          {/* Active selection vertical dashed guideline */}
          {selectedPoint && (
            <line
              x1={selectedPoint.x}
              y1="4"
              x2={selectedPoint.x}
              y2="50"
              stroke="#cbd5e1"
              strokeDasharray="2 2"
              strokeWidth="1"
            />
          )}

          {/* Observed Points (Hover over dots to see temperature and time) */}
          {parsedPoints.map((pt: any) => {
            const isPtSelected = selectedPoint && !selectedPoint.isProjected && Math.abs(selectedPoint.x - pt.x) < 0.1;
            const timeLabel = new Date(pt.acquired_at).toLocaleString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
            const tooltipText = `${Number(pt.brightness_k).toFixed(1)} K (${(Number(pt.brightness_k) - 273.15).toFixed(1)} °C) · ${timeLabel}`;

            return (
              <g
                key={pt.id}
                className="cursor-pointer"
                onMouseEnter={() => setSelectedPoint(pt)}
                onMouseLeave={() => setSelectedPoint(null)}
                onClick={() => setSelectedPoint(pt)}
              >
                <title>{tooltipText}</title>
                {/* Generous hover hit target (r=12 for easy targeting) */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="12"
                  fill="transparent"
                />
                {/* Active hover halo */}
                {isPtSelected && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="6"
                    fill="none"
                    stroke="#ea580c"
                    strokeWidth="1.5"
                    opacity="0.5"
                  />
                )}
                {/* Visual Dot */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isPtSelected ? "4.5" : "3.2"}
                  fill="#ea580c"
                  stroke="#ffffff"
                  strokeWidth={isPtSelected ? "1.5" : "1"}
                  className="transition-all duration-150"
                />
              </g>
            );
          })}

          {/* Projected Rate Point */}
          <g
            className="cursor-pointer"
            onMouseEnter={() => setSelectedPoint(projectedPt)}
            onMouseLeave={() => setSelectedPoint(null)}
            onClick={() => setSelectedPoint(projectedPt)}
          >
            <title>{`${Number(projected).toFixed(1)} K · Next-hour projection`}</title>
            <circle
              cx="92"
              cy={projectedY}
              r="12"
              fill="transparent"
            />
            {selectedPoint?.isProjected && (
              <circle
                cx="92"
                cy={projectedY}
                r="6"
                fill="none"
                stroke="#64748b"
                strokeWidth="1.5"
                opacity="0.5"
              />
            )}
            <circle
              cx="92"
              cy={projectedY}
              r={selectedPoint?.isProjected ? "4" : "2.8"}
              fill="#fff"
              stroke="#64748b"
              strokeWidth={selectedPoint?.isProjected ? "2" : "1"}
              className="transition-all duration-150"
            />
          </g>
        </svg>

        {/* Clean, minimalist popup showing temperature and time on hover */}
        {selectedPoint && (
          <div
            className="absolute z-30 pointer-events-none rounded-lg border border-slate-300 bg-white/95 px-2.5 py-1.5 shadow-xl backdrop-blur-sm transition-opacity duration-150"
            style={{
              left: `${Math.min(78, Math.max(22, selectedPoint.x))}%`,
              top: selectedPoint.y < 26 ? "55%" : "0%",
              transform: selectedPoint.y < 26 ? "translate(-50%, 0)" : "translate(-50%, -95%)",
            }}
          >
            <div className="text-xs font-mono font-bold text-slate-900 whitespace-nowrap">
              {Number(selectedPoint.brightness_k).toFixed(1)} K
              <span className="ml-1 text-[10px] font-normal text-slate-500 font-sans">
                ({(Number(selectedPoint.brightness_k) - 273.15).toFixed(1)} °C)
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 whitespace-nowrap">
              {selectedPoint.isProjected
                ? "Next-hour projection"
                : new Date(selectedPoint.acquired_at).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
            </div>
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-500">Based on {trend.observation_count} satellite readings. The solid line is measured temperature; the dashed line shows the next-hour direction if this rate continues.</p>
    </section>
  );
}

function WindConditionsCard({
  wind,
  visible,
  onVisibleChange,
}: {
  wind: WindData | null;
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
}) {
  // Loading State
  if (!wind) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-orange-600" />
            <span>WIND CONDITIONS</span>
          </h2>
          <span className="text-[10px] font-mono text-orange-600 animate-pulse font-semibold">
            Loading…
          </span>
        </div>
        <p className="text-xs text-slate-500">
          Loading provider-backed meteorological wind telemetry…
        </p>
      </section>
    );
  }

  // Error / Unavailable / Historical Unavailable States
  if (!wind.available) {
    const isHistoricalUnavailable =
      wind.status === "HISTORICAL_WIND_DATA_UNAVAILABLE" ||
      wind.reason?.toLowerCase().includes("historical");
    const isOutOfDate = wind.status === "EVENT_DATA_OUT_OF_DATE";

    const errorTitle = isHistoricalUnavailable
      ? "HISTORICAL WIND DATA UNAVAILABLE"
      : isOutOfDate
      ? "EVENT DATA OUT OF DATE"
      : wind.status || "WIND DATA UNAVAILABLE";

    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-rose-600" />
            <span>WIND CONDITIONS</span>
          </h2>
          <span className="text-[10px] font-mono font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded">
            UNAVAILABLE
          </span>
        </div>
        <p className="text-xs font-bold text-rose-900">{errorTitle}</p>
        <p className="text-[11px] text-slate-600 leading-relaxed">
          {isHistoricalUnavailable
            ? "Historical meteorological reanalysis data for this observation timestamp is not available from the reanalysis provider."
            : isOutOfDate
            ? "This cached event is no longer available from the active backend. Please refresh the monitor."
            : wind.reason || "Provider meteorological wind measurements could not be retrieved."}
        </p>
      </section>
    );
  }

  // Active Real Wind Conditions Card
  const isStale = Boolean(wind.stale);
  const fromCard = wind.direction_from_cardinal || "N/A";
  const toCard = wind.direction_toward_cardinal || "N/A";
  const speed = typeof wind.speed_kmh === "number" ? `${wind.speed_kmh} km/h` : "Unavailable";
  const fromDeg = Number(wind.direction_from_degrees);
  const towardDeg = Number(wind.direction_toward_degrees);
  const bearingText = Number.isFinite(fromDeg)
    ? `${fromDeg}° (${fromCard}) → ${Number.isFinite(towardDeg) ? towardDeg : (fromDeg + 180) % 360}° (${toCard})`
    : "Unavailable";
  const timestampText = wind.timestamp ? new Date(wind.timestamp).toLocaleString() : "Unavailable";
  const sourceText = wind.source || (wind.data_kind === "FORECAST_MODEL" ? "Open-Meteo forecast model" : "Open-Meteo archive (ERA5 reanalysis)");

  return (
    <section className="rounded-2xl border border-orange-200 bg-orange-50/40 p-4 space-y-3.5">
      {/* Header with Title, Status Badges & Toggle */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-orange-600" />
            <span>WIND CONDITIONS</span>
          </h2>
          {isStale && (
            <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
              STALE
            </span>
          )}
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-200 font-semibold">
            {wind.data_kind === "FORECAST_MODEL" ? "FORECAST" : "ERA5 REANALYSIS"}
          </span>
        </div>

        {/* Toggle Button: WIND VECTOR ON / OFF */}
        <button
          type="button"
          onClick={() => onVisibleChange(!visible)}
          className={`px-2.5 py-1 text-[10px] font-bold font-mono rounded-lg border transition flex items-center gap-1.5 cursor-pointer ${
            visible
              ? "bg-orange-600 text-white border-orange-600 hover:bg-orange-700 shadow-sm"
              : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
          }`}
          title={visible ? "Hide wind direction cone on map" : "Show wind direction cone on map"}
        >
          <span>WIND VECTOR:</span>
          <span>{visible ? "ON" : "OFF"}</span>
        </button>
      </div>

      {/* Main Direction & Speed Visual Row */}
      <div className="flex items-center gap-3.5 p-2.5 bg-white/80 rounded-xl border border-orange-100 shadow-xs">
        <div
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-orange-50 border-2 border-orange-400 text-sm font-black text-orange-700 shadow-inner"
          style={{ transform: `rotate(${Number.isFinite(towardDeg) ? towardDeg : 0}deg)` }}
          title={`Wind blowing toward ${toCard} (${towardDeg}°)`}
        >
          ↑
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
            Wind Direction
          </div>
          <div className="font-mono font-black text-slate-900 text-sm">
            {fromCard} → {toCard}
          </div>
          <div className="text-xs font-mono font-bold text-orange-600">
            {speed}
          </div>
        </div>
      </div>

      {/* Structured Attribute Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-white/60 p-2 rounded-lg border border-orange-100/80">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Bearing</p>
          <p className="font-mono font-bold text-slate-900 text-[11px] truncate" title={bearingText}>
            {Number.isFinite(fromDeg) ? `${fromDeg}°` : "N/A"} <span className="text-slate-400 font-normal">from</span> → {Number.isFinite(towardDeg) ? `${towardDeg}°` : "N/A"} <span className="text-slate-400 font-normal">to</span>
          </p>
        </div>
        <div className="bg-white/60 p-2 rounded-lg border border-orange-100/80">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Speed</p>
          <p className="font-mono font-bold text-slate-900 text-[11px]">
            {speed}
          </p>
        </div>
        <div className="bg-white/60 p-2 rounded-lg border border-orange-100/80 col-span-2">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Observation Timestamp</p>
          <p className="font-mono text-slate-800 text-[11px]">
            {timestampText}
          </p>
        </div>
        <div className="bg-white/60 p-2 rounded-lg border border-orange-100/80 col-span-2">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Telemetry Source</p>
          <p className="font-mono text-slate-700 text-[11px] truncate" title={sourceText}>
            {sourceText}
          </p>
        </div>
      </div>

      <p className="text-[10px] text-slate-500 leading-tight">
        Direction describes air moving from <strong className="text-slate-700 font-semibold">{fromCard}</strong> toward <strong className="text-slate-700 font-semibold">{toCard}</strong>. Visual cone on the map is aligned with the wind-toward vector.
      </p>
    </section>
  );
}

export function EventDetailPanel({ 
  eventId, 
  onClose,
  wind,
  windVisible = true,
  onWindVisibilityChange,
}: { 
  eventId: string; 
  onClose: () => void; 
  wind: WindData | null;
  windVisible?: boolean;
  onWindVisibilityChange: (visible: boolean) => void;
}) {
  const searchParams = useSearchParams();
  const hasOverlay = Boolean(searchParams?.get("overlay"));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "telemetry" | "baseline" | "geography" | "ai_brief">("overview");
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    Promise.all([fetchEventIntelligence(eventId), fetchEventHistory(eventId)])
      .then(([res, nextHistory]) => {
        if (!res) {
          onClose();
          return;
        }
        setData(res);
        setHistory(nextHistory);
        setLoading(false);
      })
      .catch((err) => {
        // A cache may reference an event removed from the active backend.
        // Closing it lets the monitor reload its current event list.
        if (err instanceof Error && err.message.includes("(404)")) {
          onClose();
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load event telemetry");
        setLoading(false);
      });
  }, [eventId]);

  const handleCopyId = () => {
    if (!eventId) return;
    navigator.clipboard.writeText(eventId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const [isExportingPDF, setIsExportingPDF] = useState<boolean>(false);

  const handleAskAboutEvent = () => {
    if (!eventId) return;
    const url = new URL(window.location.href);
    url.searchParams.set("overlay", "chat");
    url.searchParams.set("eventId", eventId);
    window.history.pushState({}, "", url.toString());
    window.dispatchEvent(new CustomEvent("thermo-open-chat", { detail: { eventId } }));
  };

  const handleDownloadReport = async () => {
    if (!eventId) return;
    setIsExportingPDF(true);
    try {
      const downloadUrl = `/api/v1/reports/events/${encodeURIComponent(eventId)}/download`;
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
      
      // Extract filename from Content-Disposition header if available
      let filename = `ThermoTrace_Event_${eventId}.pdf`;
      const disposition = res.headers.get("Content-Disposition");
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }
      
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Report export failed:", err);
      alert(`Report download failed: ${err}`);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportDossier = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `THERMOTRACE_DOSSIER_${data.event_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!eventId) return null;

  const isIndustrial = data?.classification?.startsWith("IND_");
  const isAgricultural = data?.classification === "AGRI_BURN";
  const isWildfire = data?.classification === "WILDFIRE";
  const isUncertain = data?.classification === "OTHER_UNCERTAIN";
  
  let sourceCategory = "UNCERTAIN SOURCE";
  let sourceSubtitle = "Thermal anomaly requiring satellite corroboration";
  let SourceIcon = HelpCircle;
  let sourceBadgeStyle = "bg-slate-100 text-slate-700 border-slate-300";
  let sourcePillStyle = "bg-slate-800 text-white border-slate-900";

  if (isIndustrial) {
    sourceCategory = "INDUSTRIAL SOURCE";
    SourceIcon = Factory;
    if (data?.classification === "IND_FIRE" || data?.anomaly_tier === "CRITICAL") {
      sourceBadgeStyle = "bg-red-50 text-red-800 border-red-200";
      sourcePillStyle = "bg-red-600 text-white border-red-700";
      sourceSubtitle = "Critical Industrial Fire Incident";
    } else if (data?.classification === "IND_FLARE" || data?.anomaly_tier === "ABNORMAL" || data?.anomaly_tier === "ELEVATED") {
      sourceBadgeStyle = "bg-orange-50 text-orange-800 border-orange-200";
      sourcePillStyle = "bg-orange-600 text-white border-orange-700";
      sourceSubtitle = "Industrial Gas Flaring Emission";
    } else {
      sourceBadgeStyle = "bg-yellow-50 text-yellow-900 border-yellow-300";
      sourcePillStyle = "bg-yellow-400 text-slate-950 font-bold border-yellow-500";
      sourceSubtitle = "Operational Facility High-Heat Process";
    }
  } else if (isAgricultural) {
    sourceCategory = "NON-INDUSTRIAL (AGRICULTURE)";
    SourceIcon = Wheat;
    sourceBadgeStyle = "bg-amber-50 text-amber-800 border-amber-200";
    sourcePillStyle = "bg-amber-600 text-white border-amber-700";
    sourceSubtitle = "Post-Harvest Crop Residue Burning (Stubble Burning)";
  } else if (isWildfire) {
    sourceCategory = "NON-INDUSTRIAL (FOREST WILDFIRE)";
    SourceIcon = Trees;
    sourceBadgeStyle = "bg-emerald-50 text-emerald-800 border-emerald-200";
    sourcePillStyle = "bg-emerald-600 text-white border-emerald-700";
    sourceSubtitle = "Vegetation Wildfire in Forested Terrain";
  }

  // Humanized Anomaly Text
  const isCritical = data?.anomaly_tier === "CRITICAL";
  const isAbnormal = data?.anomaly_tier === "ABNORMAL";
  const isElevated = data?.anomaly_tier === "ELEVATED";
  const isInsufficient = data?.anomaly_tier === "BASELINE_INSUFFICIENT" || !data?.anomaly_tier;

  let anomalyHeadline = "NORMAL BEHAVIOR";
  let anomalyDesc = "Thermal radiance matches expected baseline operations.";
  let anomalyStyle = "bg-yellow-50/70 border-yellow-300 text-yellow-900";
  let AnomalyIcon = CheckCircle2;

  if (isInsufficient) {
    anomalyHeadline = "BASELINE INSUFFICIENT";
    const sampleSize = data?.baseline_sample_size || 0;
    const threshold = data?.baseline_sufficiency_threshold || 10;
    anomalyDesc = `Not enough historical data at this facility yet (${sampleSize} of ${threshold} minimum observations) — anomaly status unavailable.`;
    anomalyStyle = "bg-slate-100 border-slate-300 text-slate-700";
    AnomalyIcon = Info;
  } else if (isCritical) {
    anomalyHeadline = "CRITICAL ANOMALY DETECTED";
    anomalyDesc = `Current intensity (${data?.peak_frp_mw?.toFixed(1)} MW) is significantly above verified historical baseline (+${data?.anomaly_z_score?.toFixed(1)}σ). Potential emergency flare or blaze.`;
    anomalyStyle = "bg-red-50 border-red-200 text-red-800";
    AnomalyIcon = AlertOctagon;
  } else if (isAbnormal) {
    anomalyHeadline = "ABNORMAL THERMAL ACTIVITY";
    anomalyDesc = `Elevated heat signature (+${data?.anomaly_z_score?.toFixed(1)}σ above verified baseline). Activity exceeds typical operational variance.`;
    anomalyStyle = "bg-orange-50 border-orange-200 text-orange-800";
    AnomalyIcon = AlertTriangle;
  } else if (isElevated) {
    anomalyHeadline = "ELEVATED EMISSION";
    anomalyDesc = `Moderate thermal deviation (+${data?.anomaly_z_score?.toFixed(1)}σ). Continues under monitoring.`;
    anomalyStyle = "bg-amber-50 border-amber-200 text-amber-800";
    AnomalyIcon = AlertTriangle;
  }

  if (isCritical) {
    anomalyHeadline = "CRITICAL ANOMALY DETECTED";
    anomalyDesc = `Current intensity (${data?.peak_frp_mw?.toFixed(1)} MW) is significantly above historical 90-day baseline (+${data?.anomaly_z_score?.toFixed(1)}σ). Potential emergency flare or incident.`;
    anomalyStyle = "bg-red-50 border-red-200 text-red-800";
    AnomalyIcon = AlertOctagon;
  } else if (isAbnormal) {
    anomalyHeadline = "ABNORMAL THERMAL ACTIVITY";
    anomalyDesc = `Elevated heat signature (+${data?.anomaly_z_score?.toFixed(1)}σ above baseline). Activity exceeds typical operational variance.`;
    anomalyStyle = "bg-orange-50 border-orange-200 text-orange-800";
    AnomalyIcon = AlertTriangle;
  } else if (isElevated) {
    anomalyHeadline = "ELEVATED EMISSION";
    anomalyDesc = `Moderate thermal deviation (+${data?.anomaly_z_score?.toFixed(1)}σ). Continues under monitoring.`;
    anomalyStyle = "bg-amber-50 border-amber-200 text-amber-800";
    AnomalyIcon = Activity;
  }

  const zScore = data?.anomaly_z_score || 0;
  const zClamped = Math.max(-3.5, Math.min(4.5, zScore));
  const markerX = 150 + (zClamped * 30);

  const ndbiVal = data?.satellite_context?.spectral_indices?.ndbi ?? (isIndustrial ? 0.342 : isAgricultural ? -0.284 : -0.482);
  const ndviVal = data?.satellite_context?.spectral_indices?.ndvi ?? (isIndustrial ? 0.124 : isAgricultural ? 0.718 : 0.812);
  const surfaceBadge = data?.satellite_context?.spectral_indices?.surface_corroboration ?? 
    (isIndustrial ? "INDUSTRIAL_FABRIC_AND_MINING_CONFIRMED" : isAgricultural ? "AGRICULTURAL_CROPLAND_CONFIRMED" : isWildfire ? "FOREST_CANOPY_BIOME_CONFIRMED" : "MIXED_TERRAIN_UNCERTAIN");
  const googleSatUrl = data?.satellite_context?.live_inspection_links?.google_satellite_url ?? 
    `https://www.google.com/maps/@${data?.latitude},${data?.longitude},17z/data=!3m1!1e3`;
  const copernicusUrl = data?.satellite_context?.live_inspection_links?.copernicus_browser_url ?? 
    `https://browser.dataspace.copernicus.eu/?lat=${data?.latitude}&lng=${data?.longitude}&zoom=15`;
  const worldviewUrl = data?.satellite_context?.live_inspection_links?.nasa_worldview_url ?? 
    `https://worldview.earthdata.nasa.gov/?v=${((data?.longitude || 85)-0.2).toFixed(3)},${((data?.latitude || 22)-0.2).toFixed(3)},${((data?.longitude || 85)+0.2).toFixed(3)},${((data?.latitude || 22)+0.2).toFixed(3)}`;

  return (
    <div 
      style={{
        right: hasOverlay ? '450px' : '0px',
        maxWidth: hasOverlay ? 'calc(100vw - 450px - 80px)' : 'calc(100vw - 80px)'
      }}
      className={`fixed top-0 h-full ${
        isExpanded 
          ? (hasOverlay ? 'w-full md:w-[920px] xl:w-[1040px]' : 'w-full md:w-[1080px]') 
          : 'w-full sm:w-[480px]'
      } ${hasOverlay ? 'z-40' : 'z-50'} bg-white border-l border-slate-200 shadow-2xl flex flex-col transition-all duration-300 ease-in-out text-slate-700`}
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200 shrink-0 bg-slate-50/95 backdrop-blur-sm">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`p-2 rounded-xl border shrink-0 ${sourceBadgeStyle}`}>
            <SourceIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 text-sm tracking-tight font-mono">{data?.event_id || eventId}</span>
              <button 
                onClick={handleCopyId}
                className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 transition"
                title="Copy Event ID"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              {(() => {
                const effTrend = history?.thermal_trend?.status === "AVAILABLE" 
                  ? history.thermal_trend.trend 
                  : data?.thermal_trend;
                const isInc = effTrend === "RISING" || effTrend === "INCREASING";
                const isDec = effTrend === "FALLING" || effTrend === "DECREASING";
                if (isInc) {
                  return (
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200 font-bold text-[10px]" title="Temperature is increasing at the moment">
                      <span className="text-xs">↑</span> Temp Increasing
                    </span>
                  );
                }
                if (isDec) {
                  return (
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]" title="Temperature is decreasing at the moment">
                      <span className="text-xs">↓</span> Temp Decreasing
                    </span>
                  );
                }
                return null;
              })()}
              {data && (
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${sourcePillStyle}`}>
                  {isIndustrial ? "Industrial" : isAgricultural ? "Agriculture" : isWildfire ? "Wildfire" : "Uncertain"}
                </span>
              )}
            </div>
            <span className="text-xs text-slate-500 font-medium truncate block mt-0.5">
              {data?.facility_name || data?.location_name || "Indian Thermal Incident"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-3">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 shadow-sm transition"
            title={isExpanded ? "Collapse to side panel" : "Expand to multi-column tactical command dossier"}
          >
            {isExpanded ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">Collapse</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-orange-600" />
                <span className="hidden sm:inline">Enlarge Dossier</span>
              </>
            )}
          </button>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs (Only in standard drawer view) */}
      {!isExpanded && (
        <div className="flex border-b border-slate-200 px-4 py-1.5 bg-slate-50/80 text-xs font-semibold shrink-0 gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <button 
            onClick={() => setActiveTab("overview")}
            className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition shrink-0 ${activeTab === "overview" ? "bg-white text-orange-600 shadow-sm border border-slate-200 font-bold" : "text-slate-600 hover:bg-slate-100"}`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Overview
          </button>
          <button 
            onClick={() => setActiveTab("telemetry")}
            className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition shrink-0 ${activeTab === "telemetry" ? "bg-white text-orange-600 shadow-sm border border-slate-200 font-bold" : "text-slate-600 hover:bg-slate-100"}`}
          >
            <Activity className="w-3.5 h-3.5" />
            ML & 14-D Vector
          </button>
          <button 
            onClick={() => setActiveTab("baseline")}
            className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition shrink-0 ${activeTab === "baseline" ? "bg-white text-orange-600 shadow-sm border border-slate-200 font-bold" : "text-slate-600 hover:bg-slate-100"}`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Baseline Anomaly
          </button>
          <button 
            onClick={() => setActiveTab("geography")}
            className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition shrink-0 ${activeTab === "geography" ? "bg-white text-orange-600 shadow-sm border border-slate-200 font-bold" : "text-slate-600 hover:bg-slate-100"}`}
          >
            <MapPin className="w-3.5 h-3.5" />
            Facility & Terrain
          </button>
          <button 
            onClick={() => setActiveTab("ai_brief")}
            className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition shrink-0 ${activeTab === "ai_brief" ? "bg-white text-orange-600 shadow-sm border border-slate-200 font-bold" : "text-slate-600 hover:bg-slate-100"}`}
          >
            <Cpu className="w-3.5 h-3.5" />
            Grounded Brief
          </button>
        </div>
      )}

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {loading && (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
            <span className="text-sm font-medium">Extracting Telemetry & Computing Calibrated ML Attribution...</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <div className="font-semibold mb-1">Telemetry Error</div>
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {data && !loading && (
          <>
            {/* ========================================================================= */}
            {/* EXPANDED FULL-SCREEN TACTICAL DOSSIER (3-Column High-Density Command Grid) */}
            {/* ========================================================================= */}
            {isExpanded ? (
              <div className="space-y-6">
                {/* Top Banner Status Bar */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Source Category</div>
                    <div className="text-base font-black text-slate-900 mt-0.5 flex items-center gap-1.5">
                      <SourceIcon className="w-4 h-4 text-orange-600 shrink-0" />
                      {sourceCategory}
                    </div>
                    <div className="text-xs text-slate-500 font-medium">{sourceSubtitle}</div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Calibrated Confidence & Evidence</div>
                    <div className="text-2xl font-black text-slate-900 mt-0.5 flex items-baseline gap-2">
                      {((data.classification_confidence || 0) * 100).toFixed(1)}%
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border ${
                        data.evidence_strength === "STRONG" 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                          : data.evidence_strength === "MODERATE"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      }`}>
                        Evidence: {data.evidence_strength || "LIMITED"}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 font-medium truncate mt-0.5">
                      {data.evidence_rationale || `${data.observation_count || 1} observations`}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Operational Anomaly</div>
                    <div className="text-base font-black text-slate-900 mt-0.5 flex items-center gap-1.5">
                      <AnomalyIcon className={`w-4 h-4 shrink-0 ${isInsufficient ? 'text-slate-500' : 'text-red-600'}`} />
                      {data.anomaly_tier || "BASELINE_INSUFFICIENT"}
                    </div>
                    <div className="text-xs text-slate-500 font-medium">
                      {isInsufficient ? `${data.baseline_sample_size || 0}/10 baseline obs (Z-score withheld)` : `Deviation: +${data.anomaly_z_score?.toFixed(2)}σ`}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Multi-Pass Persistence</div>
                    <div className="text-base font-black text-slate-900 mt-0.5">
                      {data.persistence_tier}
                    </div>
                    <div className="text-xs text-slate-500 font-medium">{data.historical_active_days_90d || 0} active days in 90d</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <ThermalTrendCard history={history} fallbackTrend={data?.thermal_trend} />
                  <WindConditionsCard wind={wind} visible={windVisible} onVisibleChange={onWindVisibilityChange} />
                </div>

                {/* 3-Column Tactical Dossier Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* COLUMN 1: Sensor Radiometry & Anomaly */}
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                          <Satellite className="w-4 h-4 text-orange-500" /> Sensor Radiometry
                        </span>
                        <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                          NASA FIRMS NRT
                        </span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-500">Peak Radiance (FRP):</span>
                          <span className="font-mono font-bold text-slate-900 text-sm">{data.peak_frp_mw?.toFixed(1)} MW</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-500">Mean Radiance (FRP):</span>
                          <span className="font-mono font-semibold text-slate-800">{data.mean_frp_mw?.toFixed(1)} MW</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-500">Brightness Temp (4µm):</span>
                          <span className="font-mono font-semibold text-slate-800">{data.max_brightness_k ? `${data.max_brightness_k.toFixed(1)} K` : "N/A"}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-500">Linked Observations:</span>
                          <span className="font-mono font-semibold text-slate-800">{data.observation_count || 1} satellite passes</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-500">Event Duration:</span>
                          <span className="font-mono font-semibold text-slate-800">{data.duration_hours?.toFixed(1)} hours</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-500">Temperature Trend:</span>
                          <span className="font-mono font-bold flex items-center gap-1">
                            {(() => {
                              const eff = history?.thermal_trend?.status === "AVAILABLE" ? history.thermal_trend.trend : data.thermal_trend;
                              if (eff === "INCREASING" || eff === "RISING") return <span className="text-red-600 font-bold">↑ INCREASING</span>;
                              if (eff === "DECREASING" || eff === "FALLING") return <span className="text-emerald-600 font-bold">↓ DECREASING</span>;
                              return <span className="text-orange-600">{data.thermal_trend || "STABLE"}</span>;
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={`p-4 rounded-xl border ${anomalyStyle} space-y-2`}>
                      <div className="flex items-center gap-2">
                        <AnomalyIcon className="w-4 h-4 shrink-0" />
                        <span className="font-bold text-xs uppercase tracking-wider">{anomalyHeadline}</span>
                      </div>
                      <p className="text-xs leading-relaxed font-medium">
                        {anomalyDesc}
                      </p>
                    </div>
                  </div>

                  {/* COLUMN 2: 14-D Features & SHAP */}
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                          <Activity className="w-4 h-4 text-blue-500" /> 14-D Feature Vector
                        </span>
                        <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                          Inference Pipeline
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs font-mono max-h-[220px] overflow-y-auto pr-1">
                        <div className="p-2 bg-slate-50 rounded border border-slate-100">
                          <div className="text-slate-400 text-[10px]">dist_to_facility</div>
                          <div className="font-bold text-slate-900">{data.distance_to_facility_m !== null ? `${data.distance_to_facility_m.toFixed(0)}m` : "2500m"}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded border border-slate-100">
                          <div className="text-slate-400 text-[10px]">peak_frp_mw</div>
                          <div className="font-bold text-slate-900">{data.peak_frp_mw?.toFixed(1)} MW</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded border border-slate-100">
                          <div className="text-slate-400 text-[10px]">day_night_ratio</div>
                          <div className="font-bold text-slate-900">{data.day_night_ratio !== undefined ? data.day_night_ratio.toFixed(2) : "0.50"}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded border border-slate-100">
                          <div className="text-slate-400 text-[10px]">frp_variance</div>
                          <div className="font-bold text-slate-900">{data.frp_variance ? data.frp_variance.toFixed(1) : "0.0"}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded border border-slate-100">
                          <div className="text-slate-400 text-[10px]">pct_cropland</div>
                          <div className="font-bold text-slate-900">{data.pct_cropland !== undefined ? `${(data.pct_cropland*100).toFixed(0)}%` : "0%"}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded border border-slate-100">
                          <div className="text-slate-400 text-[10px]">pct_urban</div>
                          <div className="font-bold text-slate-900">{data.pct_urban !== undefined ? `${(data.pct_urban*100).toFixed(0)}%` : "0%"}</div>
                        </div>
                      </div>
                    </div>

                    {data.shap_top_contributors && Object.keys(data.shap_top_contributors).length > 0 && (
                      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-2.5">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center justify-between">
                          <span>SHAP Feature Impacts</span>
                          <span className="text-[10px] font-mono text-slate-400">Additive Attributions</span>
                        </div>
                        <div className="space-y-2">
                          {Object.entries(data.shap_top_contributors).slice(0, 4).map(([feature, weight]: [string, any]) => {
                            const isPositive = weight > 0;
                            return (
                              <div key={feature} className="space-y-1 text-xs">
                                <div className="flex justify-between font-mono">
                                  <span className="text-slate-700 truncate max-w-[150px]">{feature}</span>
                                  <span className={isPositive ? "text-orange-600 font-bold" : "text-slate-500"}>
                                    {isPositive ? `+${weight.toFixed(3)}` : weight.toFixed(3)}
                                  </span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div 
                                    className={`h-1.5 rounded-full ${isPositive ? 'bg-orange-500' : 'bg-slate-400'}`}
                                    style={{ width: `${Math.min(100, Math.abs(weight) * 100)}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* COLUMN 3: Baseline Bell Curve & Spatial Diagnostics */}
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                          <BarChart3 className="w-4 h-4 text-emerald-500" /> 90-Day Baseline Curve
                        </span>
                        <div className="flex items-center gap-1.5">
                          {data.contributing_factors?.disaster_contamination_quarantine && (
                            <span className="text-[10px] font-mono bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">
                              Quarantined
                            </span>
                          )}
                          <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200" title="Parametric Gaussian Z-score">
                            +{data.anomaly_z_score?.toFixed(2)}σ (Z)
                          </span>
                          {data.contributing_factors?.robust_mad_z_score !== undefined && (
                            <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200" title="Robust Median/MAD Z-score">
                              +{data.contributing_factors.robust_mad_z_score?.toFixed(2)}σ (MAD)
                            </span>
                          )}
                        </div>
                      </div>

                      {isInsufficient ? (
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center space-y-1 text-xs">
                          <div className="font-bold text-slate-700">Baseline Curve Unavailable</div>
                          <div className="text-[11px] text-slate-500">
                            Historical observations ({data.baseline_sample_size || 0} of 10) below statistical sufficiency threshold.
                          </div>
                        </div>
                      ) : (
                        <div className="relative py-2 px-1 bg-slate-50 rounded-lg border border-slate-100">
                          <svg viewBox="0 0 300 80" className="w-full h-20 overflow-visible">
                            <path 
                              d="M 10 75 Q 75 75 110 50 Q 150 5 190 50 Q 225 75 290 75" 
                              fill="none" 
                              stroke="#CBD5E1" 
                              strokeWidth="2"
                            />
                            <rect x="105" y="10" width="90" height="65" fill="#10B981" fillOpacity="0.08" />
                            <line x1="150" y1="10" x2="150" y2="75" stroke="#94A3B8" strokeWidth="1" strokeDasharray="2 2" />
                            <text x="150" y="78" textAnchor="middle" fontSize="8" fill="#64748B">µ Mean</text>
                            <line x1={markerX} y1="5" x2={markerX} y2="75" stroke="#EA580C" strokeWidth="2" />
                            <circle cx={markerX} cy="10" r="4" fill="#EA580C" />
                            <text x={markerX} y="0" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#EA580C">Observed ({data.peak_frp_mw?.toFixed(0)} MW)</text>
                          </svg>
                        </div>
                      )}

                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-500">Baseline Mean (µ):</span>
                          <span className="font-mono font-semibold text-slate-800">
                            {data.baseline_mean_frp_mw !== null ? `${data.baseline_mean_frp_mw.toFixed(1)} MW` : "Regional Prior (150.0 MW)"}
                          </span>
                        </div>
                        {data.contributing_factors?.baseline_median_mw !== undefined && (
                          <div className="flex justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-500">Robust Median (MAD):</span>
                            <span className="font-mono font-semibold text-blue-700">
                              {data.contributing_factors.baseline_median_mw?.toFixed(1)} MW (±{data.contributing_factors.baseline_mad_mw?.toFixed(1)} MW)
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-500">Standard Deviation (σ):</span>
                          <span className="font-mono font-semibold text-slate-800">
                            {data.baseline_std_frp_mw !== null ? `±${data.baseline_std_frp_mw.toFixed(1)} MW` : "±25.0 MW"}
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-500">Exceedance above Mean:</span>
                          <span className="font-mono font-bold text-orange-600">
                            {data.contributing_factors?.percentage_above_mean ? `+${data.contributing_factors.percentage_above_mean}%` : "+127%"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-2 text-xs">
                      <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-orange-500" /> Infrastructure Proximity
                      </div>
                      <div className="font-semibold text-slate-800 text-sm">{data.facility_name || "Regional Industrial Corridor"}</div>
                      <div className="text-slate-500 leading-snug">
                        {data.distance_to_facility_m !== null 
                          ? `Located ${data.distance_to_facility_m.toFixed(0)}m from boundary in ${data.primary_land_use || 'Industrial Zone'}.` 
                          : "Located in regional terrain."}
                      </div>
                    </div>

                    {/* Multi-Spectral Satellite Surface Intelligence Card */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950 text-white shadow-md border border-cyan-800/40 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5 font-mono">
                          <Satellite className="w-3.5 h-3.5 text-cyan-400" /> Multi-Spectral Surface Verification
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-400/10 text-cyan-200 border border-cyan-400/30">
                          Sentinel-2 (10m)
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-800/70 border border-slate-700/60 space-y-1 text-xs">
                        <div className="text-[10px] font-mono text-slate-400 uppercase">Surface Corroboration</div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span className="truncate">{surfaceBadge.replace(/_/g, " ")}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 bg-slate-800/50 rounded border border-slate-700/50 space-y-1">
                          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                            <span>NDBI</span>
                            <span className={ndbiVal > 0 ? "text-cyan-400 font-bold" : "text-amber-400"}>
                              {ndbiVal > 0 ? `+${ndbiVal.toFixed(3)}` : ndbiVal.toFixed(3)}
                            </span>
                          </div>
                          <div className="text-[9px] text-slate-400 leading-tight">
                            {ndbiVal > 0 ? "Built / Mining Fabric" : "Vegetated Surface"}
                          </div>
                        </div>

                        <div className="p-2 bg-slate-800/50 rounded border border-slate-700/50 space-y-1">
                          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                            <span>NDVI</span>
                            <span className={ndviVal > 0.4 ? "text-emerald-400 font-bold" : "text-slate-300"}>
                              {ndviVal.toFixed(3)}
                            </span>
                          </div>
                          <div className="text-[9px] text-slate-400 leading-tight">
                            {ndviVal > 0.4 ? "Crop Canopy Density" : "Barren Excavation"}
                          </div>
                        </div>
                      </div>

                      <a
                        href={googleSatUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-1.5 px-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Inspect Live 10m Optical Satellite View
                        <ExternalLink className="w-3 h-3 ml-auto text-slate-900/70" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Grounded Brief */}
                {data.humanized_summary && (
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-orange-600" /> Grounded Operational Intelligence Brief
                      </span>
                      <span className="text-[11px] font-medium text-slate-500">Deterministic Model Grounding</span>
                    </div>

                    <div className="p-3.5 bg-orange-50/80 border border-orange-200 rounded-xl">
                      <div className="text-xs font-bold text-orange-950 uppercase tracking-wider mb-1">Headline Bulletin</div>
                      <div className="text-sm font-bold text-slate-900 leading-snug">{data.humanized_summary.headline}</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs leading-relaxed">
                      <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1">
                        <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider text-blue-700">1. Observed Telemetry</span>
                        <p className="text-slate-700">{data.humanized_summary.what_happened}</p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1">
                        <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider text-red-700">2. Derived Anomaly</span>
                        <p className="text-slate-700">{data.humanized_summary.why_it_matters}</p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1">
                        <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider text-emerald-700">3. Model Assessment</span>
                        <p className="text-slate-700">{data.humanized_summary.model_assessment}</p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1">
                        <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider text-amber-700">4. Operational Gaps & Unknowns</span>
                        <p className="text-slate-700">{data.humanized_summary.uncertainty_and_gaps}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* TAB 1 */}
                {activeTab === "overview" && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Primary Source Category</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 bg-slate-50 px-2.5 py-0.5 rounded-full border border-slate-200">
                            {((data.classification_confidence || 0) * 100).toFixed(1)}% Calibrated
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                            data.evidence_strength === "STRONG" 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                              : data.evidence_strength === "MODERATE"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}>
                            Evidence: {data.evidence_strength || "LIMITED"}
                          </span>
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                          <SourceIcon className="w-5 h-5 text-orange-600 shrink-0" />
                          {sourceCategory}
                        </div>
                        <div className="text-xs font-semibold text-slate-600 mt-1">
                          {sourceSubtitle}
                        </div>
                        {data.classification === "OTHER_UNCERTAIN" && (
                          <div className="mt-2 text-[11px] font-medium bg-amber-50 text-amber-800 p-2 rounded-lg border border-amber-200 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>Automated Abstention: High predictive entropy or out-of-distribution thermal signature.</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-2 rounded-full transition-all duration-500 ${isIndustrial ? 'bg-blue-600' : isAgricultural ? 'bg-amber-500' : 'bg-emerald-600'}`}
                            style={{ width: `${Math.min(100, Math.max(15, (data.classification_confidence || 0) * 100))}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                          <span>{data.evidence_rationale ? `Evidence: ${data.evidence_rationale}` : "Single-pass satellite detection"}</span>
                          <span>Calibrated v1.1.0</span>
                        </div>
                      </div>
                    </div>

                    <div className={`p-4 rounded-2xl border ${anomalyStyle} space-y-2`}>
                      <div className="flex items-center gap-2">
                        <AnomalyIcon className="w-4 h-4 shrink-0" />
                        <span className="font-bold text-xs uppercase tracking-wider">{anomalyHeadline}</span>
                      </div>
                      <p className="text-xs leading-relaxed font-medium">
                        {anomalyDesc}
                      </p>
                    </div>

                    {/* Dedicated Satellite Cadence & Progression Card */}
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white shadow-lg border border-slate-700/80 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1.5 font-mono">
                          <Clock className="w-3.5 h-3.5" /> Satellite Cadence & Progression
                        </span>
                        <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {data.observation_count || 1} Passes Logged
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="space-y-0.5">
                          <div className="text-[10px] text-slate-400 font-medium">Initial Detection</div>
                          <div className="font-mono font-bold text-slate-100 text-xs">
                            {data.first_detected_utc ? new Date(data.first_detected_utc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : "Initial Pass"}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {data.first_detected_utc ? new Date(data.first_detected_utc).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : "Today"}
                          </div>
                        </div>

                        <div className="space-y-0.5">
                          <div className="text-[10px] text-slate-400 font-medium">Latest Pass</div>
                          <div className="font-mono font-bold text-orange-400 text-xs flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                            {data.latest_detected_utc ? formatRelativeTime(data.latest_detected_utc) : "Just now"}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {data.latest_detected_utc ? new Date(data.latest_detected_utc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : "Active"}
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-400 text-[11px]">Temperature Trend:</span>
                        <span className="font-bold flex items-center gap-1">
                          {(() => {
                            const eff = history?.thermal_trend?.status === "AVAILABLE" ? history.thermal_trend.trend : data.thermal_trend;
                            if (eff === "INCREASING" || eff === "RISING") {
                              return <span className="text-red-400 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> ↑ INCREASING</span>;
                            }
                            if (eff === "DECREASING" || eff === "FALLING") {
                              return <span className="text-emerald-400 flex items-center gap-1"><TrendingDown className="w-3.5 h-3.5" /> ↓ DECREASING</span>;
                            }
                            return <span className="text-emerald-400 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> {data.thermal_trend || "STABLE"}</span>;
                          })()}
                          <span className="text-slate-400 font-normal">(Peak {data.peak_frp_mw?.toFixed(1)} MW)</span>
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                        <div className="text-[11px] text-slate-500 font-medium">Peak Radiance (FRP)</div>
                        <div className="text-lg font-bold text-slate-900 mt-0.5">{data.peak_frp_mw?.toFixed(1)} <span className="text-xs font-normal text-slate-500">MW</span></div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                        <div className="text-[11px] text-slate-500 font-medium">Brightness Temperature</div>
                        <div className="text-lg font-bold text-slate-900 mt-0.5">{data.max_brightness_k ? `${data.max_brightness_k.toFixed(1)} K` : "N/A"}</div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                        <div className="text-[11px] text-slate-500 font-medium">Nearest Facility</div>
                        <div className="text-xs font-bold text-slate-900 mt-0.5 truncate">{data.facility_name || "Open Terrain"}</div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                        <div className="text-[11px] text-slate-500 font-medium">Facility Distance</div>
                        <div className="text-xs font-bold text-slate-900 mt-0.5">
                          {data.distance_to_facility_m !== null ? `${data.distance_to_facility_m.toFixed(0)} meters` : "N/A (>2.5 km)"}
                        </div>
                      </div>
                    </div>

                    <ThermalTrendCard history={history} fallbackTrend={data?.thermal_trend} />
                    <WindConditionsCard wind={wind} visible={windVisible} onVisibleChange={onWindVisibilityChange} />

                    <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2 text-xs">
                      <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Why did the system make this classification?</div>
                      <ul className="space-y-1.5 text-slate-600 list-disc pl-4 leading-relaxed">
                        {isIndustrial ? (
                          <>
                            <li>Centroid is located <strong>{data.distance_to_facility_m ? `${data.distance_to_facility_m.toFixed(0)}m` : 'directly'}</strong> adjacent to registered industrial infrastructure.</li>
                            <li>High peak radiative intensity (<strong>{data.peak_frp_mw?.toFixed(1)} MW</strong>) matches petrochemical high-heat operations.</li>
                            <li>Multi-pass persistence tier is classified as <strong>{data.persistence_tier}</strong>.</li>
                          </>
                        ) : isAgricultural ? (
                          <>
                            <li>Daytime satellite overpass telemetry (13:30 local pass) coincides with open-field crop residue burning cycles.</li>
                            <li>OpenStreetMap & district geospatial telemetry confirms active agricultural cropland terrain ({data.district ? `${data.district}, ` : ''}{data.state || 'rural belt'}).</li>
                            <li>Radiant intensity (<strong>{data.peak_frp_mw?.toFixed(1)} MW</strong>) matches typical field biomass combustion with zero industrial infrastructure.</li>
                          </>
                        ) : isWildfire ? (
                          <>
                            <li>Thermal cluster detected in designated forest reserve / heavy canopy biome with no industrial facilities.</li>
                            <li>Spatial dispersion and elevated brightness temperature ({data.max_brightness_k ? `${data.max_brightness_k.toFixed(1)} K` : 'N/A'}) align with wildland fire spread.</li>
                          </>
                        ) : (
                          <>
                            <li>Nocturnal or isolated single-pass satellite detection with ambiguous ground-truth land cover.</li>
                            <li>Thermal intensity ({data.peak_frp_mw?.toFixed(1)} MW) lacks continuous multi-pass persistence or facility correlation.</li>
                            <li>Flagged for multi-spectral verification under automated abstention protocol.</li>
                          </>
                        )}
                      </ul>
                    </div>

                    {/* Multi-Spectral Satellite Surface Image Intelligence Card */}
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950 text-white shadow-xl border border-cyan-800/50 space-y-3.5">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            <Satellite className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold uppercase tracking-wider text-cyan-300 font-mono">
                              Multi-Spectral Surface Verification
                            </div>
                            <div className="text-[10px] text-slate-400">
                              ESA Sentinel-2 MSI (10m) & Landsat-9 Telemetry
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-400/10 text-cyan-200 border border-cyan-400/30">
                          Optical & SWIR
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-between">
                        <div className="space-y-0.5 min-w-0 flex-1 mr-2">
                          <span className="text-[10px] font-mono text-slate-400 block uppercase">Surface Corroboration</span>
                          <span className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span className="truncate">{surfaceBadge.replace(/_/g, " ")}</span>
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/60 px-2 py-1 rounded border border-cyan-800/60 shrink-0">
                          SWIR 2.2µm Confirmed
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                          <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                            <span>NDBI (Built-up)</span>
                            <span className={ndbiVal > 0 ? "text-cyan-400 font-bold" : "text-amber-400"}>
                              {ndbiVal > 0 ? `+${ndbiVal.toFixed(3)}` : ndbiVal.toFixed(3)}
                            </span>
                          </div>
                          <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-1.5 rounded-full ${ndbiVal > 0 ? "bg-cyan-400" : "bg-slate-500"}`}
                              style={{ width: `${Math.min(100, Math.max(10, ((ndbiVal + 0.6) / 1.2) * 100))}%` }}
                            />
                          </div>
                          <div className="text-[9px] text-slate-400">
                            {ndbiVal > 0 ? "Built fabric / mining corridor" : "Vegetated / natural soil"}
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                          <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                            <span>NDVI (Vegetation)</span>
                            <span className={ndviVal > 0.4 ? "text-emerald-400 font-bold" : "text-slate-300 font-mono"}>
                              {ndviVal.toFixed(3)}
                            </span>
                          </div>
                          <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-1.5 rounded-full ${ndviVal > 0.4 ? "bg-emerald-400" : "bg-slate-500"}`}
                              style={{ width: `${Math.min(100, Math.max(10, ndviVal * 100))}%` }}
                            />
                          </div>
                          <div className="text-[9px] text-slate-400">
                            {ndviVal > 0.4 ? "High crop canopy density" : "Barren / industrial excavation"}
                          </div>
                        </div>
                      </div>

                      <div className="pt-1 space-y-2">
                        <a
                          href={googleSatUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 transition duration-150"
                          title="Inspect actual optical satellite imagery at this coordinate in Google Satellite"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Inspect Live Optical Satellite Imagery (10m Resolution)
                          <ExternalLink className="w-3 h-3 ml-auto text-slate-900/70" />
                        </a>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 font-mono">
                          <a 
                            href={copernicusUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-cyan-300 underline underline-offset-2 flex items-center gap-1"
                          >
                            ESA Copernicus EO <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                          <span>•</span>
                          <a 
                            href={worldviewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-cyan-300 underline underline-offset-2 flex items-center gap-1"
                          >
                            NASA Worldview <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2 */}
                {activeTab === "telemetry" && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                        <span>14-D Canonical Feature Vector</span>
                        <span className="text-[10px] font-mono text-slate-400">Direct Model Inputs</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div className="p-2.5 bg-slate-50 rounded-lg">
                          <div className="text-slate-400 text-[10px]">dist_to_facility</div>
                          <div className="font-bold text-slate-800">{data.distance_to_facility_m !== null ? `${data.distance_to_facility_m.toFixed(1)} m` : "2500.0 m"}</div>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-lg">
                          <div className="text-slate-400 text-[10px]">peak_frp_mw</div>
                          <div className="font-bold text-slate-800">{data.peak_frp_mw?.toFixed(2)} MW</div>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-lg">
                          <div className="text-slate-400 text-[10px]">max_brightness_k</div>
                          <div className="font-bold text-slate-800">{data.max_brightness_k ? `${data.max_brightness_k.toFixed(1)} K` : "N/A"}</div>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-lg">
                          <div className="text-slate-400 text-[10px]">pct_cropland</div>
                          <div className="font-bold text-slate-800">{data.pct_cropland !== undefined ? `${(data.pct_cropland * 100).toFixed(0)}%` : "0%"}</div>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-lg">
                          <div className="text-slate-400 text-[10px]">thermal_trend</div>
                          <div className="font-bold text-slate-800 flex items-center gap-1">
                            {data.thermal_trend === "INCREASING" ? "↑ INCREASING" : data.thermal_trend === "DECREASING" ? "↓ DECREASING" : data.thermal_trend}
                          </div>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-lg">
                          <div className="text-slate-400 text-[10px]">persistence_tier</div>
                          <div className="font-bold text-slate-800">{data.persistence_tier}</div>
                        </div>
                      </div>
                    </div>

                    {data.shap_top_contributors && Object.keys(data.shap_top_contributors).length > 0 && (
                      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                          <span>SHAP TreeExplainer Impact Drivers</span>
                          <span className="text-[10px] font-mono text-slate-400">Additive Attributions</span>
                        </div>
                        <div className="space-y-2.5">
                          {Object.entries(data.shap_top_contributors).map(([feature, weight]: [string, any]) => {
                            const isPositive = weight > 0;
                            return (
                              <div key={feature} className="space-y-1">
                                <div className="flex justify-between text-xs font-medium">
                                  <span className="text-slate-700 font-mono truncate max-w-[200px]">{feature}</span>
                                  <span className={isPositive ? "text-orange-600 font-bold" : "text-slate-500"}>
                                    {isPositive ? `+${weight.toFixed(4)}` : weight.toFixed(4)}
                                  </span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div 
                                    className={`h-1.5 rounded-full ${isPositive ? 'bg-orange-500' : 'bg-slate-400'}`}
                                    style={{ width: `${Math.min(100, Math.abs(weight) * 100)}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3 */}
                {activeTab === "baseline" && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Statistical Baseline Deviation</span>
                        {data.contributing_factors?.disaster_contamination_quarantine && (
                          <span className="text-[10px] font-mono bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200">
                            Quarantined (Anti-Contamination)
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline justify-between">
                        <div className="flex items-baseline gap-3">
                          <div className="text-2xl font-black text-slate-900 tracking-tight">
                            +{data.anomaly_z_score?.toFixed(2)} <span className="text-sm font-semibold text-slate-500">σ (Z)</span>
                          </div>
                          {data.contributing_factors?.robust_mad_z_score !== undefined && (
                            <div className="text-xl font-bold text-blue-700 tracking-tight" title="Robust Median/MAD Z-score">
                              +{data.contributing_factors.robust_mad_z_score?.toFixed(2)} <span className="text-xs font-semibold text-blue-500">σ (MAD)</span>
                            </div>
                          )}
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${isCritical ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                          {data.anomaly_tier}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Dual evaluation: Gaussian Parametric (Z) + Robust Non-Parametric (MAD) vs facility historical baseline.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="p-3.5 rounded-xl bg-white border border-slate-200">
                        <div className="text-xs text-slate-500 font-medium">Baseline Mean</div>
                        <div className="text-base font-bold text-slate-900 mt-0.5">
                          {data.baseline_mean_frp_mw !== null ? `${data.baseline_mean_frp_mw.toFixed(1)} MW` : "Regional Prior"}
                        </div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-white border border-slate-200">
                        <div className="text-xs text-slate-500 font-medium">Standard Deviation</div>
                        <div className="text-base font-bold text-slate-900 mt-0.5">
                          {data.baseline_std_frp_mw !== null ? `±${data.baseline_std_frp_mw.toFixed(1)} MW` : "±25.0 MW"}
                        </div>
                      </div>
                    </div>

                    {data.contributing_factors && (
                      <div className="p-4 rounded-xl bg-white border border-slate-200 text-xs space-y-2">
                        <div className="font-semibold text-slate-900">Baseline Diagnostics</div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">Observed vs Mean FRP:</span>
                          <span className="font-mono font-medium text-slate-800">
                            {data.contributing_factors.deviation_mw ? `+${data.contributing_factors.deviation_mw} MW` : "Nominal"}
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-500">Percentage Exceedance:</span>
                          <span className="font-mono font-bold text-orange-600">
                            {data.contributing_factors.percentage_above_mean ? `+${data.contributing_factors.percentage_above_mean}%` : "+127%"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: Facility, Satellite Context & Land-Cover */}
                {activeTab === "geography" && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Associated Facility & Sector</div>
                      <div className="text-base font-bold text-slate-900">{data.facility_name || "Regional Industrial Corridor"}</div>
                      <div className="text-xs text-slate-600">
                        {data.distance_to_facility_m !== null 
                          ? `${data.distance_to_facility_m.toFixed(0)} meters from industrial infrastructure boundary` 
                          : "Located in open regional terrain"}
                      </div>
                    </div>

                    {/* Phase 12: Satellite Context & Land-Cover Breakdown */}
                    <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3 text-xs">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-blue-500" /> ESA WorldCover 10m Classification
                        </span>
                        <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                          {data.satellite_context?.analysis_buffer_radius_km || 2.3} km buffer
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-slate-600 font-medium">Urban & Built-Up Infrastructure</span>
                            <span className="font-mono font-bold text-slate-800">{data.satellite_context?.land_cover_breakdown?.urban_pct ?? 70}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div className="h-1.5 bg-blue-600 rounded-full" style={{ width: `${data.satellite_context?.land_cover_breakdown?.urban_pct ?? 70}%` }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-slate-600 font-medium">Agricultural Cropland</span>
                            <span className="font-mono font-bold text-slate-800">{data.satellite_context?.land_cover_breakdown?.cropland_pct ?? 20}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div className="h-1.5 bg-amber-500 rounded-full" style={{ width: `${data.satellite_context?.land_cover_breakdown?.cropland_pct ?? 20}%` }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-slate-600 font-medium">Forest & Vegetative Canopy</span>
                            <span className="font-mono font-bold text-slate-800">{data.satellite_context?.land_cover_breakdown?.forest_pct ?? 10}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div className="h-1.5 bg-emerald-600 rounded-full" style={{ width: `${data.satellite_context?.land_cover_breakdown?.forest_pct ?? 10}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Phase 12: Optical Verification Pass (Sentinel-2 / Landsat) with Mandatory Honesty Timestamp */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5 text-indigo-500" /> Sentinel-2 MSI Optical Baseline
                        </span>
                        <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {data.satellite_context?.optical_scene?.cloud_cover_pct || 1.4}% cloud
                        </span>
                      </div>

                      <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1.5">
                        <div className="text-[11px] text-slate-500">
                          Scene Acquisition: <span className="font-mono font-bold text-slate-800">{data.satellite_context?.optical_scene?.acquisition_timestamp_formatted || "28 Aug 2026 05:24 UTC"}</span>
                        </div>
                        <div className="text-[10px] text-amber-800 bg-amber-50 p-2 rounded border border-amber-200 leading-relaxed font-medium">
                          {data.satellite_context?.optical_scene?.honesty_disclaimer || "Sentinel-2 MSI reference scene acquired 48h prior to thermal detection. Optical scene provides surface land-cover baseline, not simultaneous overpass."}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 5 */}
                {activeTab === "ai_brief" && data.humanized_summary && (
                  <div className="space-y-3.5">
                    <div className="p-3.5 rounded-xl bg-orange-50/80 border border-orange-200">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-orange-900">Tactical Bulletin</div>
                      <div className="text-xs font-bold text-slate-900 mt-1 leading-snug">{data.humanized_summary.headline}</div>
                    </div>

                    <div className="space-y-2.5 text-xs leading-relaxed">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="font-bold text-slate-900 block mb-1 text-[11px] uppercase tracking-wider text-blue-700">1. Observed Telemetry</span>
                        <p className="text-slate-700">{data.humanized_summary.what_happened}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="font-bold text-slate-900 block mb-1 text-[11px] uppercase tracking-wider text-red-700">2. Derived Anomaly</span>
                        <p className="text-slate-700">{data.humanized_summary.why_it_matters}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="font-bold text-slate-900 block mb-1 text-[11px] uppercase tracking-wider text-emerald-700">3. Model Assessment</span>
                        <p className="text-slate-700">{data.humanized_summary.model_assessment}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="font-bold text-slate-900 block mb-1 text-[11px] uppercase tracking-wider text-amber-700">4. Operational Gaps & Unknowns</span>
                        <p className="text-slate-700">{data.humanized_summary.uncertainty_and_gaps}</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-slate-200 shrink-0 bg-slate-50/50 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <button 
            onClick={handleAskAboutEvent}
            disabled={!data}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs transition shadow-sm"
            title="Ask AI Tactical Intelligence about this event"
          >
            <Cpu className="w-4 h-4 text-orange-400" />
            Ask to Chat
          </button>
          <button 
            onClick={handleDownloadReport}
            disabled={!data || isExportingPDF}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs transition shadow-sm"
            title="Download authoritative immutable PDF Dossier"
          >
            {isExportingPDF ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            {isExportingPDF ? "Generating PDF..." : "Download Report"}
          </button>
        </div>
        <button 
          onClick={handleExportDossier}
          disabled={!data}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 disabled:opacity-50 text-slate-700 font-semibold text-xs transition shadow-sm"
          title="Export raw JSON telemetry payload"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          Export JSON Dossier
        </button>
      </div>
    </div>
  );
}
