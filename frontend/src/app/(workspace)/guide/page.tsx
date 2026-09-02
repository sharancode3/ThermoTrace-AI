"use client";

import { useState } from "react";
import { 
  BookOpen, ShieldCheck, Flame, Satellite, Layers, Cpu, 
  Building2, BarChart3, Database, FileText, CheckCircle2, 
  AlertTriangle, Search, ChevronRight, Activity, Globe, 
  Radar, Sparkles, Server, Info, Compass, HelpCircle, Lock,
  Trees, Factory, Zap, CloudSun
} from "lucide-react";

export default function SystemGuidePage() {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const sections = [
    {
      id: "overview",
      badge: "Mandate & Mission",
      badgeColor: "bg-orange-100 text-orange-800 border-orange-200",
      title: "Sovereign Mandate & Operational Architecture",
      icon: ShieldCheck,
      iconColor: "text-orange-600 bg-orange-50 border-orange-200",
      description: "Autonomous pan-India industrial emission intelligence, forest wildfire tracking, and crop residue monitoring across all 28 States and 8 Union Territories.",
      content: (
        <div className="space-y-4 text-xs text-slate-600">
          <p className="leading-relaxed">
            <strong className="text-slate-900 font-semibold">ThermoTrace AI</strong> is an enterprise sovereign intelligence platform engineered for continuous, automated thermal infrared detection across the entire geographic expanse of the Republic of India. The system bridges space-borne radiometric telemetry with localized industrial facility baselines to deliver real-time forensic attribution of thermal anomalies.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-orange-600" /> Pan-India Geofence
              </div>
              <p className="text-[11px] text-slate-500">Strict Survey of India territorial envelope [68°E – 97°E, 6°N – 37°N] covering all 36 sovereign States and Union Territories.</p>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <Radar className="w-4 h-4 text-orange-600" /> 15-Minute Cadence
              </div>
              <p className="text-[11px] text-slate-500">Autonomous ingestion daemon synchronized with NASA FIRMS LANCE near-real-time satellite downlinks.</p>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-orange-600" /> Forensic Integrity
              </div>
              <p className="text-[11px] text-slate-500">Cryptographically verifiable 2-page PDF intelligence dossiers stamped with SHA-256 digital provenance checksums.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "dataset-scope",
      badge: "Current Scope & ML Training Notice",
      badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
      title: "Production Dataset & ML Training Scope",
      icon: Database,
      iconColor: "text-blue-600 bg-blue-50 border-blue-200",
      description: "Transparency disclosure on the 808 verified industrial facilities currently active in the database and the multi-sensor satellite telemetry used to train the machine learning models.",
      content: (
        <div className="space-y-4 text-xs text-slate-600">
          <div className="p-4 bg-blue-50/70 rounded-xl border border-blue-200 text-blue-900 space-y-2">
            <div className="font-bold text-sm flex items-center gap-2 text-blue-900">
              <Info className="w-4 h-4 text-blue-600" /> Dataset & Model Calibration Disclosure
            </div>
            <p className="text-[11px] leading-relaxed text-blue-800">
              In this production deployment, the platform is pre-loaded with <strong>808 verified high-emission industrial facilities</strong> cataloged across primary national sectors (Petroleum Refineries, Integrated Steel Works, Thermal Power Stations, Cement Kilns, Petrochemical Plants, and Coal Mines). The Machine Learning classifiers (XGBoost & Random Forest) and 90-day empirical statistical baselines are trained on real multi-sensor FIRMS telemetry corresponding to these facilities.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-2">
              <div className="font-bold text-slate-900 text-xs flex items-center justify-between">
                <span>Active Facility Sectors</span>
                <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">808 PLANTS</span>
              </div>
              <ul className="space-y-1 text-[11px] text-slate-500">
                <li className="flex justify-between"><span>• Thermal Power Plants</span><strong className="text-slate-800">242 units</strong></li>
                <li className="flex justify-between"><span>• Integrated Steel Complexes</span><strong className="text-slate-800">186 units</strong></li>
                <li className="flex justify-between"><span>• Petroleum Refineries & Gas</span><strong className="text-slate-800">134 units</strong></li>
                <li className="flex justify-between"><span>• Cement & Lime Kilns</span><strong className="text-slate-800">128 units</strong></li>
                <li className="flex justify-between"><span>• Petrochemical & Chemical</span><strong className="text-slate-800">72 units</strong></li>
                <li className="flex justify-between"><span>• Open-cast Coal Mines</span><strong className="text-slate-800">46 units</strong></li>
              </ul>
            </div>
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-2">
              <div className="font-bold text-slate-900 text-xs flex items-center justify-between">
                <span>Dynamic Extensibility</span>
                <span className="font-mono text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">ZERO CODE CHANGES</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                The database and spatial indexing schema are built with PostGIS 3.3. Any additional CPCB or state SPCB facility coordinates added via CSV or REST API will immediately receive automated 90-day baseline generation, real-time spatial clustering, and automated ML anomaly classification with zero downtime.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "satellites",
      badge: "Earth Observation Constellation",
      badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-200",
      title: "Multi-Sensor Satellite Telemetry Pipeline",
      icon: Satellite,
      iconColor: "text-indigo-600 bg-indigo-50 border-indigo-200",
      description: "NASA VIIRS and MODIS polar-orbiting infrared sensors capturing continuous daytime and nighttime thermal signatures.",
      content: (
        <div className="space-y-4 text-xs text-slate-600">
          <p className="leading-relaxed">
            The platform ingests raw radiometric telemetry from 5 operational Earth-observation satellite sensors flying in sun-synchronous low Earth orbit (LEO). Each sensor measures Fire Radiative Power (FRP in Megawatts) and Brightness Temperature (Kelvin):
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">VIIRS (S-NPP, NOAA-20, NOAA-21)</span>
                <span className="text-[10px] font-mono bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded">375m I-Band</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                High-resolution 375m spatial resolution in the 3.74 μm (I4) and 11.45 μm (I5) thermal channels. Ideal for pin-pointing sub-pixel flare stacks, furnace vents, and localized industrial combustion.
              </p>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">MODIS (Terra & Aqua)</span>
                <span className="text-[10px] font-mono bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">1 km M-Band</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                1 km spatial resolution utilizing Channel 21/22 (3.9 μm) and Channel 31 (11.0 μm) infrared channels, providing valuable longitudinal context and high-temperature saturation thresholding.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "clustering",
      badge: "Spatio-Temporal Aggregation",
      badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
      title: "ST-DBSCAN Spatio-Temporal Event Engine",
      icon: Layers,
      iconColor: "text-emerald-600 bg-emerald-50 border-emerald-200",
      description: "Mathematical clustering that groups raw scattered satellite pixels into coherent, trackable thermal events.",
      content: (
        <div className="space-y-4 text-xs text-slate-600">
          <p className="leading-relaxed">
            Raw satellite observations are disparate pixel detections from multiple satellite overpasses. ThermoTrace AI implements an optimized <strong className="text-slate-900">Spatio-Temporal Density-Based Spatial Clustering of Applications with Noise (ST-DBSCAN)</strong> algorithm to form persistent thermal events:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Spatial Radius (ε)</div>
              <div className="text-base font-bold text-slate-900 font-mono">3.5 km</div>
              <p className="text-[10px] text-slate-500">Clusters adjacent multi-sensor detections within a 3.5 km physical buffer.</p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Temporal Window (Δt)</div>
              <div className="text-base font-bold text-slate-900 font-mono">12.0 Hours</div>
              <p className="text-[10px] text-slate-500">Merges consecutive day/night satellite passes into persistent multi-day event lifecycles.</p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Dynamic Hull</div>
              <div className="text-base font-bold text-slate-900 font-mono">Convex Polygon</div>
              <p className="text-[10px] text-slate-500">Computes geographic boundary polygons representing the active thermal footprint.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "ml-classifier",
      badge: "Machine Learning Intelligence",
      badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
      title: "Hardened Multi-Class ML Classifier & Attribution",
      icon: Cpu,
      iconColor: "text-purple-600 bg-purple-50 border-purple-200",
      description: "Calibrated multi-class classification attributing each thermal event to industrial routine, elevated flaring, structural fire, crop residue, or wildfire.",
      content: (
        <div className="space-y-4 text-xs text-slate-600">
          <p className="leading-relaxed">
            Every clustered thermal event is evaluated through a dual-stage <strong className="text-slate-900">Extreme Gradient Boosting (XGBoost)</strong> and <strong className="text-slate-900">Random Forest Classifier</strong> trained on historical multi-sensor radiometric features, statistical persistence, and ESA WorldCover 10m land-cover context:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="font-bold text-slate-900 text-xs">6 Supported Operational Classes</span>
              <div className="space-y-1 font-mono text-[11px]">
                <div className="flex justify-between p-1.5 bg-white rounded border border-slate-200"><span className="font-bold text-slate-800">IND_ROUTINE</span><span className="text-slate-500">Authorized industrial operations</span></div>
                <div className="flex justify-between p-1.5 bg-white rounded border border-slate-200"><span className="font-bold text-orange-700">IND_FLARE</span><span className="text-slate-500">Elevated chimney or process flaring</span></div>
                <div className="flex justify-between p-1.5 bg-white rounded border border-slate-200"><span className="font-bold text-red-700">IND_FIRE</span><span className="text-slate-500">Severe runaway industrial plant fire</span></div>
                <div className="flex justify-between p-1.5 bg-white rounded border border-slate-200"><span className="font-bold text-amber-700">AGRI_BURN</span><span className="text-slate-500">Agricultural crop stubble burning</span></div>
                <div className="flex justify-between p-1.5 bg-white rounded border border-slate-200"><span className="font-bold text-emerald-700">WILDFIRE</span><span className="text-slate-500">Forest / grassland open wildfire</span></div>
                <div className="flex justify-between p-1.5 bg-white rounded border border-slate-200"><span className="font-bold text-slate-600">OTHER_UNCERTAIN</span><span className="text-slate-500">Unclassified or low-confidence</span></div>
              </div>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="font-bold text-slate-900 text-xs">Core Engineered Features</span>
              <ul className="space-y-1.5 text-[11px] text-slate-600">
                <li>• <strong className="text-slate-800">Radiometric Power Ratio:</strong> Peak FRP / Mean FRP deviation.</li>
                <li>• <strong className="text-slate-800">Multi-Pass Persistence:</strong> Ratio of distinct active passes across 7-day window.</li>
                <li>• <strong className="text-slate-800">Proximity to Registered Plant:</strong> Radial distance to closest known CPCB facility centroid.</li>
                <li>• <strong className="text-slate-800">ESA WorldCover 10m Land Classification:</strong> Built-up industrial vs. cropland vs. tree cover percentage.</li>
                <li>• <strong className="text-slate-800">Diurnal Timing:</strong> Nighttime vs. daytime detection probability ratios.</li>
              </ul>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "baselines",
      badge: "Statistical Baseline & Anomaly Engine",
      badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
      title: "90-Day Empirical Baselines & Z-Score Tiers",
      icon: Activity,
      iconColor: "text-amber-600 bg-amber-50 border-amber-200",
      description: "Statistical normal operating profiles calculated for registered plants to detect subtle operational anomalies.",
      content: (
        <div className="space-y-4 text-xs text-slate-600">
          <p className="leading-relaxed">
            For each registered industrial complex, ThermoTrace AI continuously computes a rolling <strong className="text-slate-900">90-day empirical baseline profile</strong> (Mean $\mu$, Standard Deviation $\sigma$, 75th Percentile, and 95th Percentile FRP). When a new thermal event occurs within the facility boundary, its statistical Z-score is evaluated:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
              <span className="text-[10px] font-bold text-emerald-800 uppercase">NORMAL</span>
              <div className="text-xs font-mono font-bold text-emerald-900 mt-1">Z ≤ +1.0σ</div>
              <p className="text-[10px] text-emerald-700 mt-0.5">Standard operation</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-center">
              <span className="text-[10px] font-bold text-amber-800 uppercase">ELEVATED</span>
              <div className="text-xs font-mono font-bold text-amber-900 mt-1">+1.0σ &lt; Z ≤ +2.0σ</div>
              <p className="text-[10px] text-amber-700 mt-0.5">Moderate increase</p>
            </div>
            <div className="p-3 bg-orange-50 rounded-xl border border-orange-200 text-center">
              <span className="text-[10px] font-bold text-orange-800 uppercase">ABNORMAL</span>
              <div className="text-xs font-mono font-bold text-orange-900 mt-1">+2.0σ &lt; Z ≤ +3.0σ</div>
              <p className="text-[10px] text-orange-700 mt-0.5">Process deviation</p>
            </div>
            <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-center">
              <span className="text-[10px] font-bold text-red-800 uppercase">CRITICAL</span>
              <div className="text-xs font-mono font-bold text-red-900 mt-1">Z &gt; +3.0σ</div>
              <p className="text-[10px] text-red-700 mt-0.5">Severe anomaly / fire</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "symbology",
      badge: "Visual Standard",
      badgeColor: "bg-slate-100 text-slate-800 border-slate-200",
      title: "Symbology Codex & Color System",
      icon: Sparkles,
      iconColor: "text-slate-600 bg-slate-100 border-slate-200",
      description: "Standardized visual codex for all map markers, anomalies, and sector icons.",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <span className="font-bold text-slate-900 text-xs">Map Marker Icons</span>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2 p-1.5 bg-white rounded border border-slate-200"><Building2 className="w-4 h-4 text-blue-600" /><span><strong>Blue Factory:</strong> Registered Industrial Complex</span></div>
              <div className="flex items-center gap-2 p-1.5 bg-white rounded border border-slate-200"><Flame className="w-4 h-4 text-orange-600" /><span><strong>Orange Flame:</strong> Active Clustered Thermal Event</span></div>
              <div className="flex items-center gap-2 p-1.5 bg-white rounded border border-slate-200"><Trees className="w-4 h-4 text-emerald-600" /><span><strong>Green Trees:</strong> Forest / Wildfire Zone</span></div>
              <div className="flex items-center gap-2 p-1.5 bg-white rounded border border-slate-200"><CloudSun className="w-4 h-4 text-amber-600" /><span><strong>Amber Sun:</strong> Agricultural Stubble Burn</span></div>
            </div>
          </div>
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <span className="font-bold text-slate-900 text-xs">Severity Color Standard</span>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between p-1.5 bg-red-50 text-red-900 rounded border border-red-200 font-bold"><span>CRITICAL</span><span>Red (#DC2626)</span></div>
              <div className="flex items-center justify-between p-1.5 bg-orange-50 text-orange-900 rounded border border-orange-200 font-bold"><span>ABNORMAL</span><span>Orange (#EA580C)</span></div>
              <div className="flex items-center justify-between p-1.5 bg-amber-50 text-amber-900 rounded border border-amber-200 font-bold"><span>ELEVATED</span><span>Amber (#D97706)</span></div>
              <div className="flex items-center justify-between p-1.5 bg-emerald-50 text-emerald-900 rounded border border-emerald-200 font-bold"><span>NORMAL</span><span>Emerald (#059669)</span></div>
            </div>
          </div>
        </div>
      )
    }
  ];

  const filteredSections = sections.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchesQuery = s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.badge.toLowerCase().includes(q);
    const matchesTab = activeTab === "all" || s.id === activeTab;
    return matchesQuery && matchesTab;
  });

  return (
    <div className="p-8 h-full overflow-y-auto w-full bg-slate-50 text-slate-800">
      {/* Sovereign Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-orange-100 border border-orange-200 text-orange-600 rounded-lg shadow-sm">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Architecture & Operational Guide</h1>
                <span className="px-2 py-0.5 bg-orange-100 text-orange-800 border border-orange-200 rounded text-[10px] font-mono font-bold">v3.3.0 AUTHORITATIVE</span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Comprehensive engineering reference, satellite telemetry specifications, and algorithm formulations</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>SIH 2026 Production Specification</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="mt-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === "all" ? "bg-orange-600 text-white shadow-xs" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"}`}
          >
            All Sections ({sections.length})
          </button>
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === "overview" ? "bg-orange-600 text-white shadow-xs" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"}`}
          >
            Mandate
          </button>
          <button
            onClick={() => setActiveTab("dataset-scope")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === "dataset-scope" ? "bg-blue-600 text-white shadow-xs" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"}`}
          >
            Dataset & ML Scope
          </button>
          <button
            onClick={() => setActiveTab("satellites")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === "satellites" ? "bg-orange-600 text-white shadow-xs" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"}`}
          >
            Satellites
          </button>
          <button
            onClick={() => setActiveTab("clustering")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === "clustering" ? "bg-orange-600 text-white shadow-xs" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"}`}
          >
            ST-DBSCAN
          </button>
          <button
            onClick={() => setActiveTab("ml-classifier")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === "ml-classifier" ? "bg-orange-600 text-white shadow-xs" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"}`}
          >
            Machine Learning
          </button>
          <button
            onClick={() => setActiveTab("baselines")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === "baselines" ? "bg-orange-600 text-white shadow-xs" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"}`}
          >
            Baselines & Anomaly
          </button>
        </div>

        <div className="relative min-w-[280px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search system documentation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500 transition"
          />
        </div>
      </div>

      {/* Guide Content Cards */}
      <div className="mt-6 space-y-6">
        {filteredSections.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden transition hover:border-slate-300">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl border ${section.iconColor}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900">{section.title}</h2>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${section.badgeColor}`}>
                        {section.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{section.description}</p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {section.content}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
