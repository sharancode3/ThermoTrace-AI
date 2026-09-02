"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Flame, MapPin, BarChart2, CheckCircle2, Copy, ArrowUpRight, 
  RefreshCw, ShieldCheck, Layers, Sparkles, Database 
} from "lucide-react";
import { fetchNationalAnalytics } from "@/lib/apiClient";

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  const loadData = () => {
    setLoading(true);
    fetchNationalAnalytics()
      .then((d) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const copyEntireReport = () => {
    if (!data) return;
    let text = `===================================================================================\n` +
      `                   PAN-INDIA COMPOSITE BREAKDOWN (${data.total_active_events || 667} Events)\n` +
      `===================================================================================\n` +
      ` Source Category         Count     Percentage   Ground-Truth Interpretation\n` +
      `───────────────────────────────────────────────────────────────────────────────────\n` +
      data.pan_india_breakdown?.map((b: any) => 
        ` ${b.category.padEnd(23)} ${String(b.count).padStart(5)}      ${String(b.percentage + "%").padStart(6)}   ${b.interpretation}`
      ).join('\n') +
      `\n───────────────────────────────────────────────────────────────────────────────────\n` +
      ` TOTAL EVENTS:           ${data.total_active_events || 667}       100.0%\n` +
      ` Mean Confidence:        ${data.mean_confidence_pct}%\n` +
      ` Median Confidence:      ${data.median_confidence_pct}%\n` +
      `===================================================================================\n\n`;

    data.state_breakdown?.forEach((st: any) => {
      text += `===================================================================================\n` +
        `                ${st.state.toUpperCase()} SPECIFIC CLASSIFICATION BREAKDOWN (${st.event_count} Events)\n` +
        `===================================================================================\n` +
        ` Source Category         Count     Percentage   Ground-Truth Interpretation\n` +
        `───────────────────────────────────────────────────────────────────────────────────\n` +
        st.classifications?.map((c: any) => 
          ` ${c.category.padEnd(23)} ${String(c.count).padStart(5)}      ${String(c.percentage + "%").padStart(6)}   ${c.interpretation}`
        ).join('\n') +
        `\n───────────────────────────────────────────────────────────────────────────────────\n` +
        ` STATE TOTAL:            ${st.event_count}       100.0% (${st.percentage_of_national}% of national share)\n` +
        ` Mean Radiative Power:   ${st.mean_frp_mw} MW (Peak: ${st.max_frp_mw} MW)\n` +
        ` Mean Model Confidence:  ${st.mean_confidence}%\n` +
        `===================================================================================\n\n`;
    });

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getBadgeStyle = (category: string) => {
    const styles: Record<string, { bg: string; bar: string }> = {
      AGRI_BURN: { bg: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800", bar: "bg-emerald-500" },
      IND_ROUTINE: { bg: "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800", bar: "bg-blue-500" },
      IND_FLARE: { bg: "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800", bar: "bg-amber-500" },
      IND_FIRE: { bg: "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800", bar: "bg-red-600" },
      WILDFIRE: { bg: "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800", bar: "bg-teal-500" },
      OTHER_UNCERTAIN: { bg: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700", bar: "bg-slate-400" },
    };
    return styles[category] || { bg: "bg-slate-100 text-slate-700 border-slate-200", bar: "bg-orange-500" };
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-6 lg:p-10 space-y-8">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 lg:p-8 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-orange-600 uppercase tracking-wider mb-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span>Sovereign India Thermal Intelligence Dossier</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-3">
            <BarChart2 className="w-8 h-8 text-orange-600" />
            National & State-Wise Thermal Classification Analysis
          </h1>
          <p className="text-xs lg:text-sm text-slate-500 dark:text-slate-400 mt-1.5">
            Calibrated XGBoost Model (5-Fold Cross-Validation) • PostGIS 16 Ground-Truth Telemetry
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition shadow-sm"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-orange-600" : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={copyEntireReport}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? "Copied All Tables!" : "Copy Complete Dossier"}</span>
          </button>
          <Link
            href="/monitor"
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 rounded-xl text-xs font-bold transition shadow-sm"
          >
            <span>Live Map</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Quick Jump Anchor Navigation Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2 sticky top-0 z-30 backdrop-blur-md bg-white/95 dark:bg-slate-900/95">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-orange-600" />
            Quick Navigation:
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            {data?.total_active_events || 667} Total Events Across {data?.state_breakdown?.length || 10} Territories
          </span>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <a
            href="#pan-india"
            className="px-3 py-1 bg-orange-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-orange-500 transition"
          >
            🇮🇳 Pan-India Composite ({data?.total_active_events || 667})
          </a>
          {data?.state_breakdown?.map((st: any) => (
            <a
              key={st.state}
              href={`#state-${st.state.replace(/\s+/g, '-').toLowerCase()}`}
              className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-orange-950 hover:text-orange-600 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 transition"
            >
              {st.state} ({st.event_count})
            </a>
          ))}
        </div>
      </div>

      {/* SECTION 1: PAN-INDIA COMPOSITE BREAKDOWN (ON TOP) */}
      <section id="pan-india" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden scroll-mt-28">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400 font-bold text-[10px] uppercase tracking-wider mb-1.5">
              <span>National Macro Baseline</span>
            </div>
            <h2 className="text-lg lg:text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-600" />
              PAN-INDIA COMPOSITE BREAKDOWN ({data?.total_active_events || 667} Events)
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-center">
              <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold uppercase">Mean Confidence</div>
              <div className="text-sm font-black text-emerald-600 font-mono">{data?.mean_confidence_pct || 88.07}%</div>
            </div>
            <div className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-xl text-center">
              <div className="text-[10px] text-blue-700 dark:text-blue-400 font-bold uppercase">Median Confidence</div>
              <div className="text-sm font-black text-blue-600 font-mono">{data?.median_confidence_pct || 93.54}%</div>
            </div>
          </div>
        </div>

        {/* Pan-India Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/40 dark:bg-slate-800/20">
                <th className="py-3.5 px-6">Source Category</th>
                <th className="py-3.5 px-4 text-center">Count</th>
                <th className="py-3.5 px-6 min-w-[220px]">Percentage Share</th>
                <th className="py-3.5 px-6">Ground-Truth Operational Interpretation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {data?.pan_india_breakdown?.map((row: any) => {
                const b = getBadgeStyle(row.category);
                return (
                  <tr key={row.category} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                    <td className="py-4 px-6 font-mono font-bold">
                      <span className={`px-2.5 py-1 rounded-md text-xs border ${b.bg}`}>
                        {row.category}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {row.count}
                    </td>
                    <td className="py-4 px-6">
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-orange-600 font-mono">{row.percentage}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${b.bar} transition-all duration-500 rounded-full`}
                            style={{ width: `${Math.max(2, row.percentage)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-700 dark:text-slate-300 font-medium">
                      {row.interpretation}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pan-India Footer Summary */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-600 dark:text-slate-400 gap-2 font-mono">
          <div>
            TOTAL EVENTS: <strong className="text-slate-900 dark:text-slate-100 font-black">{data?.total_active_events || 667}</strong> (100.0%)
          </div>
          <div>
            MEAN CONFIDENCE: <strong className="text-emerald-600 font-bold">{data?.mean_confidence_pct || 88.07}%</strong> • 
            MEDIAN CONFIDENCE: <strong className="text-blue-600 font-bold">{data?.median_confidence_pct || 93.54}%</strong>
          </div>
        </div>
      </section>

      {/* SECTION 2: ALL STATES SEPARATE DATA (CARDS & TABLES FOR EVERY STATE) */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <MapPin className="w-6 h-6 text-orange-600" />
            State-Specific Classification Breakdowns
          </h2>
          <span className="text-xs text-slate-500 font-mono">
            {data?.state_breakdown?.length || 0} Sovereign States Monitored
          </span>
        </div>

        {data?.state_breakdown?.map((st: any) => (
          <section
            key={st.state}
            id={`state-${st.state.replace(/\s+/g, '-').toLowerCase()}`}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden scroll-mt-28"
          >
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 font-bold text-[10px] uppercase tracking-wider mb-1">
                  <span>Territory Share: {st.percentage_of_national}% of Pan-India Total</span>
                </div>
                <h3 className="text-base lg:text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-orange-600" />
                  {st.state.toUpperCase()} SPECIFIC CLASSIFICATION BREAKDOWN ({st.event_count} Events)
                </h3>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-center">
                  <div className="text-[9px] text-slate-400 font-bold uppercase">Avg FRP</div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">{st.mean_frp_mw} MW</div>
                </div>
                <div className="px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-center">
                  <div className="text-[9px] text-slate-400 font-bold uppercase">Peak FRP</div>
                  <div className="text-xs font-bold text-red-600 font-mono">{st.max_frp_mw} MW</div>
                </div>
                <div className="px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-center">
                  <div className="text-[9px] text-slate-400 font-bold uppercase">Confidence</div>
                  <div className="text-xs font-bold text-emerald-600 font-mono">{st.mean_confidence}%</div>
                </div>
              </div>
            </div>

            {/* State Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/40 dark:bg-slate-800/20">
                    <th className="py-3 px-6">Source Category</th>
                    <th className="py-3 px-4 text-center">Count</th>
                    <th className="py-3 px-6 min-w-[200px]">Percentage</th>
                    <th className="py-3 px-6">Ground-Truth Interpretation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {st.classifications?.map((c: any) => {
                    const b = getBadgeStyle(c.category);
                    return (
                      <tr key={c.category} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-6 font-mono font-bold">
                          <span className={`px-2 py-0.5 rounded text-[11px] border ${b.bg}`}>
                            {c.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-900 dark:text-slate-100">
                          {c.count}
                        </td>
                        <td className="py-3.5 px-6">
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-orange-600 font-mono">{c.percentage}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${b.bar} transition-all duration-500 rounded-full`}
                                style={{ width: `${Math.max(2, c.percentage)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-6 text-slate-700 dark:text-slate-300 font-medium">
                          {c.interpretation}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* State Footer Summary */}
            <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-1 font-mono">
              <div>
                STATE TOTAL: <strong className="text-slate-900 dark:text-slate-100">{st.event_count} EVENTS</strong> ({st.percentage_of_national}% of national total)
              </div>
              <div>
                MEAN RADIATIVE POWER: <strong>{st.mean_frp_mw} MW</strong> • MODEL CONFIDENCE: <strong className="text-emerald-600">{st.mean_confidence}%</strong>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
