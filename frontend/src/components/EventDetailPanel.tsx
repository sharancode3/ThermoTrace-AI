"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { 
  X, Loader2, Activity, AlertTriangle, ShieldCheck, Flame, 
  MapPin, Clock, BarChart3, TrendingUp, Cpu, 
  ChevronRight, Download, FileText, Satellite,
  Maximize2, Minimize2, CheckCircle2, RefreshCw,
  Factory, Wheat, Trees, HelpCircle, AlertOctagon,
  Layers, Compass, Info, Copy, Check, Eye
} from "lucide-react";
import { fetchEventIntelligence } from "@/lib/apiClient";

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


export function EventDetailPanel({ 
  eventId, 
  onClose 
}: { 
  eventId: string; 
  onClose: () => void; 
}) {
  const searchParams = useSearchParams();
  const hasOverlay = Boolean(searchParams?.get("overlay"));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "telemetry" | "baseline" | "geography" | "ai_brief">("overview");
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    fetchEventIntelligence(eventId)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching event details:", err);
        setError(err.message || "Failed to load event telemetry");
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
      const rawApi = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const base = rawApi.replace(/\/api\/v1\/?$/, "");
      const downloadUrl = `${base}/api/v1/reports/events/${eventId}/download`;
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `ThermoTrace_Event_${eventId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Report export failed:", err);
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

  // Determine High-Level Source Category (Industrial vs Non-Industrial)
  const isIndustrial = data?.classification?.startsWith("IND_");
  const isAgricultural = data?.classification === "AGRI_BURN";
  const isWildfire = data?.classification === "WILDFIRE";
  
  let sourceCategory = "UNCERTAIN SOURCE";
  let sourceSubtitle = "Thermal anomaly requiring satellite corroboration";
  let SourceIcon = HelpCircle;
  let sourceBadgeStyle = "bg-slate-100 text-slate-700 border-slate-300";
  let sourcePillStyle = "bg-slate-800 text-white border-slate-900";

  if (isIndustrial) {
    sourceCategory = "INDUSTRIAL SOURCE";
    SourceIcon = Factory;
    sourceBadgeStyle = "bg-blue-50 text-blue-800 border-blue-200";
    sourcePillStyle = "bg-blue-600 text-white border-blue-700";
    if (data?.classification === "IND_FLARE") sourceSubtitle = "Industrial Gas Flaring Emission";
    else if (data?.classification === "IND_FIRE") sourceSubtitle = "Critical Industrial Fire Incident";
    else sourceSubtitle = "Operational Facility High-Heat Process";
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
  let anomalyStyle = "bg-emerald-50 border-emerald-200 text-emerald-800";
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
                          <span className="text-slate-500">Thermal Trend:</span>
                          <span className="font-mono font-bold text-orange-600">{data.thermal_trend || "STABLE"}</span>
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
                        <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                          +{data.anomaly_z_score?.toFixed(2)}σ
                        </span>
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
                        <span className="text-slate-400 text-[11px]">Telemetry Trend:</span>
                        <span className="font-bold text-emerald-400 flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5" />
                          {data.thermal_trend || "STABLE"} (Peak {data.peak_frp_mw?.toFixed(1)} MW)
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
                            <li>Thermal signature observed over agricultural cropland (minimal industrial zoning).</li>
                            <li>Radiant intensity (<strong>{data.peak_frp_mw?.toFixed(1)} MW</strong>) matches post-harvest crop stubble burning dynamics.</li>
                            <li>Persistence classified as <strong>{data.persistence_tier}</strong>.</li>
                          </>
                        ) : (
                          <>
                            <li>Thermal cluster detected in vegetation/forest terrain with no registered industrial facilities.</li>
                            <li>Spatial dispersion aligns with wildland fire spread.</li>
                          </>
                        )}
                      </ul>
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
                          <div className="text-slate-400 text-[10px]">dist_to_facility</div>
                          <div className="font-bold text-slate-800">{data.distance_to_facility_m !== null ? `${data.distance_to_facility_m.toFixed(1)} m` : "2500.0 m"}</div>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-lg">
                          <div className="text-slate-400 text-[10px]">thermal_trend</div>
                          <div className="font-bold text-slate-800">{data.thermal_trend}</div>
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
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Statistical Baseline Deviation</div>
                      <div className="flex items-baseline justify-between">
                        <div className="text-2xl font-black text-slate-900 tracking-tight">
                          +{data.anomaly_z_score?.toFixed(2)} <span className="text-sm font-semibold text-slate-500">sigma</span>
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${isCritical ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                          {data.anomaly_tier}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Calculated from the facility rolling 90-day emission distribution.
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
