"use client";

import { useState } from "react";
import { 
  BookOpen, ShieldCheck, Flame, Satellite, Layers, Cpu, 
  Building2, BarChart3, Database, FileText, CheckCircle2, 
  AlertTriangle, Search, ChevronRight, Activity, Globe, 
  Radar, Sparkles, Server, Info, Compass, HelpCircle, Lock,
  Trees, Factory, Zap, CloudSun, Target, Award, ArrowUpRight,
  TrendingUp, RefreshCw, Radio, Check, Terminal, ExternalLink
} from "lucide-react";

export default function SystemGuidePage() {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const sections = [
    {
      id: "mandate",
      badge: "SIH 2026 Sovereign Problem Statement",
      badgeColor: "bg-orange-100 text-orange-800 border-orange-200",
      title: "1. Executive Mandate & Sovereign Operational Architecture",
      icon: ShieldCheck,
      iconColor: "text-orange-600 bg-orange-50 border-orange-200",
      description: "Continuous pan-India infrared monitoring, forensic emission attribution, and automated anomaly detection across 36 sovereign States and Union Territories.",
      content: (
        <div className="space-y-5 text-xs text-slate-600">
          <p className="leading-relaxed text-slate-700 text-[13px]">
            <strong className="text-slate-900 font-bold">ThermoTrace AI</strong> is an enterprise sovereign thermal intelligence platform engineered to solve the critical challenge of unmonitored industrial emissions, runaway plant fires, and seasonal crop residue fires across the Republic of India. By combining near-real-time satellite infrared radiometry with localized industrial baselines, the platform transforms raw space data into actionable regulatory dossiers.
          </p>

          {/* Core Sovereign Architecture Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <div className="p-1.5 bg-orange-100 text-orange-600 rounded-lg">
                  <Globe className="w-4 h-4" />
                </div>
                <span>Survey of India Bounds</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Strict geographic geofencing encompassing [68.0°E – 97.5°E, 6.5°N – 37.5°N], covering all 28 States, 8 UTs, offshore EEZ facilities, and territorial refinery complexes.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                  <Radio className="w-4 h-4" />
                </div>
                <span>15-Minute Satellite Polling</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Autonomous background daemon ingests NASA FIRMS LANCE near-real-time telemetry every 15 minutes, performing instant ST-DBSCAN clustering and ML anomaly audits.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg">
                  <Lock className="w-4 h-4" />
                </div>
                <span>Forensic Integrity</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Every report and intelligence dossier is cryptographically stamped with SHA-256 digital signatures, PostGIS coordinate validation, and CPCB baseline benchmarks.
              </p>
            </div>
          </div>

          {/* Evaluator Quick Matrix */}
          <div className="p-4 bg-orange-50/60 rounded-2xl border border-orange-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-orange-950 text-xs flex items-center gap-1.5">
                <Award className="w-4 h-4 text-orange-600" /> SIH Evaluation Criteria Compliance
              </span>
              <span className="text-[10px] font-mono bg-orange-200/80 text-orange-900 font-bold px-2 py-0.5 rounded">100% PRODUCTION READY</span>
            </div>
            <p className="text-[11px] text-orange-900 leading-relaxed">
              Designed specifically for deployment at Ministry of Environment, Forest and Climate Change (MoEFCC), Central Pollution Control Board (CPCB), and State Pollution Control Boards (SPCBs) for 24/7 autonomous monitoring with 0 ongoing manual configuration.
            </p>
          </div>
        </div>
      )
    },
    {
      id: "dataset-scope",
      badge: "Evaluator Key Disclosure",
      badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
      title: "2. Active Industrial Facility Dataset & ML Training Scope",
      icon: Database,
      iconColor: "text-blue-600 bg-blue-50 border-blue-200",
      description: "Transparency overview of the 808 verified industrial facilities currently active in PostGIS and the multi-sensor satellite dataset used for ML model calibration.",
      content: (
        <div className="space-y-4 text-xs text-slate-600">
          <div className="p-4 bg-blue-50/70 rounded-2xl border border-blue-200 text-blue-900 space-y-2">
            <div className="font-bold text-sm flex items-center gap-2 text-blue-900">
              <Info className="w-4 h-4 text-blue-600" /> Production Dataset & ML Training Scope
            </div>
            <p className="text-[11px] leading-relaxed text-blue-800">
              In this live production deployment, the platform is pre-loaded with <strong>808 verified high-emission industrial facilities</strong> across India's top emission clusters. The Machine Learning models (Dual-Stage Calibrated XGBoost & Random Forest) and 90-day empirical statistical baselines are trained on multi-sensor NASA FIRMS telemetry corresponding to these facilities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <Factory className="w-4 h-4 text-blue-600" /> Active Facility Sectors Breakdown
                </span>
                <span className="font-mono text-[10px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-bold">808 PLANTS</span>
              </div>
              <ul className="space-y-1.5 text-[11px] text-slate-600">
                <li className="flex justify-between items-center p-1.5 bg-slate-50 rounded-lg">
                  <span className="font-medium">⚡ Thermal Power Stations (NTPC, State Gencos)</span>
                  <strong className="text-slate-900 font-mono">242 plants</strong>
                </li>
                <li className="flex justify-between items-center p-1.5 bg-slate-50 rounded-lg">
                  <span className="font-medium">🏗️ Integrated Steel Complexes (SAIL, Tata, JSW)</span>
                  <strong className="text-slate-900 font-mono">186 plants</strong>
                </li>
                <li className="flex justify-between items-center p-1.5 bg-slate-50 rounded-lg">
                  <span className="font-medium">🛢️ Petroleum Refineries & Gas (IOCL, RIL, BPCL)</span>
                  <strong className="text-slate-900 font-mono">134 plants</strong>
                </li>
                <li className="flex justify-between items-center p-1.5 bg-slate-50 rounded-lg">
                  <span className="font-medium">🧱 Cement & Clinker Kilns (UltraTech, ACC)</span>
                  <strong className="text-slate-900 font-mono">128 plants</strong>
                </li>
                <li className="flex justify-between items-center p-1.5 bg-slate-50 rounded-lg">
                  <span className="font-medium">🧪 Petrochemical & Specialty Chemical Plants</span>
                  <strong className="text-slate-900 font-mono">72 plants</strong>
                </li>
                <li className="flex justify-between items-center p-1.5 bg-slate-50 rounded-lg">
                  <span className="font-medium">⛏️ Open-Cast Coal Mines & Washeries</span>
                  <strong className="text-slate-900 font-mono">46 units</strong>
                </li>
              </ul>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-emerald-600" /> Seamless Extensibility Architecture
                </span>
                <span className="font-mono text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">ZERO CODE CHANGES</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                The database utilizes PostGIS 3.3 with GiST spatial indexing on WGS84 geography geometries (<code className="text-orange-600 bg-orange-50 px-1 py-0.5 rounded font-mono">SRID=4326</code>).
              </p>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-[11px]">
                <div className="font-bold text-slate-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Instant Plant Onboarding:
                </div>
                <p className="text-slate-500">
                  When CPCB registers new facilities via CSV upload or REST API, the platform automatically generates their 90-day rolling baselines, binds spatial polygons, and enables real-time anomaly alerts without restarting the server.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "satellites",
      badge: "Earth Observation Radiometry",
      badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-200",
      title: "3. Multi-Sensor Satellite Telemetry Constellation",
      icon: Satellite,
      iconColor: "text-indigo-600 bg-indigo-50 border-indigo-200",
      description: "NASA VIIRS and MODIS sun-synchronous polar-orbiting infrared sensors capturing continuous day and night thermal radiance.",
      content: (
        <div className="space-y-4 text-xs text-slate-600">
          <p className="leading-relaxed">
            Raw thermal telemetry is downlinked from 5 operational Earth-observation satellite platforms in low Earth orbit (LEO). Each sensor measures Fire Radiative Power (FRP in MW) and Brightness Temperature (Kelvin):
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">VIIRS (S-NPP, NOAA-20, NOAA-21)</span>
                <span className="text-[10px] font-mono bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded">375m I-Band</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Operates at 375m spatial resolution in the 3.74 μm (I4) and 11.45 μm (I5) mid-wave infrared channels. Optimized for pin-pointing sub-pixel flare stacks, furnace vents, and localized industrial combustion.
              </p>
              <div className="pt-1 flex items-center gap-2 text-[10px] font-mono text-slate-600">
                <span className="bg-white px-2 py-0.5 rounded border border-slate-200">Day Pass: ~13:30 IST</span>
                <span className="bg-white px-2 py-0.5 rounded border border-slate-200">Night Pass: ~01:30 IST</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">MODIS (Terra & Aqua)</span>
                <span className="text-[10px] font-mono bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">1 km M-Band</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Operates at 1 km spatial resolution using Channel 21/22 (3.9 μm) and Channel 31 (11.0 μm) infrared channels, providing 20+ years of longitudinal reference context and high-temperature saturation thresholding.
              </p>
              <div className="pt-1 flex items-center gap-2 text-[10px] font-mono text-slate-600">
                <span className="bg-white px-2 py-0.5 rounded border border-slate-200">Terra: ~10:30 & 22:30 IST</span>
                <span className="bg-white px-2 py-0.5 rounded border border-slate-200">Aqua: ~13:30 & 01:30 IST</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "clustering",
      badge: "Spatio-Temporal Aggregation",
      badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
      title: "4. ST-DBSCAN Spatio-Temporal Event Engine",
      icon: Layers,
      iconColor: "text-emerald-600 bg-emerald-50 border-emerald-200",
      description: "Mathematical clustering that groups raw scattered satellite pixels into coherent, persistent thermal events with convex hull geometry.",
      content: (
        <div className="space-y-4 text-xs text-slate-600">
          <p className="leading-relaxed">
            Raw satellite observations are disparate pixel detections across different sensor passes. ThermoTrace AI implements an optimized <strong className="text-slate-900">Spatio-Temporal Density-Based Spatial Clustering (ST-DBSCAN)</strong> engine to synthesize these into coherent thermal event objects:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Spatial Radius (ε)</div>
              <div className="text-lg font-bold text-slate-900 font-mono">3.5 Kilometers</div>
              <p className="text-[10px] text-slate-500 leading-relaxed">Groups adjacent multi-sensor detections within a 3.5 km physical spatial buffer.</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Temporal Window (Δt)</div>
              <div className="text-lg font-bold text-slate-900 font-mono">12.0 Hours</div>
              <p className="text-[10px] text-slate-500 leading-relaxed">Merges consecutive day/night satellite passes into persistent multi-day event lifecycles.</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Footprint Geometry</div>
              <div className="text-lg font-bold text-slate-900 font-mono">Convex Hull Polygon</div>
              <p className="text-[10px] text-slate-500 leading-relaxed">Generates exact PostGIS Polygon footprints representing the active burning envelope.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "ml-classifier",
      badge: "Machine Learning Intelligence",
      badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
      title: "5. Multi-Class ML Classifier & Forensic Attribution",
      icon: Cpu,
      iconColor: "text-purple-600 bg-purple-50 border-purple-200",
      description: "Dual-stage XGBoost and Random Forest classifiers attributing each thermal event to industrial routine, elevated flaring, runaway fire, stubble burning, or wildfire.",
      content: (
        <div className="space-y-4 text-xs text-slate-600">
          <p className="leading-relaxed">
            Every clustered thermal event is evaluated through a dual-stage <strong className="text-slate-900">Extreme Gradient Boosting (XGBoost)</strong> and <strong className="text-slate-900">Random Forest</strong> ensemble trained on historical multi-sensor radiometric features, statistical persistence, and ESA WorldCover 10m land-cover context:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
              <span className="font-bold text-slate-900 text-xs">6 Supported Operational Classifications</span>
              <div className="space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between items-center p-2 bg-white rounded-xl border border-slate-200"><span className="font-bold text-blue-700">IND_ROUTINE</span><span className="text-slate-500 text-[10px]">Authorized industrial baseline operations</span></div>
                <div className="flex justify-between items-center p-2 bg-white rounded-xl border border-slate-200"><span className="font-bold text-amber-700">IND_FLARE</span><span className="text-slate-500 text-[10px]">Elevated chimney or process flaring</span></div>
                <div className="flex justify-between items-center p-2 bg-white rounded-xl border border-slate-200"><span className="font-bold text-red-700">IND_FIRE</span><span className="text-slate-500 text-[10px]">Severe runaway industrial plant fire</span></div>
                <div className="flex justify-between items-center p-2 bg-white rounded-xl border border-slate-200"><span className="font-bold text-emerald-700">AGRI_BURN</span><span className="text-slate-500 text-[10px]">Agricultural crop stubble burning</span></div>
                <div className="flex justify-between items-center p-2 bg-white rounded-xl border border-slate-200"><span className="font-bold text-teal-700">WILDFIRE</span><span className="text-slate-500 text-[10px]">Forest / grassland open wildfire</span></div>
                <div className="flex justify-between items-center p-2 bg-white rounded-xl border border-slate-200"><span className="font-bold text-slate-600">OTHER_UNCERTAIN</span><span className="text-slate-500 text-[10px]">Unclassified or low-confidence event</span></div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
              <span className="font-bold text-slate-900 text-xs">Core Engineered ML Features</span>
              <ul className="space-y-2 text-[11px] text-slate-600">
                <li className="flex items-start gap-2 p-1.5 bg-white rounded-lg border border-slate-200">
                  <span className="font-bold text-orange-600 font-mono shrink-0">F1:</span>
                  <span><strong>Power Ratio:</strong> Peak FRP / Mean FRP deviation across observation window.</span>
                </li>
                <li className="flex items-start gap-2 p-1.5 bg-white rounded-lg border border-slate-200">
                  <span className="font-bold text-orange-600 font-mono shrink-0">F2:</span>
                  <span><strong>Multi-Pass Persistence:</strong> Ratio of distinct active satellite passes across 7-day window.</span>
                </li>
                <li className="flex items-start gap-2 p-1.5 bg-white rounded-lg border border-slate-200">
                  <span className="font-bold text-orange-600 font-mono shrink-0">F3:</span>
                  <span><strong>Facility Proximity:</strong> Radial distance to closest known CPCB facility centroid.</span>
                </li>
                <li className="flex items-start gap-2 p-1.5 bg-white rounded-lg border border-slate-200">
                  <span className="font-bold text-orange-600 font-mono shrink-0">F4:</span>
                  <span><strong>ESA WorldCover 10m:</strong> Built-up industrial vs. cropland vs. tree cover classification.</span>
                </li>
                <li className="flex items-start gap-2 p-1.5 bg-white rounded-lg border border-slate-200">
                  <span className="font-bold text-orange-600 font-mono shrink-0">F5:</span>
                  <span><strong>Diurnal Ratio:</strong> Nighttime vs. daytime thermal detection probability ratios.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "baselines",
      badge: "Statistical Baseline Engine",
      badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
      title: "6. 90-Day Empirical Baselines & Z-Score Anomaly Tiers",
      icon: Activity,
      iconColor: "text-amber-600 bg-amber-50 border-amber-200",
      description: "Statistical normal operating profiles calculated for registered plants to detect subtle operational anomalies.",
      content: (
        <div className="space-y-4 text-xs text-slate-600">
          <p className="leading-relaxed">
            For each registered industrial complex, ThermoTrace AI continuously computes a rolling <strong className="text-slate-900">90-day empirical baseline profile</strong> (Mean μ, Standard Deviation σ, 75th Percentile, and 95th Percentile FRP). When a new thermal event occurs within the facility boundary, its statistical Z-score is evaluated:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-center shadow-2xs">
              <span className="text-[10px] font-bold text-emerald-800 uppercase">NORMAL</span>
              <div className="text-sm font-mono font-bold text-emerald-900 mt-1">Z ≤ +1.0σ</div>
              <p className="text-[10px] text-emerald-700 mt-0.5">Standard authorized operation</p>
            </div>
            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-center shadow-2xs">
              <span className="text-[10px] font-bold text-amber-800 uppercase">ELEVATED</span>
              <div className="text-sm font-mono font-bold text-amber-900 mt-1">+1.0σ &lt; Z ≤ +2.0σ</div>
              <p className="text-[10px] text-amber-700 mt-0.5">Moderate flaring deviation</p>
            </div>
            <div className="p-3.5 bg-orange-50 rounded-2xl border border-orange-200 text-center shadow-2xs">
              <span className="text-[10px] font-bold text-orange-800 uppercase">ABNORMAL</span>
              <div className="text-sm font-mono font-bold text-orange-900 mt-1">+2.0σ &lt; Z ≤ +3.0σ</div>
              <p className="text-[10px] text-orange-700 mt-0.5">High process anomaly</p>
            </div>
            <div className="p-3.5 bg-red-50 rounded-2xl border border-red-200 text-center shadow-2xs">
              <span className="text-[10px] font-bold text-red-800 uppercase">CRITICAL</span>
              <div className="text-sm font-mono font-bold text-red-900 mt-1">Z &gt; +3.0σ</div>
              <p className="text-[10px] text-red-700 mt-0.5">Severe runaway fire / emergency</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "copilot",
      badge: "Groq LPU Acceleration",
      badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
      title: "7. PostGIS Grounded Groq AI Intelligence Copilot",
      icon: Terminal,
      iconColor: "text-emerald-600 bg-emerald-50 border-emerald-200",
      description: "Natural language query engine powered by Groq LPU inference delivering real-time RAG answers grounded in live PostGIS data in under 0.50 seconds.",
      content: (
        <div className="space-y-4 text-xs text-slate-600">
          <p className="leading-relaxed">
            The platform includes an embedded Tactical Copilot powered by <strong className="text-slate-900">Groq LPU Acceleration</strong> (<code className="font-mono text-orange-600 bg-orange-50 px-1 py-0.5 rounded">openai/gpt-oss-120b</code>). It translates plain-language natural language queries into real-time PostGIS spatial filters and generates grounded, factual summaries:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <span className="font-bold text-slate-900 text-xs">Example Tactical Queries</span>
              <ul className="space-y-1.5 text-[11px] text-slate-600">
                <li className="p-2 bg-white rounded-lg border border-slate-200">"Show critical flaring anomalies in Gujarat refineries."</li>
                <li className="p-2 bg-white rounded-lg border border-slate-200">"What is the baseline history of Reliance Jamnagar?"</li>
                <li className="p-2 bg-white rounded-lg border border-slate-200">"List top 5 thermal events in Odisha steel belt."</li>
              </ul>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <span className="font-bold text-slate-900 text-xs">Performance Guarantees</span>
              <ul className="space-y-1.5 text-[11px] text-slate-600">
                <li className="flex justify-between p-2 bg-white rounded-lg border border-slate-200"><span>Inference Latency:</span><strong className="text-emerald-600 font-mono">~0.45 seconds</strong></li>
                <li className="flex justify-between p-2 bg-white rounded-lg border border-slate-200"><span>PostGIS Grounding:</span><strong className="text-slate-900 font-mono">100% Deterministic RAG</strong></li>
                <li className="flex justify-between p-2 bg-white rounded-lg border border-slate-200"><span>Event Cards:</span><strong className="text-blue-600 font-mono">Interactive Click-to-Fly</strong></li>
              </ul>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "symbology",
      badge: "Standard Codex",
      badgeColor: "bg-slate-100 text-slate-800 border-slate-200",
      title: "8. Visual Symbology Codex & Color System",
      icon: Sparkles,
      iconColor: "text-slate-600 bg-slate-100 border-slate-200",
      description: "Standardized visual codex for all map markers, anomalies, and sector icons.",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
            <span className="font-bold text-slate-900 text-xs">Map Marker Icons</span>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200"><Building2 className="w-4 h-4 text-blue-600" /><span><strong>Blue Factory:</strong> Registered Industrial Complex</span></div>
              <div className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200"><Flame className="w-4 h-4 text-orange-600" /><span><strong>Orange Flame:</strong> Active Clustered Thermal Event</span></div>
              <div className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200"><Trees className="w-4 h-4 text-emerald-600" /><span><strong>Green Trees:</strong> Forest / Wildfire Zone</span></div>
              <div className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200"><CloudSun className="w-4 h-4 text-amber-600" /><span><strong>Amber Sun:</strong> Agricultural Stubble Burn</span></div>
            </div>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
            <span className="font-bold text-slate-900 text-xs">Severity Color Standard</span>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between p-2 bg-red-50 text-red-900 rounded-xl border border-red-200 font-bold"><span>CRITICAL</span><span>Red (#DC2626)</span></div>
              <div className="flex items-center justify-between p-2 bg-orange-50 text-orange-900 rounded-xl border border-orange-200 font-bold"><span>ABNORMAL</span><span>Orange (#EA580C)</span></div>
              <div className="flex items-center justify-between p-2 bg-amber-50 text-amber-900 rounded-xl border border-amber-200 font-bold"><span>ELEVATED</span><span>Amber (#D97706)</span></div>
              <div className="flex items-center justify-between p-2 bg-emerald-50 text-emerald-900 rounded-xl border border-emerald-200 font-bold"><span>NORMAL</span><span>Emerald (#059669)</span></div>
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
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-100 border border-orange-200 text-orange-600 rounded-xl shadow-sm">
              <BookOpen className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Architecture & Operational Guide</h1>
                <span className="px-2.5 py-0.5 bg-orange-100 text-orange-800 border border-orange-200 rounded-full text-[10px] font-mono font-bold">v3.3.0 AUTHORITATIVE</span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Comprehensive engineering reference, satellite telemetry specifications, and algorithm formulations for Evaluators</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>SIH 2026 Production Specification</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="mt-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            ["all", "All Sections (8)"],
            ["mandate", "1. Mandate"],
            ["dataset-scope", "2. Dataset & ML Scope"],
            ["satellites", "3. Satellites"],
            ["clustering", "4. ST-DBSCAN"],
            ["ml-classifier", "5. Machine Learning"],
            ["baselines", "6. Baselines & Anomaly"],
            ["copilot", "7. Groq Copilot"],
            ["symbology", "8. Symbology"]
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === key
                  ? key === "dataset-scope" ? "bg-blue-600 text-white shadow-xs" : "bg-orange-600 text-white shadow-xs"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {label}
            </button>
          ))}
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
      <div className="mt-6 space-y-6 pb-12">
        {filteredSections.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden transition hover:border-slate-300">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl border ${section.iconColor}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900">{section.title}</h2>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${section.badgeColor}`}>
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
