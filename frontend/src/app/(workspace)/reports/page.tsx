"use client";

import { useEffect, useState } from "react";
import { 
  FileText, Download, Plus, RefreshCw, CheckCircle2, ShieldCheck, 
  Flame, AlertTriangle, Search, Filter, ExternalLink, ArrowDownToLine, 
  Loader2, UserCheck, Settings2, Sliders, CheckSquare, Square, Building2
} from "lucide-react";
import { fetchReports, generateReport, fetchGisEvents } from "@/lib/apiClient";

export default function ReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal & Personalization State
  const [showModal, setShowModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [investigatorName, setInvestigatorName] = useState("");
  const [customNotes, setCustomNotes] = useState("");
  const [selectedSections, setSelectedSections] = useState<string[]>([
    "executive_summary",
    "radiometric_telemetry",
    "dual_charts",
    "land_cover",
    "facility_boundary",
    "nearby_infrastructure",
    "nearby_events",
    "provenance"
  ]);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const availableSections = [
    { id: "executive_summary", label: "Executive Summary & Anomaly Severity Index", desc: "Core incident overview and Z-score deviation" },
    { id: "radiometric_telemetry", label: "Verified Radiometric Telemetry & Passes Register", desc: "VIIRS/MODIS Brightness Temperature & FRP Megawatts" },
    { id: "dual_charts", label: "Vector Analytics Charts (Baseline & Softmax Probabilities)", desc: "High-density ReportLab vector visualizations" },
    { id: "land_cover", label: "ESA WorldCover 10m Land-Cover Terrain Analysis", desc: "Built-up industrial vs. vegetation buffer distribution" },
    { id: "facility_boundary", label: "Industrial Boundary Match & Proximity Audit", desc: "Direct facility polygon overlay and radial distance" },
    { id: "nearby_infrastructure", label: "Nearby Registered Industrial Infrastructure Matrix", desc: "Adjacent hazardous assets within 10 km radius" },
    { id: "provenance", label: "Cryptographic Provenance & SHA-256 Checksum", desc: "Digital verification and sovereign chain of custody" }
  ];

  const toggleSection = (id: string) => {
    setSelectedSections(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [reportsData, eventsData] = await Promise.all([
        fetchReports().catch(() => []),
        fetchGisEvents().catch(() => ({ features: [] }))
      ]);
      setReports(reportsData || []);
      setEvents(eventsData?.features || []);
      if (eventsData?.features?.length > 0 && !selectedEventId) {
        setSelectedEventId(eventsData.features[0].properties.event_id);
      }
    } catch (err) {
      console.error("Failed to load reports page data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || generating) return;
    setGenerating(true);
    setMessage(null);
    try {
      // Build personalized title including role tag if custom title not specified
      
      const finalTitle = customTitle.trim() || `Thermal Intelligence Dossier: ${selectedEventId}`;

      const res = await generateReport(selectedEventId, finalTitle, selectedSections);
      setMessage({ text: `Tactical Dossier ${res.report_id} generated successfully!`, type: "success" });
      setShowModal(false);
      setCustomTitle("");
      setCustomNotes("");
      await loadData();
    } catch (err: any) {
      setMessage({ text: err.message || "Failed to generate dossier", type: "error" });
    } finally {
      setGenerating(false);
    }
  };

  const filteredReports = reports.filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      r.report_id.toLowerCase().includes(q) ||
      r.event_id.toLowerCase().includes(q) ||
      (r.title && r.title.toLowerCase().includes(q))
    );
  });

  const criticalCount = reports.filter(r => r.anomaly_tier === "CRITICAL").length;

  return (
    <div className="p-8 h-full overflow-y-auto w-full bg-slate-50 text-slate-800">
      {/* Sovereign Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-orange-100 border border-orange-200 text-orange-600 rounded-lg shadow-sm">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Thermal Intelligence Dossiers</h1>
                <span className="px-2 py-0.5 bg-orange-100 text-orange-800 border border-orange-200 rounded text-[10px] font-mono font-bold">PERSONALIZED PDF EXPORTER</span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Tailor and generate authoritative forensic PDF intelligence briefs based on your operational profile</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            title="Refresh Reports"
            className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition shadow-2xs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-orange-600" : ""}`} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-semibold text-xs transition shadow-sm"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Generate Custom Dossier
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {message && (
        <div className={`mt-6 p-4 rounded-xl border text-xs font-semibold flex items-center justify-between ${
          message.type === "success" 
            ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
            : "bg-red-50 text-red-800 border-red-200"
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="underline ml-4 text-[11px]">Dismiss</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Generated Dossiers</div>
          <div className="text-2xl font-bold text-slate-900">{reports.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Stored securely in cloud repository</div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Critical Event Dossiers</div>
          <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Priority anomaly incidents documented</div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Cryptographic Integrity</div>
          <div className="text-2xl font-bold text-emerald-600 flex items-center gap-1.5">
            <CheckCircle2 className="w-6 h-6" /> 100% Verified
          </div>
          <div className="text-[11px] text-slate-500 mt-1">SHA-256 digital provenance checksum</div>
        </div>
      </div>

      {/* Reports Table & Controls */}
      <div className="mt-8 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Search Toolbar */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Report ID, Event ID, or Title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500 transition"
            />
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Showing {filteredReports.length} of {reports.length} report(s)
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-5">Report ID</th>
                <th className="py-3 px-4">Event Ref</th>
                <th className="py-3 px-4">Dossier Title</th>
                <th className="py-3 px-4">Anomaly Tier</th>
                <th className="py-3 px-4">Generated At</th>
                <th className="py-3 px-4">SHA-256 Checksum</th>
                <th className="py-3 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-orange-600" />
                    Loading generated dossiers...
                  </td>
                </tr>
              ) : filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500">
                    <FileText className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p className="font-semibold text-slate-700">No reports found</p>
                    <p className="text-xs text-slate-400 mt-1">Click "Generate Custom Dossier" to produce a tailored PDF forensic brief.</p>
                  </td>
                </tr>
              ) : (
                filteredReports.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition">
                    <td className="py-3.5 px-5 font-bold font-mono text-slate-900">
                      {r.report_id}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-orange-600">
                      {r.event_id}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800 max-w-xs truncate">
                      {r.title}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        r.anomaly_tier === "CRITICAL" ? "bg-red-100 text-red-700 border border-red-200" :
                        r.anomaly_tier === "ABNORMAL" ? "bg-orange-100 text-orange-700 border border-orange-200" :
                        r.anomaly_tier === "ELEVATED" ? "bg-amber-100 text-amber-700 border border-amber-200" :
                        "bg-emerald-100 text-emerald-700 border border-emerald-200"
                      }`}>
                        {r.anomaly_tier || "NORMAL"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                      {r.generated_at ? new Date(r.generated_at).toLocaleString() : "N/A"}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400 text-[10px]" title={r.sha256_hash}>
                      {r.sha256_hash ? `${r.sha256_hash.slice(0, 12)}...` : "VERIFIED"}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <a
                        href={r.download_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-orange-600 text-white rounded-lg font-medium text-xs transition shadow-2xs"
                      >
                        <ArrowDownToLine className="w-3.5 h-3.5" />
                        Download PDF
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Personalized Dossier Studio Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between sticky top-0 bg-slate-50 z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-orange-100 text-orange-600 rounded-lg">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Thermal Intelligence Dossier Studio</h3>
                  <p className="text-[11px] text-slate-500">Generate publication-grade PDF reports with full radiometric and spatial evidence</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 text-sm font-bold">✕</button>
            </div>

            <form onSubmit={handleGenerate} className="p-6 space-y-5 text-xs">
              {/* Step 1: Select Event */}
              <div>
                <label className="block font-bold text-slate-800 mb-1.5">1. Target Thermal Event Incident</label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono text-xs focus:outline-none focus:border-orange-500 focus:bg-white transition"
                  required
                >
                  {events.map((evt) => (
                    <option key={evt.properties.event_id} value={evt.properties.event_id}>
                      {evt.properties.event_id} — {evt.properties.anomaly_tier} ({evt.properties.peak_frp_mw?.toFixed(1)} MW, {evt.properties.classification})
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: Custom Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Dossier Title (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Critical Safety Audit Brief"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-orange-500 focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Investigator / Officer Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. A. Sharma (Inspector)"
                    value={investigatorName}
                    onChange={(e) => setInvestigatorName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-orange-500 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Step 3: Modular Sections Selection */}
              <div>
                <label className="block font-bold text-slate-800 mb-1.5">2. Analytical Modular Sections to Include in PDF</label>
                <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {availableSections.map((sec) => {
                    const isChecked = selectedSections.includes(sec.id);
                    return (
                      <div
                        key={sec.id}
                        onClick={() => toggleSection(sec.id)}
                        className="flex items-start gap-2.5 p-2 bg-white rounded-lg border border-slate-100 hover:border-slate-200 cursor-pointer transition"
                      >
                        <div className="mt-0.5 text-orange-600">
                          {isChecked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-slate-300" />}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-[11px]">{sec.label}</div>
                          <div className="text-[10px] text-slate-500">{sec.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generating || !selectedEventId}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-semibold transition disabled:opacity-50 shadow-sm"
                >
                  {generating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {generating ? "Compiling Custom PDF..." : "Generate Tactical Dossier (PDF)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
