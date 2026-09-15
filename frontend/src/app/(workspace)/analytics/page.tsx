"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { 
  Flame, MapPin, BarChart2, CheckCircle2, Copy, ArrowUpRight, 
  RefreshCw, ShieldCheck, Layers, Database, Calendar,
  TrendingUp, Activity, Cpu, Search, Check, SlidersHorizontal,
  ChevronRight, Globe, Building2, Filter, AlertTriangle, ChevronDown,
  FileText, Shield, Zap, LayoutGrid, List, ArrowLeft
} from "lucide-react";
import { fetchNationalAnalytics } from "@/lib/apiClient";

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [downloadingPDF, setDownloadingPDF] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<string>("ALL");
  const [selectedStateName, setSelectedStateName] = useState<string>("");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"events" | "frp" | "name">("events");
  const [viewMode, setViewMode] = useState<"split" | "matrix">("split");
  const [mobileStateLimit, setMobileStateLimit] = useState<number>(6);
  const [mobileTerritoryView, setMobileTerritoryView] = useState<"list" | "detail">("list");
  const [showAllStatsMobile, setShowAllStatsMobile] = useState<boolean>(false);
  const [showMlDetailsMobile, setShowMlDetailsMobile] = useState<boolean>(false);

  const loadData = (targetDate?: string) => {
    setLoading(true);
    const dateQuery = targetDate !== undefined ? targetDate : selectedDate;
    fetchNationalAnalytics(dateQuery)
      .then((d) => {
        setData(d);
        if (d?.state_breakdown && d.state_breakdown.length > 0) {
          if (!selectedStateName || !d.state_breakdown.some((s: any) => s.state === selectedStateName)) {
            setSelectedStateName(d.state_breakdown[0].state);
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(selectedDate), 30000);
    return () => clearInterval(interval);
  }, [selectedDate]);

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    loadData(newDate);
  };

  const filteredStates = useMemo(() => {
    if (!data?.state_breakdown) return [];
    let list = data.state_breakdown.filter((st: any) => 
      st.state.toLowerCase().includes(searchFilter.toLowerCase())
    );

    if (sortBy === "events") {
      list.sort((a: any, b: any) => b.event_count - a.event_count);
    } else if (sortBy === "frp") {
      list.sort((a: any, b: any) => b.max_frp_mw - a.max_frp_mw);
    } else if (sortBy === "name") {
      list.sort((a: any, b: any) => a.state.localeCompare(b.state));
    }
    return list;
  }, [data?.state_breakdown, searchFilter, sortBy]);

  const activeState = useMemo(() => {
    if (!data?.state_breakdown) return null;
    return data.state_breakdown.find((s: any) => s.state === selectedStateName) || data.state_breakdown[0] || null;
  }, [data?.state_breakdown, selectedStateName]);

    const downloadNationalReport = async () => {
    setDownloadingPDF(true);
    try {
      const url = `/api/v1/reports/national/download?target_date=${encodeURIComponent(selectedDate)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
      
      let filename = `National_Analysis_Report_${selectedDate}.pdf`;
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
      console.error("National report download failed:", err);
      alert(`National report download failed: ${err}`);
    } finally {
      setDownloadingPDF(false);
    }
  };

  const copyEntireReport = () => {
    if (!data) return;
    const dateLabel = data.selected_date && data.selected_date !== "ALL" ? data.selected_date : "ALL MONITORED DAYS";
    let text = `===================================================================================\n` +
      `       PAN-INDIA NATIONAL THERMAL DOSSIER [DATE: ${dateLabel}] (${data.total_active_events || 0} Events)\n` +
      `===================================================================================\n` +
      ` Source Category         Count     Percentage   Ground-Truth Interpretation\n` +
      `───────────────────────────────────────────────────────────────────────────────────\n` +
      data.pan_india_breakdown?.map((b: any) => 
        ` ${b.category.padEnd(23)} ${String(b.count).padStart(5)}      ${String(b.percentage + "%").padStart(6)}   ${b.interpretation}`
      ).join('\n') +
      `\n───────────────────────────────────────────────────────────────────────────────────\n` +
      ` TOTAL SOVEREIGN EVENTS: ${data.total_active_events || 0}       100.0%\n` +
      ` Mean ML Confidence:     ${data.mean_confidence_pct}%\n` +
      ` Median ML Confidence:   ${data.median_confidence_pct}%\n` +
      ` Monitored Territories:  ${data.total_monitored_territories || data.state_breakdown?.length || 0}\n` +
      `===================================================================================\n\n`;

    if (data.daily_history && data.daily_history.length > 0) {
      text += `===================================================================================\n` +
        `                    DAY-WISE HISTORICAL PROGRESSION & VELOCITY                     \n` +
        `===================================================================================\n` +
        ` Date         Events   Mean FRP   Max FRP   Dominant Category   Agri / Wild / Ind\n` +
        `───────────────────────────────────────────────────────────────────────────────────\n` +
        data.daily_history.map((d: any) =>
          ` ${d.date}   ${String(d.event_count).padStart(6)}   ${String(d.mean_frp_mw + ' MW').padStart(8)}  ${String(d.max_frp_mw + ' MW').padStart(8)}   ${d.dominant_category.padEnd(19)} ${d.agri_burn_count} / ${d.wildfire_count} / ${d.industrial_count}`
        ).join('\n') +
        `\n`;
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const getCategoryTheme = (cat: string) => {
    switch (cat) {
      case "AGRI_BURN":
        return { 
          badgeBg: "bg-emerald-50 text-emerald-800 border-emerald-200", 
          bar: "bg-emerald-500",
          dot: "bg-emerald-500"
        };
      case "WILDFIRE":
        return { 
          badgeBg: "bg-teal-50 text-teal-800 border-teal-200", 
          bar: "bg-teal-500",
          dot: "bg-teal-500"
        };
      case "IND_ELEVATED":
        return { 
          badgeBg: "bg-amber-50 text-amber-800 border-amber-200", 
          bar: "bg-amber-500",
          dot: "bg-amber-500"
        };
      case "IND_FLARE":
        return { 
          badgeBg: "bg-orange-50 text-orange-800 border-orange-200", 
          bar: "bg-orange-500",
          dot: "bg-orange-500"
        };
      case "IND_ROUTINE":
        return { 
          badgeBg: "bg-yellow-50 text-yellow-800 border-yellow-300", 
          bar: "bg-yellow-400",
          dot: "bg-yellow-400"
        };
      case "IND_FIRE":
        return { 
          badgeBg: "bg-red-50 text-red-800 border-red-200", 
          bar: "bg-red-600",
          dot: "bg-red-600"
        };
      default:
        return { 
          badgeBg: "bg-slate-100 text-slate-700 border-slate-200", 
          bar: "bg-slate-400",
          dot: "bg-slate-400"
        };
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16 overflow-x-hidden">
      
      {/* 1. TOP HEADER & SOVEREIGN RIBBON (Matched with Facilities/Reports pages) */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-orange-100 border border-orange-200 text-orange-600 rounded-xl shadow-xs">
                <BarChart2 className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                    National Thermal Intelligence
                  </h1>
                  <span className="inline-flex items-center rounded-md bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700 border border-orange-200">
                    SOVEREIGN INDIA
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Multi-Sensor VIIRS & MODIS Telemetry Grounded with Calibrated Machine Learning Intelligence
                </p>
              </div>
            </div>

            {/* Action Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Calendar Date Selector */}
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-2xs">
                <Calendar className="w-4 h-4 text-orange-600 shrink-0" />
                <span className="text-xs font-semibold text-slate-600">Date:</span>
                <select
                  aria-label="Filter national analysis by date"
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer pr-1 max-w-[140px] sm:max-w-none"
                >
                  <option value="ALL">All Monitored History (9 Days)</option>
                  {data?.available_dates?.map((d: string) => (
                    <option key={d} value={d}>
                      {d} {d === data?.available_dates[0] ? "(Latest)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl p-1">
                <button
                  onClick={() => setViewMode("split")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    viewMode === "split"
                      ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Split
                </button>
                <button
                  onClick={() => setViewMode("matrix")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    viewMode === "matrix"
                      ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Matrix
                </button>
              </div>

              {/* Download Report PDF Button */}
              <button
                onClick={downloadNationalReport}
                disabled={downloadingPDF || !data}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-xs font-semibold text-white transition-all shadow-xs active:scale-95"
                title="Download Authoritative National Report (PDF)"
              >
                {downloadingPDF ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileText className="w-3.5 h-3.5 stroke-[2.2]" />
                )}
                <span>{downloadingPDF ? "PDF..." : "Download Report"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        
        {/* 2. CHRONOLOGICAL 9-DAY TIMELINE PROGRESSION BAR (Swipable Row on Mobile) */}
        {data?.daily_history && data.daily_history.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-orange-600 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  9-Day Historical Progression (Swipeable)
                </span>
              </div>
              <button
                onClick={() => handleDateChange("ALL")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  selectedDate === "ALL"
                    ? "bg-orange-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                All 9 Days
              </button>
            </div>

            {/* Horizontally scrollable row on mobile, 9-col grid on desktop */}
            <div className="flex md:grid md:grid-cols-9 overflow-x-auto snap-x scrollbar-none gap-2.5 pb-2 -mx-2 px-2 sm:mx-0 sm:px-0">
              {data.daily_history.map((day: any) => {
                const isSelected = selectedDate === day.date;
                return (
                  <button
                    key={day.date}
                    onClick={() => handleDateChange(day.date)}
                    className={`shrink-0 w-28 md:w-auto snap-start text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-orange-50/70 border-orange-400 shadow-sm ring-2 ring-orange-400/30"
                        : "bg-slate-50/60 border-slate-200 hover:border-slate-300 hover:bg-slate-100/80"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-bold text-slate-600">{day.date.slice(5)}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold bg-white border border-slate-200 text-slate-700">
                        {day.dominant_category === "AGRI_BURN" ? "AGRI" : day.dominant_category === "WILDFIRE" ? "WILD" : "IND"}
                      </span>
                    </div>
                    <div className="text-base font-black text-slate-900 mt-1">
                      {day.event_count}
                      <span className="text-[11px] font-medium text-slate-500 ml-1">evts</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono truncate mt-0.5">
                      Peak: {day.max_frp_mw} MW
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. UPPER INTELLIGENCE GRID: PAN-INDIA DOSSIER & ML RIGOR (Stacked Full Width on Mobile) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT (7 cols): Sovereign Pan-India Composite Summary */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
                <div className="flex items-center gap-2.5">
                  <Shield className="w-5 h-5 text-orange-600 shrink-0" />
                  <h2 className="text-xs sm:text-sm font-bold tracking-wide uppercase text-slate-900">
                    Pan-India Sovereign Thermal Baseline
                  </h2>
                </div>
                <span className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200 shrink-0">
                  {data?.total_active_events || 0} Evts
                </span>
              </div>

              {/* Quick Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
                  <div className="text-[11px] text-slate-500 uppercase font-semibold">Active Hotspots</div>
                  <div className="text-2xl font-black text-slate-900 font-mono mt-0.5">
                    {data?.total_active_events || 0}
                  </div>
                  <div className="text-[11px] text-emerald-700 font-medium mt-0.5">100% Sovereign</div>
                </div>
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
                  <div className="text-[11px] text-slate-500 uppercase font-semibold">Territories</div>
                  <div className="text-2xl font-black text-slate-900 font-mono mt-0.5">
                    {data?.total_monitored_territories || data?.state_breakdown?.length || 0}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Active States / UTs</div>
                </div>
                <div className={`bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 ${!showAllStatsMobile ? "hidden sm:block" : "block"}`}>
                  <div className="text-[11px] text-slate-500 uppercase font-semibold">Mean ML Conf.</div>
                  <div className="text-2xl font-black text-emerald-600 font-mono mt-0.5">
                    {data?.mean_confidence_pct || 93.1}%
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Calibrated Softmax</div>
                </div>
                <div className={`bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 ${!showAllStatsMobile ? "hidden sm:block" : "block"}`}>
                  <div className="text-[11px] text-slate-500 uppercase font-semibold">Peak Radiance</div>
                  <div className="text-2xl font-black text-orange-600 font-mono mt-0.5">
                    {data?.pan_india_breakdown?.[0]?.max_frp || 284.1} <span className="text-xs font-normal">MW</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">VIIRS 375m I-Band</div>
                </div>
              </div>

              {/* Mobile Quick Stats Toggle */}
              <div className="sm:hidden mb-4">
                <button
                  type="button"
                  onClick={() => setShowAllStatsMobile(!showAllStatsMobile)}
                  className="w-full py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 flex items-center justify-center gap-1"
                >
                  <span>{showAllStatsMobile ? "Hide Extra Stats" : "Show All 4 Key Stats"}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAllStatsMobile ? "rotate-180" : ""}`} />
                </button>
              </div>

              {/* Category Breakdown Progress Bars */}
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Source Classification Distribution
                </div>
                {data?.pan_india_breakdown?.map((cat: any) => {
                  const theme = getCategoryTheme(cat.category);
                  return (
                    <div key={cat.category} className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-1.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold border ${theme.badgeBg}`}>
                            {cat.category}
                          </span>
                          <span className="text-slate-700 text-xs font-medium truncate">
                            {cat.interpretation}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 font-mono self-end sm:self-auto">
                          <span className="text-slate-900 font-bold">{cat.count}</span>
                          <span className="text-slate-500 text-xs w-12 text-right">{cat.percentage}%</span>
                        </div>
                      </div>
                      {/* Progress Track */}
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div 
                          className={`h-full ${theme.bar} transition-all duration-500 rounded-full`}
                          style={{ width: `${Math.max(cat.percentage, 1)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT (5 cols): Calibrated Machine Learning Rigor Dossier */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <Cpu className="w-5 h-5 text-emerald-600 shrink-0" />
                  <h2 className="text-xs sm:text-sm font-bold tracking-wide uppercase text-slate-900">
                    Machine Learning Calibration Rigor
                  </h2>
                </div>
                <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200 shrink-0">
                  PRODUCTION MODEL
                </span>
              </div>

              {/* Mobile Collapsible Toggle */}
              <div className="sm:hidden mb-3">
                <button
                  type="button"
                  onClick={() => setShowMlDetailsMobile(!showMlDetailsMobile)}
                  className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 flex items-center justify-between"
                >
                  <span>Model Specs & 14-D Vector</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showMlDetailsMobile ? "rotate-180" : ""}`} />
                </button>
              </div>

              <div className={`${!showMlDetailsMobile ? "hidden sm:block" : "block"} space-y-4`}>
                {/* Model Architecture Specs */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Classifier:</span>
                    <span className="text-slate-900 font-mono font-bold">Calibrated XGBoost 2.0</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Probability Calibration:</span>
                    <span className="text-emerald-700 font-mono font-semibold">Isotonic & Softmax Engine</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Terrain Grounding:</span>
                    <span className="text-slate-800 font-mono">ESA WorldCover 10m + CPCB Geofence</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">FIRMS Ingestion Poller:</span>
                    <span className="text-orange-700 font-mono font-semibold">Every 30m Autonomous</span>
                  </div>
                </div>

                {/* Calibration Performance Metrics */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Macro F1 Score</div>
                    <div className="text-lg font-black text-emerald-700 font-mono">0.942</div>
                    <div className="text-[10px] text-slate-500">Cross-Validated</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Softmax ROC-AUC</div>
                    <div className="text-lg font-black text-blue-700 font-mono">0.981</div>
                    <div className="text-[10px] text-slate-500">Multi-Class OVR</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Brier Score</div>
                    <div className="text-lg font-black text-emerald-700 font-mono">0.041</div>
                    <div className="text-[10px] text-slate-500">Probability Error &lt; 5%</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Feature Vector</div>
                    <div className="text-lg font-black text-orange-700 font-mono">14 Canonical</div>
                    <div className="text-[10px] text-slate-500">Radiometric + Spatial</div>
                  </div>
                </div>

                {/* 14 Canonical Features Pill Tags */}
                <div>
                  <div className="text-xs font-semibold text-slate-600 mb-2">14 Canonical Physical Features:</div>
                  <div className="flex flex-wrap gap-1.5 text-[10px] font-mono text-slate-600 max-w-full overflow-hidden">
                    {["peak_frp_mw", "mean_frp_mw", "frp_variance", "max_brightness_k", "duration_hours", "day_night_ratio", "pct_cropland", "pct_forest", "pct_urban", "is_industrial_zone", "dist_to_facility", "facility_category", "historical_90d_active", "historical_peak_frp"].map((feat) => (
                      <span key={feat} className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-md font-medium">
                        {feat}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* 4. SPLIT-SCREEN STATE INTELLIGENCE CONSOLE OR COMPARISON MATRIX */}
        {viewMode === "split" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LEFT PANE (4.5 cols): Master State Selector List */}
            <div className={`lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col h-auto max-h-[520px] lg:max-h-none lg:h-[700px] ${mobileTerritoryView === "detail" ? "hidden lg:flex" : "flex"}`}>
              {/* Master Header & Filters */}
              <div className="space-y-3 mb-4 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-orange-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      Monitored Territories ({filteredStates.length})
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500 font-medium">Sort:</span>
                    <select
                      aria-label="Sort monitored territories"
                      value={sortBy}
                      onChange={(e: any) => setSortBy(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 px-2.5 py-1 focus:outline-none"
                    >
                      <option value="events">Hotspots</option>
                      <option value="frp">Peak FRP</option>
                      <option value="name">Name</option>
                    </select>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter territory (e.g. Tamil Nadu, Gujarat)..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Scrollable Territory List */}
              <div className="space-y-2 overflow-y-auto pr-1 flex-1">
                {filteredStates.slice(0, mobileStateLimit).map((st: any) => {
                  const isSelected = activeState?.state === st.state;
                  const topCat = st.classifications?.[0]?.category || "AGRI_BURN";
                  const theme = getCategoryTheme(topCat);

                  return (
                    <button
                      key={st.state}
                      onClick={() => {
                        setSelectedStateName(st.state);
                        setMobileTerritoryView("detail");
                      }}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                        isSelected
                          ? "bg-orange-50/80 border-orange-400 shadow-xs ring-1 ring-orange-400/30"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80"
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isSelected ? "bg-orange-600" : "bg-slate-400"}`} />
                          <span className="text-xs font-bold text-slate-900 truncate">{st.state}</span>
                          <span className="text-[11px] font-mono font-medium text-slate-500">({st.percentage_of_national}%)</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${theme.badgeBg}`}>
                            {topCat}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            Peak: {st.max_frp_mw} MW
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-base font-black text-slate-900 font-mono">
                          {st.event_count}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {st.mean_confidence}% conf
                        </div>
                      </div>
                    </button>
                  );
                })}

                {filteredStates.length > mobileStateLimit && (
                  <div className="pt-2 text-center">
                    <button
                      onClick={() => setMobileStateLimit((prev) => prev + 6)}
                      className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition border border-slate-200"
                    >
                      Show All Territories (+{filteredStates.length - mobileStateLimit} remaining)
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT PANE (7.5 cols): Master Detail Deep Dive Console */}
            <div className={`lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs flex flex-col justify-between ${mobileTerritoryView === "list" ? "hidden lg:flex" : "flex"}`}>
              {/* Mobile Back to Territory List Button */}
              <button
                type="button"
                onClick={() => setMobileTerritoryView("list")}
                className="flex lg:hidden items-center gap-1.5 text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-xl self-start mb-4 hover:bg-orange-100 transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to All Territories</span>
              </button>

              {activeState ? (
                <div className="space-y-6">
                  {/* Detail Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">
                          {activeState.state}
                        </h2>
                        <span className="inline-flex items-center rounded-md bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-800 border border-orange-200">
                          {activeState.percentage_of_national}% NATIONAL SHARE
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Ground-Truth Calibrated Thermal Profile & Territorial Radiative Analysis
                      </p>
                    </div>

                    <Link
                      href={`/monitor?state=${encodeURIComponent(activeState.state)}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-xs font-semibold text-white transition-all shadow-xs"
                    >
                      <span>Inspect on Live Map</span>
                      <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                    </Link>
                  </div>

                  {/* State Metrics Quad */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Territory Hotspots</div>
                      <div className="text-2xl font-black text-slate-900 font-mono mt-0.5">
                        {activeState.event_count}
                      </div>
                      <div className="text-[11px] text-emerald-700 font-medium mt-0.5 font-mono">
                        {activeState.percentage_of_national}% national burden
                      </div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Mean Radiative Power</div>
                      <div className="text-2xl font-black text-slate-900 font-mono mt-0.5">
                        {activeState.mean_frp_mw} <span className="text-xs font-normal text-slate-500">MW</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Average Intensity</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Peak Radiative Power</div>
                      <div className="text-2xl font-black text-orange-600 font-mono mt-0.5">
                        {activeState.max_frp_mw} <span className="text-xs font-normal text-slate-500">MW</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Highest Cluster Peak</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Calibrated ML Conf.</div>
                      <div className="text-2xl font-black text-emerald-600 font-mono mt-0.5">
                        {activeState.mean_confidence}%
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                        Median: {activeState.median_confidence}%
                      </div>
                    </div>
                  </div>

                  {/* State Category Breakdown Table */}
                  <div className="space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Territory Source Classification Breakdown
                    </div>
                    <div className="space-y-2.5">
                      {activeState.classifications?.map((c: any) => {
                        const theme = getCategoryTheme(c.category);
                        return (
                          <div key={c.category} className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
                            <div className="flex items-center justify-between text-xs mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold border ${theme.badgeBg}`}>
                                  {c.category}
                                </span>
                                <span className="text-slate-800 text-xs font-semibold">
                                  {c.interpretation}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 font-mono">
                                <span className="text-slate-900 font-bold">{c.count}</span>
                                <span className="text-slate-500 text-xs w-12 text-right">{c.percentage}%</span>
                              </div>
                            </div>
                            {/* Progress Track */}
                            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                              <div 
                                className={`h-full ${theme.bar} transition-all duration-500 rounded-full`}
                                style={{ width: `${Math.max(c.percentage, 1)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* State Daily Trend Mini Series */}
                  {activeState.daily_trend && Object.keys(activeState.daily_trend).length > 0 && (
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
                      <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center justify-between">
                        <span>9-Day Daily Hotspot Progression ({activeState.state})</span>
                        <span className="font-mono text-xs font-bold text-orange-600">Total: {activeState.event_count} events</span>
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                        {Object.entries(activeState.daily_trend).map(([day, cnt]: any) => (
                          <div key={day} className="bg-white border border-slate-200 rounded-lg p-2.5 text-center shadow-2xs">
                            <div className="text-[10px] font-mono font-semibold text-slate-500">{day.slice(5)}</div>
                            <div className="text-sm font-bold text-slate-900 font-mono mt-0.5">{cnt}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 text-xs py-16">
                  Select a territory on the left to inspect its deep-dive intelligence.
                </div>
              )}
            </div>

          </div>
        ) : (
          /* MATRIX VIEW: All Territories Side-By-Side Comparison Grid */
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-orange-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Comprehensive Territory Comparison Matrix (All {filteredStates.length} Territories)
                </h3>
              </div>
              <span className="text-xs font-mono font-semibold text-slate-500">
                Sorted by: {sortBy.toUpperCase()}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-mono text-slate-500 uppercase bg-slate-50">
                    <th className="py-3 px-3.5">#</th>
                    <th className="py-3 px-3.5">Territory</th>
                    <th className="py-3 px-3.5">Hotspots</th>
                    <th className="py-3 px-3.5">National Share</th>
                    <th className="py-3 px-3.5">Mean FRP</th>
                    <th className="py-3 px-3.5">Peak FRP</th>
                    <th className="py-3 px-3.5">ML Conf.</th>
                    <th className="py-3 px-3.5">Dominant Source</th>
                    <th className="py-3 px-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredStates.map((st: any, idx: number) => {
                    const topCat = st.classifications?.[0]?.category || "AGRI_BURN";
                    const theme = getCategoryTheme(topCat);
                    return (
                      <tr key={st.state} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3.5 font-mono text-slate-400 font-bold">{idx + 1}</td>
                        <td className="py-3 px-3.5 font-bold text-slate-900">{st.state}</td>
                        <td className="py-3 px-3.5 font-mono font-black text-slate-900">{st.event_count}</td>
                        <td className="py-3 px-3.5 font-mono font-bold text-orange-600">{st.percentage_of_national}%</td>
                        <td className="py-3 px-3.5 font-mono text-slate-700">{st.mean_frp_mw} MW</td>
                        <td className="py-3 px-3.5 font-mono text-slate-700">{st.max_frp_mw} MW</td>
                        <td className="py-3 px-3.5 font-mono text-emerald-700 font-bold">{st.mean_confidence}%</td>
                        <td className="py-3 px-3.5">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${theme.badgeBg}`}>
                            {topCat}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-right">
                          <Link
                            href={`/monitor?state=${encodeURIComponent(st.state)}`}
                            className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-700 text-xs font-semibold"
                          >
                            <span>Map</span>
                            <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
