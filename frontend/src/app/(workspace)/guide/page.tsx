"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Globe,
  Radio,
  Lock,
  Layers,
  Cpu,
  Activity,
  Database,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
  MessageSquare,
  Newspaper,
  Bell,
  MapPin,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Award,
  Terminal,
  ArrowRight,
  TrendingUp,
  Info,
  Building2,
  Trees,
  CloudSun,
  Flame,
  HelpCircle,
  Clock,
  Key,
  BookOpen,
  Filter,
  Check,
  Eye,
  Sliders,
  Scale,
  Satellite
} from "lucide-react";
import { GUIDE_GLOSSARY, GuideGlossaryTerm } from "./guideData";

export default function SystemGuidePage() {
  const [technicalMode, setTechnicalMode] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<string>("overview");
  const [glossarySearch, setGlossarySearch] = useState<string>("");
  const [glossaryCategory, setGlossaryCategory] = useState<string>("ALL");
  const [expandedAccordions, setExpandedAccordions] = useState<{ [key: string]: boolean }>({
    "data-lifecycle": true,
    "feature-vector": true,
    "shap-drivers": true,
    "future-table": true,
  });

  const toggleAccordion = (id: string) => {
    setExpandedAccordions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const navItems = [
    { id: "overview", label: "01. Executive Overview" },
    { id: "problem", label: "02. The Problem" },
    { id: "pipeline", label: "03. How It Works" },
    { id: "data-sources", label: "04. Data Lifecycle" },
    { id: "event-formation", label: "05. Event Formation" },
    { id: "context-fusion", label: "06. Context Fusion" },
    { id: "ml-classifier", label: "07. ML Classification" },
    { id: "explainability", label: "08. TreeSHAP & Confidence" },
    { id: "anomaly-engine", label: "09. Baseline & Anomaly" },
    { id: "gis-investigation", label: "10. GIS Investigation" },
    { id: "application-surfaces", label: "11. Application Surfaces" },
    { id: "grounded-ai", label: "12. Grounded AI & Anti-Hallucination" },
    { id: "trust-integrity", label: "13. Trust & Reliability" },
    { id: "implemented-vs-future", label: "14. Implemented vs Future" },
    { id: "limitations", label: "15. Limitations & Caveats" },
    { id: "tech-stack", label: "16. Architecture & Tech Stack" },
    { id: "glossary", label: "17. Technical Glossary" },
  ];

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const filteredGlossary = GUIDE_GLOSSARY.filter((item) => {
    const matchesSearch =
      item.term.toLowerCase().includes(glossarySearch.toLowerCase()) ||
      item.shortDef.toLowerCase().includes(glossarySearch.toLowerCase()) ||
      item.technicalDetails.toLowerCase().includes(glossarySearch.toLowerCase());
    const matchesCat = glossaryCategory === "ALL" || item.category === glossaryCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Sticky Top Mode Switcher & Progress Ribbon */}
      <div className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-3 sm:px-6 lg:px-8 shadow-xs">
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800 text-orange-600 rounded-lg">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs sm:text-sm tracking-tight text-slate-900 dark:text-slate-100">
                  ThermoTrace AI System Architecture & Operational Guide
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 bg-orange-100 dark:bg-orange-950/80 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-800 rounded-full text-[9px] font-mono font-bold">
                  v3.3.0 AUTHORITATIVE
                </span>
              </div>
            </div>
          </div>

          {/* Simple vs Technical Mode Toggle */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 px-2 flex items-center gap-1">
              <Sliders className="w-3 h-3 text-orange-600" /> Mode:
            </span>
            <button
              onClick={() => setTechnicalMode(false)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                !technicalMode
                  ? "bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-xs border border-slate-200 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Executive
            </button>
            <button
              onClick={() => setTechnicalMode(true)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                technicalMode
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Technical / Formulas
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Sticky Navigation Column */}
        <div className="hidden lg:block lg:col-span-3">
          <div className="sticky top-20 space-y-1.5 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs max-h-[calc(100vh-6rem)] overflow-y-auto">
            <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-2 flex items-center justify-between">
              <span>Guide Navigation</span>
              <span className="font-mono text-slate-500">17 Chapters</span>
            </div>
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className={`w-full text-left px-2.5 py-1.5 text-[11px] rounded-lg font-medium transition flex items-center justify-between ${
                  activeSection === item.id
                    ? "bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 font-bold border border-orange-200 dark:border-orange-800/80"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900"
                }`}
              >
                <span className="truncate">{item.label}</span>
                <ChevronRight className={`w-3 h-3 shrink-0 ${activeSection === item.id ? "text-orange-600" : "text-slate-300 dark:text-slate-600"}`} />
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Sections Column */}
        <div className="lg:col-span-9 space-y-12">
          
          {/* 01. HERO / EXECUTIVE OVERVIEW */}
          <section id="overview" className="space-y-6 pt-2">
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-orange-50 dark:bg-orange-950/80 px-2.5 py-1 text-xs font-semibold text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                  <ShieldCheck className="h-3.5 w-3.5 text-orange-600" />
                  Sovereign Thermal Intelligence Engine
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  CPCB · MoEFCC · NTRO Target Domain
                </span>
              </div>

              <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
                ThermoTrace AI
              </h1>
              <p className="mt-1 text-sm sm:text-base font-semibold text-orange-600 dark:text-orange-400">
                Thermal Intelligence for Geospatial Monitoring and Industrial Risk Awareness
              </p>

              <p className="mt-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
                ThermoTrace transforms satellite-derived thermal observations into context-aware, explainable thermal intelligence for investigation, anomaly detection, regulatory compliance audits, and emergency decision support across the sovereign territory of India.
              </p>

              {/* High-Level Horizontal Pipeline Flow */}
              <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Autonomous Intelligence Pipeline Architecture
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  {[
                    { label: "1. Raw FIRMS", desc: "VIIRS & MODIS NRT Telemetry" },
                    { label: "2. Geofence Gate", desc: "Survey of India Spatial Bounds" },
                    { label: "3. ST-DBSCAN", desc: "Clustering & Convex Hulls" },
                    { label: "4. Context Fusion", desc: "Industrial & Land-Cover GIS" },
                    { label: "5. XGBoost ML", desc: "Calibrated Classification" },
                    { label: "6. Z-Score Anomaly", desc: "90d Empirical Baseline" },
                    { label: "7. User Surfaces", desc: "Map · News · Alerts · Reports" }
                  ].map((stage, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-center flex flex-col justify-between">
                      <div className="text-[10px] font-bold text-slate-900 dark:text-slate-100">{stage.label}</div>
                      <div className="text-[9px] text-slate-500 dark:text-slate-400 mt-1 leading-tight">{stage.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* 02. THE PROBLEM WE SOLVE */}
          <section id="problem" className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-600 font-bold text-xs font-mono">
                02
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                The Problem: Raw Hotspots vs. Actionable Thermal Intelligence
              </h2>
            </div>
            
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Orbital infrared sensors measure radiation anomalies over geographical coordinates, but raw pixels contain zero contextual understanding of ground truth. An operator inspecting raw thermal points cannot discern whether a signature is an authorized refinery flare, an unpermitted hazardous fire, or routine crop clearing.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20 p-5 space-y-3">
                <div className="flex items-center justify-between text-red-900 dark:text-red-300 font-bold text-xs">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-600" /> Raw Satellite Detections (Before)
                  </span>
                  <span className="font-mono text-[10px] bg-red-100 dark:bg-red-900/80 text-red-800 dark:text-red-200 px-2 py-0.5 rounded">UNCONTEXTUALIZED</span>
                </div>
                <ul className="space-y-2 text-[11px] text-red-950 dark:text-red-200/90">
                  <li className="flex items-start gap-2">
                    <span className="text-red-600 font-bold">✕</span>
                    <span><strong>Isolated Coordinates:</strong> Scattered lat/lon points without grouping or footprint boundary.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600 font-bold">✕</span>
                    <span><strong>No Source Attribution:</strong> Routine refinery process indistinguishable from runaway disaster.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600 font-bold">✕</span>
                    <span><strong>Zero Historical Norms:</strong> No indication whether 80 MW is normal or a critical 4.0σ explosion.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600 font-bold">✕</span>
                    <span><strong>Alert Fatigue:</strong> Regulators inundated with thousands of irrelevant agricultural dots.</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-5 space-y-3">
                <div className="flex items-center justify-between text-emerald-900 dark:text-emerald-300 font-bold text-xs">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> ThermoTrace AI Solution (After)
                  </span>
                  <span className="font-mono text-[10px] bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded">ACTIONABLE INTEL</span>
                </div>
                <ul className="space-y-2 text-[11px] text-emerald-950 dark:text-emerald-200/90">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>ST-DBSCAN Event Formation:</strong> Detections grouped into convex hull polygonal thermal events.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>Calibrated Multi-Class ML:</strong> Classified into 6 canonical categories with calibrated probabilities.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>90-Day Empirical Baselines:</strong> Z-score statistical evaluation identifying true anomalous surges.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>Targeted Action Dossiers:</strong> Cryptographic SHA-256 PDF reports ready for regulatory enforcement.</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* 03. HOW THERMOTRACE WORKS */}
          <section id="pipeline" className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800 text-orange-600 font-bold text-xs font-mono">
                03
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                How ThermoTrace AI Works: End-to-End Execution Flow
              </h2>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-3">
                  <div className="flex gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="font-mono font-bold text-orange-600 text-sm shrink-0">01</div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">NASA FIRMS Telemetry Polling</div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Autonomous daemon ingests multi-sensor NRT observations (VIIRS 375m & MODIS 1km) over Indian coordinates every 15 minutes.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="font-mono font-bold text-orange-600 text-sm shrink-0">02</div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">Sovereign India Geofencing & SHA-256 Deduplication</div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Evaluates coordinates against Survey of India boundaries, dropping transboundary noise. Generates deterministic SHA-256 deduplication keys.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="font-mono font-bold text-orange-600 text-sm shrink-0">03</div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">ST-DBSCAN Spatio-Temporal Event Formation</div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Clusters adjacent satellite pixels within 3.5 km and 12-hour windows into persistent thermal events with PostGIS convex hull geometries.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="font-mono font-bold text-blue-600 text-sm shrink-0">04</div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">Context Fusion & 14-Feature Extraction</div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Extracts 14 canonical spatial, radiometric, temporal, land-cover, and historical features for machine learning evaluation.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="font-mono font-bold text-blue-600 text-sm shrink-0">05</div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">Calibrated XGBoost & TreeSHAP Explainability</div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Dual-stage gradient boosting predicts source classification with softmax calibration and extracts top Shapley feature drivers.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="font-mono font-bold text-emerald-600 text-sm shrink-0">06</div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">90-Day Baseline & Anomaly Classification</div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Calculates statistical Z-score against facility baseline and publishes to GIS Command Map, Thermo News, Alerts, and PDF Reports.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 04. DATA SOURCES & LIFECYCLE */}
          <section id="data-sources" className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 font-bold text-xs font-mono">
                04
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Data Sources & Immutable Ingestion Lifecycle
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                  <Satellite className="w-4 h-4 text-indigo-600" /> NASA FIRMS Telemetry
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Near-real-time thermal radiance from VIIRS (375m I-band) and MODIS (1km) sensors measuring FRP (MW) and Brightness Temperature (K).
                </p>
                <div className="pt-2 text-[10px] text-amber-700 dark:text-amber-400 font-mono bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200 dark:border-amber-800">
                  <strong>Limitation:</strong> Satellite overpass cadence (~12h intervals) and cloud cover affect optical visibility.
                </div>
              </div>

              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                  <Building2 className="w-4 h-4 text-blue-600" /> Industrial Asset Registry (1,140+ Facilities)
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  PostGIS master repository of 1,140+ Indian refineries, thermal power stations, steel complexes, petrochemical plants, and coal mines from GEM, PPAC, and OSM.
                </p>
                <div className="pt-2 text-[10px] text-amber-700 dark:text-amber-400 font-mono bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200 dark:border-amber-800">
                  <strong>Limitation:</strong> Proximity to a plant provides contextual evidence, not definitive proof of industrial origin.
                </div>
              </div>

              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                  <Trees className="w-4 h-4 text-emerald-600" /> ESA WorldCover 10m LULC
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  High-resolution land-cover rasters resolving built-up urban/industrial footprints, agricultural cropland belts, and dense forest reserves.
                </p>
                <div className="pt-2 text-[10px] text-amber-700 dark:text-amber-400 font-mono bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200 dark:border-amber-800">
                  <strong>Limitation:</strong> Annual baseline land-cover rasters do not account for daily localized soil tilling changes.
                </div>
              </div>
            </div>

            {/* Data Lifecycle Table */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <span className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-orange-600" /> Immutable Data Lifecycle Architecture
                </span>
                <span className="text-[10px] font-mono text-slate-500">PostgreSQL 16 + PostGIS 3.4</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Stage</th>
                      <th className="p-3">Table Name</th>
                      <th className="p-3">Mutability</th>
                      <th className="p-3">Epistemic Purpose</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    <tr>
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">1. Raw Ingest</td>
                      <td className="p-3 font-mono text-indigo-600">thermal_observations</td>
                      <td className="p-3 font-semibold text-emerald-600">Immutable (Append-Only)</td>
                      <td className="p-3 text-slate-500 dark:text-slate-400">Stores unaltered satellite detections with SHA-256 deduplication key.</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">2. Clustered Event</td>
                      <td className="p-3 font-mono text-indigo-600">thermal_events</td>
                      <td className="p-3 font-semibold text-blue-600">Mutable (Appended)</td>
                      <td className="p-3 text-slate-500 dark:text-slate-400">Maintains ST-DBSCAN centroids, convex hull envelope, and FRP aggregations.</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">3. ML Intelligence</td>
                      <td className="p-3 font-mono text-indigo-600">event_classifications</td>
                      <td className="p-3 font-semibold text-blue-600">Versioned (Is Current)</td>
                      <td className="p-3 text-slate-500 dark:text-slate-400">Stores calibrated class probabilities, ML model ID, and TreeSHAP features.</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">4. Anomaly Metric</td>
                      <td className="p-3 font-mono text-indigo-600">event_anomalies</td>
                      <td className="p-3 font-semibold text-blue-600">Mutable</td>
                      <td className="p-3 text-slate-500 dark:text-slate-400">Evaluates Z-score deviation against 90-day facility operating normal baseline.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* 05. SPATIO-TEMPORAL EVENT FORMATION */}
          <section id="event-formation" className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 font-bold text-xs font-mono">
                05
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Spatio-Temporal Thermal Event Formation (ST-DBSCAN)
              </h2>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Single satellite pixels cannot represent real-world thermal events because industrial facilities and fires span across multiple adjacent sensor pixels and persist over consecutive orbital passes.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Spatial Buffer (ε_s)</div>
                  <div className="text-base font-bold font-mono text-slate-900 dark:text-slate-100">3,500 Meters</div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Merges adjacent radiometric pixels within 3.5 km industrial boundary buffer.</p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Temporal Window (ε_t)</div>
                  <div className="text-base font-bold font-mono text-slate-900 dark:text-slate-100">12.0 Hours</div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Connects consecutive day and night passes into a coherent event timeline.</p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Convex Hull Envelope</div>
                  <div className="text-base font-bold font-mono text-slate-900 dark:text-slate-100">PostGIS Polygon</div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Calculates ST_ConvexHull boundary geometry and bounding area in hectares.</p>
                </div>
              </div>

              {technicalMode && (
                <div className="p-4 bg-blue-50/70 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 text-[11px] font-mono text-blue-900 dark:text-blue-200 space-y-1">
                  <div className="font-bold font-sans text-xs">Technical Formulation: PostGIS Convex Hull</div>
                  <code>ST_Area(ST_ConvexHull(ST_Collect(geom))::geography) / 10000.0 AS bounding_area_ha</code>
                  <p className="text-[10px] text-blue-700 dark:text-blue-300 font-sans mt-1">
                    Single-point detections are automatically buffered to approximate sensor footprint resolution (375m for VIIRS; 1km for MODIS).
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* 06. CONTEXT FUSION */}
          <section id="context-fusion" className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 font-bold text-xs font-mono">
                06
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Context Fusion: Synthesizing the 14-Feature Input Vector
              </h2>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Before machine learning classification, ThermoTrace compiles 14 canonical features from 5 distinct data families into a normalized vector:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="font-bold text-indigo-600 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> 1. Spatial Features
                  </div>
                  <ul className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1 font-mono">
                    <li>• dist_to_facility (meters)</li>
                    <li>• facility_category_encoded</li>
                    <li>• is_industrial_zone (0/1)</li>
                  </ul>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="font-bold text-orange-600 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5" /> 2. Radiometric Features
                  </div>
                  <ul className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1 font-mono">
                    <li>• peak_frp_mw (Megawatts)</li>
                    <li>• mean_frp_mw (Average FRP)</li>
                    <li>• frp_variance (Variance)</li>
                    <li>• max_brightness_k (Kelvin)</li>
                  </ul>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="font-bold text-emerald-600 flex items-center gap-1.5">
                    <Trees className="w-3.5 h-3.5" /> 3. Land-Cover Features
                  </div>
                  <ul className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1 font-mono">
                    <li>• pct_cropland (0.00 – 1.00)</li>
                    <li>• pct_forest (0.00 – 1.00)</li>
                    <li>• pct_urban (0.00 – 1.00)</li>
                  </ul>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="font-bold text-blue-600 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> 4. Temporal Features
                  </div>
                  <ul className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1 font-mono">
                    <li>• duration_hours (Event span)</li>
                    <li>• day_night_ratio (D vs N)</li>
                  </ul>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5 sm:col-span-2 lg:col-span-2">
                  <div className="font-bold text-amber-600 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5" /> 5. Longitudinal Historical Features
                  </div>
                  <ul className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1 font-mono">
                    <li>• historical_active_days_90d (Distinct active satellite overpasses in 90 days)</li>
                    <li>• historical_peak_frp (Maximum historical peak radiant intensity recorded)</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* 07. MACHINE LEARNING CLASSIFICATION */}
          <section id="ml-classifier" className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-600 font-bold text-xs font-mono">
                07
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Machine Learning Classification & Canonical Classes
              </h2>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                The classification subsystem uses a production <strong className="text-slate-900 dark:text-slate-100">XGBoost</strong> multi-class model (<code className="font-mono text-purple-600 bg-purple-50 dark:bg-purple-950 px-1 py-0.5 rounded">thermo_xgb_v1.1.0.joblib</code>) attributes events across 4 tactical emitter classes with unified 3-color level severity:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {[
                  { name: "INDUSTRY (3-Color)", color: "border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200", meaning: "Factory stacks with 3-tier severity: Red (Critical fire/flare blast ≥50MW), Amber (Elevated flaring), Yellow (Nominal routine process)." },
                  { name: "AGRI_BURN", color: "border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200", meaning: "Curved crop stalk icon: seasonal crop residue & stubble burning (Green = nominal, Amber = elevated, Red = severe)." },
                  { name: "WILDFIRE", color: "border-red-200 dark:border-red-900 bg-red-50/70 dark:bg-red-950/30 text-red-800 dark:text-red-200", meaning: "Pine tree + flame icon: forest canopy & unmanaged vegetation wildfires (Flame Red / Orange by intensity)." },
                  { name: "OTHER_UNCERTAIN", color: "border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300", meaning: "Tactical diamond crosshair: unassigned low-confidence or ambiguous signature preserving epistemic integrity." }
                ].map((c, i) => (
                  <div key={i} className={`p-3.5 rounded-xl border ${c.color} space-y-1`}>
                    <div className="font-mono font-bold text-xs">{c.name}</div>
                    <p className="text-[11px] opacity-90 leading-tight">{c.meaning}</p>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-purple-50/60 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800 space-y-2 text-xs">
                <div className="font-bold text-purple-950 dark:text-purple-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-purple-600" /> Epistemic Rule: Uncertainty Is a Valid Output
                </div>
                <p className="text-[11px] text-purple-900 dark:text-purple-300 leading-relaxed">
                  When model confidence drops below operational threshold (&lt;0.55), ThermoTrace does not guess or force an arbitrary classification. Instead, it assigns <strong>OTHER_UNCERTAIN</strong>, flagging the event for manual inspection and preserving analytical integrity.
                </p>
              </div>
            </div>
          </section>

          {/* 08. TREESHAP & CONFIDENCE */}
          <section id="explainability" className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800 text-cyan-600 font-bold text-xs font-mono">
                08
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                TreeSHAP Explainability & Calibrated Probabilities
              </h2>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Rather than acting as a black box, ThermoTrace integrates <strong className="text-slate-900 dark:text-slate-100">TreeSHAP</strong> (Lundberg et al., 2020) to compute exact game-theoretic Shapley values explaining which input features drove the model's prediction:
              </p>

              {/* Illustrative SHAP Driver Card */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between text-xs border-b border-slate-200 dark:border-slate-700 pb-2">
                  <span className="font-bold text-slate-900 dark:text-slate-100">Example SHAP Attribution Output</span>
                  <span className="font-mono text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded font-bold">
                    PREDICTED: IND_FLARE (88.2% Confidence)
                  </span>
                </div>

                <div className="space-y-2 text-[11px]">
                  <div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400 mb-1">
                      <span>Facility Proximity (<code className="font-mono">dist_to_facility = 120m</code>)</span>
                      <strong className="text-emerald-600">+0.38 SHAP</strong>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full w-[76%]" />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400 mb-1">
                      <span>90-Day Persistence (<code className="font-mono">historical_active_days = 24d</code>)</span>
                      <strong className="text-emerald-600">+0.29 SHAP</strong>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full w-[58%]" />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400 mb-1">
                      <span>Low Cropland Overlap (<code className="font-mono">pct_cropland = 5%</code>)</span>
                      <strong className="text-emerald-600">+0.14 SHAP</strong>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full w-[28%]" />
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 dark:text-slate-400 italic pt-1 border-t border-slate-200 dark:border-slate-700">
                  Note: SHAP values explain feature contributions to the mathematical prediction. They represent associative model evidence, not legal causality.
                </div>
              </div>
            </div>
          </section>

          {/* 09. BASELINE & ANOMALY ENGINE */}
          <section id="anomaly-engine" className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 font-bold text-xs font-mono">
                09
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                90-Day Empirical Baselines & Z-Score Anomaly Engine
              </h2>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm">
              <div className="p-4 bg-amber-50/60 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800 text-xs text-amber-950 dark:text-amber-200 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-amber-600" /> Separation of Analytical Dimensions
                </div>
                <p className="text-[11px] leading-relaxed">
                  <strong>Classification</strong> asks: <em>"What physical category does this thermal source resemble?"</em><br />
                  <strong>Anomaly Evaluation</strong> asks: <em>"Is this specific facility radiating significantly higher power than its own historical normal baseline?"</em>
                </p>
              </div>

              {/* Z-Score Anomaly Formulation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <span className="font-bold text-slate-900 dark:text-slate-100">Mathematical Formulation</span>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-center font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                    Z = (Observed FRP - Baseline Mean μ) / Baseline StdDev σ
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Baseline parameters (μ, σ, Q50, Q95) are computed across a rolling 90-day window of historical observations for registered facilities.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <span className="font-bold text-slate-900 dark:text-slate-100">Standard Operational Anomaly Tiers</span>
                  <div className="space-y-1.5 font-mono text-[11px]">
                    <div className="flex justify-between p-1.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 rounded border border-emerald-200 dark:border-emerald-800 font-semibold">
                      <span>NORMAL</span><span>Z &lt; +1.5σ</span>
                    </div>
                    <div className="flex justify-between p-1.5 bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200 rounded border border-amber-200 dark:border-amber-800 font-semibold">
                      <span>ELEVATED</span><span>+1.5σ ≤ Z &lt; +2.5σ</span>
                    </div>
                    <div className="flex justify-between p-1.5 bg-orange-50 dark:bg-orange-950 text-orange-800 dark:text-orange-200 rounded border border-orange-200 dark:border-orange-800 font-semibold">
                      <span>ABNORMAL</span><span>+2.5σ ≤ Z &lt; +4.0σ</span>
                    </div>
                    <div className="flex justify-between p-1.5 bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200 rounded border border-red-200 dark:border-red-800 font-semibold">
                      <span>CRITICAL</span><span>Z ≥ +4.0σ</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 10. GIS INVESTIGATION & VIEWPORT LOD */}
          <section id="gis-investigation" className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-600 font-bold text-xs font-mono">
                10
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                GIS Investigation Layer & Viewport Level-of-Detail (LOD)
              </h2>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm text-xs">
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                The GIS Command Map utilizes GPU-accelerated <strong className="text-slate-900 dark:text-slate-100">MapLibre GL JS</strong> vector rendering paired with dynamic PostGIS bounding-box viewport queries:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-slate-100">National Overview (Zoom &lt; 8)</div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Streams simplified centroid points to maintain 60 FPS performance during rapid pan/zoom.</p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-slate-100">Cluster Level (Zoom 8–11)</div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Renders density hotspot clusters with multi-sensor radiometric intensity rings.</p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-slate-100">Forensic Investigation (Zoom ≥ 12)</div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Renders exact PostGIS ST_ConvexHull bounding polygon envelopes and plant perimeter bounds.</p>
                </div>
              </div>
            </div>
          </section>

          {/* 11. APPLICATION SURFACES */}
          <section id="application-surfaces" className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800 text-orange-600 font-bold text-xs font-mono">
                11
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Application Surfaces Architecture: 5 Specialized Views
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
                <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-orange-600" /> 1. Live Sovereign Radar (/monitor)
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Interactive GIS map with live active thermal event markers, timeline scrubber, and deep-dive event slide-over inspection drawer.
                </p>
              </div>

              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
                <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Newspaper className="w-4 h-4 text-blue-600" /> 2. Thermo News Feed
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Time-ordered stream of qualifying regional thermal bulletins with automatic 15-minute autonomous NASA FIRMS telemetry updates.
                </p>
              </div>

              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
                <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-red-600" /> 3. Operational Alerts
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Dedicated operational queue displaying up to 250 highest-priority CRITICAL and ABNORMAL incidents with one-click map focusing.
                </p>
              </div>

              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
                <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-indigo-600" /> 4. Strategic Facilities Registry (/facilities)
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Authoritative database of industrial facilities with sector pills, baseline stats, active hotspot counters, and on-demand FIRMS pulling.
                </p>
              </div>

              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
                <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-600" /> 5. Dossier Studio & PDF Exporter (/reports)
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Generates and downloads publication-grade intelligence dossiers with SHA-256 integrity signatures and embedded Matplotlib telemetry plots.
                </p>
              </div>

              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
                <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-purple-600" /> 6. Grounded AI Tactical Assistant
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Conversational copilot operating under strict RAG parameters to answer operator questions grounded entirely in validated PostGIS records.
                </p>
              </div>
            </div>
          </section>

          {/* 12. GROUNDED AI & ANTI-HALLUCINATION */}
          <section id="grounded-ai" className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 font-bold text-xs font-mono">
                12
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Grounded AI Architecture & Anti-Hallucination Framework
              </h2>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm text-xs">
              <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> Foundational RAG Contract: Retrieve → Validate → Synthesize
                </div>
                <p className="text-[11px] leading-relaxed">
                  The language model does <strong>not</strong> act as a database or an independent source of truth. It explains information that has already been retrieved from validated PostgreSQL/PostGIS records.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <span className="font-bold text-slate-900 dark:text-slate-100">1. Strict XML Delimiter Context Injection</span>
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-[10px] text-slate-800 dark:text-slate-200">
                    &lt;VERIFIED_DATA&gt;<br />
                    Event ID: EVT-IN-GUJ-0001 | Class: GAS_FLARE<br />
                    Radiance: 480.0 MW | Baseline Mean: 150.0 MW<br />
                    Anomaly Tier: CRITICAL (+5.8σ)<br />
                    &lt;/VERIFIED_DATA&gt;
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Prevents prompt injection by isolating untrusted facility strings behind strict structural XML delimiters.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <span className="font-bold text-slate-900 dark:text-slate-100">2. Output Reference Scrubbing</span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    The backend parses the LLM output before delivery. If the model mentions any <code className="font-mono bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">event_id</code> or metric not present in the verified context block, the response is scrubbed to prevent hallucinations.
                  </p>
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded font-mono text-[10px] text-slate-700 dark:text-slate-300">
                    LLM ≠ Database &nbsp;|&nbsp; LLM ≠ Classifier &nbsp;|&nbsp; LLM = Grounded Explainer
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 13. TRUST, RELIABILITY & PROVENANCE */}
          <section id="trust-integrity" className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 font-bold text-xs font-mono">
                13
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Trust, Reliability & Provenance Architecture
              </h2>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Spatial K-Fold Validation
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Prevents spatial group leakage by ensuring identical industrial complexes never overlap between training and validation splits.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-600" /> SHA-256 Report Signatures
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Every generated dossier contains a cryptographic hash verifying that report telemetry has not been tampered with post-generation.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-emerald-600" /> 70/70 Automated Test Suite
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Complete unit, integration, and API contract coverage verifying geofencing, ML integrity, PDF generation, and poller cadence.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 14. CURRENTLY IMPLEMENTED VS FUTURE SCOPE */}
          <section id="implemented-vs-future" className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800 text-orange-600 font-bold text-xs font-mono">
                14
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Implementation Scope: Currently Implemented vs. Future Roadmap
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* CURRENTLY IMPLEMENTED */}
              <div className="p-5 bg-emerald-50/30 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-900 space-y-3">
                <div className="flex items-center justify-between border-b border-emerald-200 dark:border-emerald-800 pb-2">
                  <span className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600" /> Currently Implemented & Verified
                  </span>
                  <span className="font-mono text-[10px] bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded font-bold">100% OPERATIONAL</span>
                </div>
                <ul className="space-y-2 text-[11px] text-slate-700 dark:text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>Autonomous Ingestion:</strong> 15-min background FIRMS telemetry daemon.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>Sovereign Geofencing:</strong> Strict Point-in-Polygon Survey of India spatial validation.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>ST-DBSCAN Event Engine:</strong> 3.5km spatial / 12h temporal clustering + convex hulls.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>XGBoost ML Classification:</strong> 6 canonical categories with softmax calibration.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>TreeSHAP Explainability:</strong> Attribution feature importance extraction.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>90-Day Empirical Baselines:</strong> Z-Score operational anomaly calculations.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>MapLibre GIS Command Center:</strong> Level-of-Detail viewport stream.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>Strategic Facilities:</strong> Master registry with on-demand perimeter FIRMS fetching.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>Grounded Copilot RAG:</strong> Natural language assistant over PostGIS records.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>Cryptographic Dossiers:</strong> Dual UTC/IST PDF reports with SHA-256 signatures.</span>
                  </li>
                </ul>
              </div>

              {/* FUTURE SCOPE */}
              <div className="p-5 bg-blue-50/30 dark:bg-blue-950/20 rounded-2xl border border-blue-200 dark:border-blue-900 space-y-3">
                <div className="flex items-center justify-between border-b border-blue-200 dark:border-blue-800 pb-2">
                  <span className="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-600" /> Planned Future Enhancements
                  </span>
                  <span className="font-mono text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded font-bold">RESEARCH ROADMAP</span>
                </div>
                <ul className="space-y-2 text-[11px] text-slate-700 dark:text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">→</span>
                    <span><strong>Sentinel-2 SWIR Optical Fusion:</strong> On-demand 20m optical verification crops.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">→</span>
                    <span><strong>Atmospheric Wind Dispersion:</strong> Dynamic plume dispersion models using GFS/ERA5 weather data.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">→</span>
                    <span><strong>Geostationary Sensor Integration:</strong> Sub-hourly cadence from INSAT-3D / 3DR Imager.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">→</span>
                    <span><strong>Automated Emergency SMS/VAPID Dispatch:</strong> Push alerts to local district disaster authorities.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">→</span>
                    <span><strong>Longitudinal Carbon Accounting:</strong> Estimated metric tons CO2 / CH4 flaring emissions.</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* 15. SCIENTIFIC LIMITATIONS & RESPONSIBLE INTERPRETATION */}
          <section id="limitations" className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 font-bold text-xs font-mono">
                15
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Scientific Limitations & Responsible Interpretation
              </h2>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3 shadow-sm text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-slate-100">1. Temporal Cadence Constraints</div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Polar-orbiting satellites capture snapshots during orbital overpasses (~13:30 and ~01:30 local time). Short-lived thermal incidents occurring between overpasses cannot be captured.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-slate-100">2. Meteorological Occlusion</div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Heavy monsoon cloud cover and thick precipitation attenuate infrared emissions, occasionally masking ground thermal signatures.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-slate-100">3. Spatial Pixel Aggregation</div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    A sub-pixel flare of 10m² is recorded within a 375m pixel cell. FRP measures total radiant power within that cell rather than pinpoint physical flame geometry.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-slate-100">4. Probabilistic Confidence Interpretation</div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Model classifications express statistical likelihood based on learned radiometric and spatial patterns, not physical ground-truth confirmation.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 16. SYSTEM ARCHITECTURE SUMMARY & TECH STACK */}
          <section id="tech-stack" className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs font-mono">
                16
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Technical Stack & System Architecture Summary
              </h2>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                  <div className="font-bold text-slate-900 dark:text-slate-100">Frontend</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">Next.js 16 + React 19 + TailwindCSS</div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                  <div className="font-bold text-slate-900 dark:text-slate-100">GIS Map Engine</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">MapLibre GL JS 6.6 (WebGL)</div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                  <div className="font-bold text-slate-900 dark:text-slate-100">Backend API</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">FastAPI + Python 3.10 ASGI</div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                  <div className="font-bold text-slate-900 dark:text-slate-100">Database</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">PostgreSQL 16 + PostGIS 3.4</div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                  <div className="font-bold text-slate-900 dark:text-slate-100">ML Engine</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">XGBoost + TreeSHAP + Scikit-Learn</div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                  <div className="font-bold text-slate-900 dark:text-slate-100">PDF Dossiers</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">ReportLab + Matplotlib (High-DPI)</div>
                </div>
              </div>
            </div>
          </section>

          {/* 17. TECHNICAL GLOSSARY & CODEX */}
          <section id="glossary" className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800 text-orange-600 font-bold text-xs font-mono">
                17
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Interactive Technical Glossary & Terminology Codex
              </h2>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm text-xs">
              {/* Filter and Search Bar */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="flex flex-wrap gap-1.5">
                  {["ALL", "Space & Telemetry", "Spatial & GIS", "Machine Learning", "Baselines & Anomaly", "Architecture"].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setGlossaryCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                        glossaryCategory === cat
                          ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="relative min-w-[240px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filter terms (e.g. FRP, ST-DBSCAN)..."
                    value={glossarySearch}
                    onChange={(e) => setGlossarySearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-orange-500 transition"
                  />
                </div>
              </div>

              {/* Glossary Items Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {filteredGlossary.map((g, i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-xs font-mono">{g.term}</span>
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {g.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">{g.shortDef}</p>
                    {technicalMode && (
                      <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                        {g.technicalDetails}
                        {g.sourceRef && (
                          <div className="text-[9px] text-orange-600 dark:text-orange-400 font-sans mt-0.5">
                            Ref: {g.sourceRef}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
