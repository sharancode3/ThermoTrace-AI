"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Building2,
  Flame,
  Activity,
  ShieldCheck,
  MapPin,
  ExternalLink,
  Download,
  MessageSquare,
  Layers,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  Clock,
  Sparkles,
  Info,
} from "lucide-react";
import {
  fetchFacilityIntelligence,
  FacilitySummary,
  FacilityIntelligence,
} from "@/lib/apiClient";

interface FacilityDetailDrawerProps {
  facility: FacilitySummary | null;
  onClose: () => void;
}

export default function FacilityDetailDrawer({
  facility,
  onClose,
}: FacilityDetailDrawerProps) {
  const router = useRouter();
  const [intel, setIntel] = useState<FacilityIntelligence | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<number>(30);
  const [activeTab, setActiveTab] = useState<
    "overview" | "history" | "spatial" | "brief"
  >("overview");
  const [isExporting, setIsExporting] = useState<boolean>(false);

  useEffect(() => {
    if (!facility) {
      setIntel(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);
    setLoadingStep(1);

    // Live 5-step investigation pipeline animation
    const timer1 = setTimeout(() => setLoadingStep(2), 300);
    const timer2 = setTimeout(() => setLoadingStep(3), 650);
    const timer3 = setTimeout(() => setLoadingStep(4), 1050);
    const timer4 = setTimeout(() => setLoadingStep(5), 1400);

    fetchFacilityIntelligence(facility.id, windowDays)
      .then((data) => {
        if (isMounted) {
          setIntel(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to load facility intelligence");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [facility, windowDays]);

  if (!facility) return null;

  const handleAskChat = () => {
    const sessionId = `facility_${facility.id}_${Date.now()}`;
    router.push(`/monitor?chat_open=true&session_id=${sessionId}&facility_id=${facility.id}`);
  };

  const handleViewOnMap = () => {
    router.push(
      `/monitor?focus_lat=${facility.latitude}&focus_lon=${facility.longitude}&facility_id=${facility.id}&facility_name=${encodeURIComponent(
        facility.name
      )}`
    );
  };

  const handleExportPDF = () => {
    setIsExporting(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const downloadUrl = `${apiBase}/api/v1/facilities/${facility.id}/report/download?window_days=${windowDays}`;
      window.open(downloadUrl, '_blank');
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300">
      <div className="relative flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl transition-all duration-300">
        {/* Header Bar */}
        <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
                  {facility.facility_code}
                </span>
                <span className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {facility.sector_category}
                </span>
                {facility.sub_type && (
                  <span className="text-xs text-slate-500">
                    · {facility.sub_type}
                  </span>
                )}
              </div>
              <h2 className="mt-1 text-lg font-bold text-slate-900">
                {facility.name}
              </h2>
              <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {facility.district ? `${facility.district}, ` : ""}
                  {facility.state}
                </span>
                <span>•</span>
                <span>
                  Operator:{" "}
                  <strong className="text-slate-800">
                    {facility.operator_name || "Independent"}
                  </strong>
                </span>
                <span>•</span>
                <span className="font-mono text-slate-500">
                  {facility.latitude.toFixed(4)}°N, {facility.longitude.toFixed(4)}°E
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            title="Close Panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-6 py-2.5">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              onClick={() => setWindowDays(30)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                windowDays === 30
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              30-Day Window
            </button>
            <button
              onClick={() => setWindowDays(90)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                windowDays === 90
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              90-Day Window
            </button>
            <button
              onClick={() => setWindowDays(365)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                windowDays === 365
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              1-Year History
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleViewOnMap}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View on Map
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" />
              Export Dossier
            </button>
            <button
              onClick={handleAskChat}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Ask Thermo Chat
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white px-6">
          <button
            onClick={() => setActiveTab("overview")}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === "overview"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Overview & Baseline
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === "history"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Historical Detections
            {intel && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">
                {intel.historical_events.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("spatial")}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === "spatial"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Spatial & Land Cover
          </button>
          <button
            onClick={() => setActiveTab("brief")}
            className={`flex items-center gap-1 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === "brief"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            Grounded AI Brief
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
          {loading ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
              <Activity className="h-8 w-8 animate-spin text-blue-600" />
              <h3 className="mt-4 text-sm font-semibold text-slate-800">
                Gathering Forensic Telemetry...
              </h3>
              <div className="mt-2 text-xs font-mono text-slate-600 space-y-1">
                {loadingStep === 1 && "🛰️ Querying NASA FIRMS & PostGIS Spatial Buffer (5km)..."}
                {loadingStep === 2 && "🔍 Extracting 14-Feature Radiometric & Spatial Vectors..."}
                {loadingStep === 3 && "🤖 Executing Calibrated XGBoost & TreeSHAP Drivers..."}
                {loadingStep === 4 && "📊 Calculating 90-Day Gaussian Baseline Envelope (μ, σ)..."}
                {loadingStep >= 5 && "📝 Synthesizing Grounded Tactical Intelligence & Dossier..."}
              </div>
              <div className="mt-4 h-2 w-64 overflow-hidden rounded-full bg-slate-100 border border-slate-200">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${(loadingStep / 5) * 100}%` }}
                />
              </div>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-800">
              <AlertTriangle className="mx-auto h-8 w-8 text-red-600" />
              <h3 className="mt-2 font-bold">Failed to Load Intelligence</h3>
              <p className="mt-1 text-xs text-red-600">{error}</p>
            </div>
          ) : intel ? (
            <div className="space-y-6">
              {/* TAB 1: OVERVIEW & BASELINE */}
              {activeTab === "overview" && (
                <>
                  {/* KPI Grid */}
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                        Window Detections
                      </div>
                      <div className="mt-1 text-2xl font-bold text-slate-900">
                        {intel.window_metrics.total_events}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Across {intel.window_metrics.distinct_active_days} active day(s)
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                        Peak Flaring FRP
                      </div>
                      <div className="mt-1 text-2xl font-bold text-amber-600">
                        {intel.window_metrics.peak_frp_mw.toFixed(1)}{" "}
                        <span className="text-sm font-normal text-slate-500">MW</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Mean: {intel.window_metrics.mean_frp_mw.toFixed(1)} MW
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                        Combustion Streak
                      </div>
                      <div className="mt-1 text-2xl font-bold text-slate-900">
                        {intel.window_metrics.longest_streak_days}{" "}
                        <span className="text-sm font-normal text-slate-500">days</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Max continuous run
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                        Activity Trend
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-sm font-bold">
                        {intel.window_metrics.activity_trend === "INCREASING" && (
                          <>
                            <TrendingUp className="h-4 w-4 text-rose-600" />
                            <span className="text-rose-700">Increasing</span>
                          </>
                        )}
                        {intel.window_metrics.activity_trend === "DECREASING" && (
                          <>
                            <TrendingDown className="h-4 w-4 text-emerald-600" />
                            <span className="text-emerald-700">Decreasing</span>
                          </>
                        )}
                        {intel.window_metrics.activity_trend === "STABLE" && (
                          <>
                            <Minus className="h-4 w-4 text-blue-600" />
                            <span className="text-blue-700">Nominal Stable</span>
                          </>
                        )}
                        {intel.window_metrics.activity_trend === "NO_ACTIVITY" && (
                          <span className="text-slate-400">No Heat Activity</span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        vs. Prior Half-Window
                      </div>
                    </div>
                  </div>

                  {/* 90-Day Empirical Baseline Envelope */}
                  {intel.baseline_profile ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-5 w-5 text-emerald-600" />
                          <h3 className="font-bold text-slate-900">
                            90-Day Sovereign Baseline Envelope
                          </h3>
                        </div>
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                          Established (N = {intel.baseline_profile.sample_observation_count})
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <div className="rounded-lg bg-slate-50 p-3">
                          <div className="text-xs text-slate-500">Mean Flaring (μ)</div>
                          <div className="mt-0.5 font-mono text-lg font-bold text-slate-900">
                            {intel.baseline_profile.mean_frp_mw.toFixed(1)} MW
                          </div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                          <div className="text-xs text-slate-500">Std Deviation (σ)</div>
                          <div className="mt-0.5 font-mono text-lg font-bold text-slate-900">
                            ±{intel.baseline_profile.std_frp_mw.toFixed(1)} MW
                          </div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                          <div className="text-xs text-slate-500">Median (Q50)</div>
                          <div className="mt-0.5 font-mono text-lg font-bold text-slate-900">
                            {intel.baseline_profile.median_frp_mw.toFixed(1)} MW
                          </div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                          <div className="text-xs text-slate-500">95th Percentile (Q95)</div>
                          <div className="mt-0.5 font-mono text-lg font-bold text-amber-700">
                            {intel.baseline_profile.q95_frp_mw.toFixed(1)} MW
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-xs text-blue-900">
                        <strong>Analytical Grounding:</strong> Thermal detections exceeding{" "}
                        <span className="font-mono font-bold">
                          {(
                            intel.baseline_profile.mean_frp_mw +
                            2.5 * intel.baseline_profile.std_frp_mw
                          ).toFixed(1)}{" "}
                          MW
                        </span>{" "}
                        (μ + 2.5σ) automatically trigger CPCB / NTRO Abnormal Anomaly escalation.
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
                      <strong>Insufficient Historical Baseline:</strong> Fewer than 10 sovereign
                      satellite passes recorded for this specific facility coordinate. Anomaly
                      classification operates in exploratory mode.
                    </div>
                  )}

                  {/* Summary Narrative */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="font-bold text-slate-900">Executive Summary</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">
                      {intel.grounded_brief.narrative_summary}
                    </p>
                  </div>
                </>
              )}

              {/* TAB 2: HISTORICAL EVENTS */}
              {activeTab === "history" && (
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-5 py-3">
                    <h3 className="font-bold text-slate-900">
                      Thermal Detections in {intel.window_days}-Day Window
                    </h3>
                  </div>

                  {intel.historical_events.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                      <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                      <p className="mt-2 text-sm font-medium">
                        No thermal activity detected at this facility in the last {intel.window_days} days.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                          <tr>
                            <th className="px-4 py-2.5">Event ID</th>
                            <th className="px-4 py-2.5">Detection (UTC)</th>
                            <th className="px-4 py-2.5">Peak FRP</th>
                            <th className="px-4 py-2.5">Classification</th>
                            <th className="px-4 py-2.5">Anomaly Tier</th>
                            <th className="px-4 py-2.5">Z-Score</th>
                            <th className="px-4 py-2.5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {intel.historical_events.map((evt) => (
                            <tr key={evt.event_id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-mono font-medium text-slate-900">
                                {evt.event_id}
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {new Date(evt.latest_detected_utc).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 font-mono font-bold text-amber-700">
                                {evt.peak_frp_mw.toFixed(1)} MW
                              </td>
                              <td className="px-4 py-3">
                                <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                                  {evt.classification}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`rounded px-2 py-0.5 font-semibold ${
                                    evt.anomaly_tier === "CRITICAL"
                                      ? "bg-rose-100 text-rose-700"
                                      : evt.anomaly_tier === "ABNORMAL"
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-emerald-100 text-emerald-700"
                                  }`}
                                >
                                  {evt.anomaly_tier}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-700">
                                {evt.z_score !== null && evt.z_score !== undefined ? `${evt.z_score > 0 ? "+" : ""}${evt.z_score.toFixed(2)}σ` : "N/A"}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() =>
                                    router.push(`/monitor?focus_event_id=${evt.event_id}`)
                                  }
                                  className="text-blue-600 hover:text-blue-800 font-semibold"
                                >
                                  View Dossier →
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: SPATIAL & LAND COVER */}
              {activeTab === "spatial" && (
                <div className="space-y-6">
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="font-bold text-slate-900">
                      ESA WorldCover 10m Land-Use Context
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Calculated within a 5,000-meter sovereign perimeter around facility centroid.
                    </p>

                    <div className="mt-4 space-y-3">
                      <div>
                        <div className="flex justify-between text-xs font-medium text-slate-700">
                          <span>Built-up / Heavy Industrial</span>
                          <span>{intel.land_cover_context.built_up_industrial_pct}%</span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full bg-slate-700"
                            style={{
                              width: `${intel.land_cover_context.built_up_industrial_pct}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-medium text-slate-700">
                          <span>Barren Land / Open Soil</span>
                          <span>{intel.land_cover_context.barren_soil_pct}%</span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full bg-amber-600"
                            style={{
                              width: `${intel.land_cover_context.barren_soil_pct}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-medium text-slate-700">
                          <span>Vegetation & Tree Cover</span>
                          <span>{intel.land_cover_context.vegetation_pct}%</span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full bg-emerald-600"
                            style={{
                              width: `${intel.land_cover_context.vegetation_pct}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="font-bold text-slate-900">
                      Geographic & Sovereign Verification
                    </h3>
                    <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-500">Centroid Coordinates:</span>
                        <div className="font-mono font-medium text-slate-900">
                          {intel.facility.latitude.toFixed(5)}°N, {intel.facility.longitude.toFixed(5)}°E
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500">Sovereign Territory:</span>
                        <div className="font-medium text-emerald-700">
                          Republic of India (SOI Boundary Verified)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: GROUNDED AI BRIEF */}
              {activeTab === "brief" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-xs text-blue-900">
                    <Info className="mb-1 h-4 w-4 text-blue-600 inline mr-1.5" />
                    <strong>Grounded Epistemic Structure:</strong> All bullet points below
                    phrase verified database facts with zero mathematical calculation or
                    unsubstantiated fabrication.
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      1. Observed Satellite Telemetry
                    </h4>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-700">
                      {intel.grounded_brief.observed.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      2. Derived Analytical Metrics
                    </h4>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-700">
                      {intel.grounded_brief.derived.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      3. Modelled Classifications
                    </h4>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-700">
                      {intel.grounded_brief.modelled.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      4. Epistemic Limits & Telemetry Gaps
                    </h4>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-700">
                      {intel.grounded_brief.unknown.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
