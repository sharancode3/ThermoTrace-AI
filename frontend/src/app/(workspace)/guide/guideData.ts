export interface GuideGlossaryTerm {
  term: string;
  category: "Space & Telemetry" | "Spatial & GIS" | "Machine Learning" | "Baselines & Anomaly" | "Architecture";
  shortDef: string;
  technicalDetails: string;
  sourceRef?: string;
}

export const GUIDE_GLOSSARY: GuideGlossaryTerm[] = [
  {
    term: "NASA FIRMS",
    category: "Space & Telemetry",
    shortDef: "Fire Information for Resource Management System providing near-real-time satellite thermal hotspot observations.",
    technicalDetails: "Ingests LANCE NRT data from VIIRS (S-NPP, NOAA-20, NOAA-21) and MODIS (Terra, Aqua) over India bounds [68°E–97.5°E, 6.5°N–37.5°N].",
    sourceRef: "NASA LANCE EOSDIS / VIIRS 375m I-Band & MODIS 1km"
  },
  {
    term: "FRP (Fire Radiative Power)",
    category: "Space & Telemetry",
    shortDef: "Radiative heat output released by a thermal source, measured in Megawatts (MW).",
    technicalDetails: "Quantifies the rate of radiant energy emitted via the 3.9 μm mid-wave infrared (MWIR) channel using Wooster et al. formulation.",
    sourceRef: "Wooster et al., Remote Sensing of Environment (2005)"
  },
  {
    term: "Brightness Temperature (T_b)",
    category: "Space & Telemetry",
    shortDef: "Calibrated thermal radiance of a ground target expressed in Kelvin (K).",
    technicalDetails: "Calculated using the inverse Planck function across VIIRS I4 (3.74 μm MWIR) and I5 (11.45 μm TIR) channels. Nominal values range from 300 K to 500+ K.",
    sourceRef: "VIIRS Sensor Data Record (SDR) User Guide"
  },
  {
    term: "ST-DBSCAN",
    category: "Spatial & GIS",
    shortDef: "Spatio-Temporal Density-Based Spatial Clustering of Applications with Noise.",
    technicalDetails: "Clusters disparate multi-sensor satellite pixels into cohesive thermal events using spatial threshold eps_spatial (750m–3500m) and temporal window eps_temporal (12 hours).",
    sourceRef: "Birant & Kut (2007) / PostGIS ST_ConvexHull Envelope"
  },
  {
    term: "PostGIS",
    category: "Spatial & GIS",
    shortDef: "Spatial database extender for PostgreSQL providing high-performance indexed geometric operators.",
    technicalDetails: "Uses GiST spatial indexes on WGS84 geography geometries (SRID=4326), ST_DWithin for facility buffers, and ST_Intersects for polygon clipping.",
    sourceRef: "PostgreSQL 16 + PostGIS 3.4 Spatial Architecture"
  },
  {
    term: "Sovereign Geofencing",
    category: "Spatial & GIS",
    shortDef: "Strict point-in-polygon validation restricting analysis exclusively to the Republic of India territory.",
    technicalDetails: "Evaluates observation coordinates against Survey of India official boundary definitions, automatically discarding transboundary foreign pixels and oceanic noise.",
    sourceRef: "Survey of India Official Administrative Polygon Boundary"
  },
  {
    term: "XGBoost Classifier",
    category: "Machine Learning",
    shortDef: "Extreme Gradient Boosting decision-tree ensemble used for calibrated multi-class thermal emitter classification across 4 tactical categories.",
    technicalDetails: "Evaluates a 14-dimensional normalized feature vector with L2 regularization to output calibrated multi-class probability distributions.",
    sourceRef: "thermo_xgb_v1.1.0.joblib / Chen & Guestrin (2016)"
  },
  {
    term: "TreeSHAP",
    category: "Machine Learning",
    shortDef: "Game-theoretic feature attribution method providing deterministic explainability for tree models.",
    technicalDetails: "Calculates exact Shapley values for each input feature, identifying which specific spatial, radiometric, or historical signals drove the model's classification.",
    sourceRef: "Lundberg et al., Nature Machine Intelligence (2020)"
  },
  {
    term: "Softmax Calibration",
    category: "Machine Learning",
    shortDef: "Statistical calibration aligning raw model probabilities with empirical observation confidence.",
    technicalDetails: "Prevents overconfident probability spikes (e.g. 99.99%) by evaluating class logit margins and Brier score minimization across Spatial K-Fold holdouts.",
    sourceRef: "Niculescu-Mizil & Caruana / Platt Scaling"
  },
  {
    term: "OTHER_UNCERTAIN",
    category: "Machine Learning",
    shortDef: "A valid analytical classification assigned when available evidence is ambiguous or confidence is low.",
    technicalDetails: "Triggered when maximum calibrated class probability falls below operational certainty thresholds or when conflicting multi-sensor evidence exists.",
    sourceRef: "ThermoTrace Epistemic Integrity Architecture"
  },
  {
    term: "90-Day Empirical Baseline",
    category: "Baselines & Anomaly",
    shortDef: "Rolling statistical profile of normal radiant output for registered industrial facilities.",
    technicalDetails: "Computes historical mean (μ), standard deviation (σ), median (Q50), and 95th percentile (Q95) FRP over a 90-day window excluding active anomaly contamination.",
    sourceRef: "FacilityBaseline Storage Schema & Pipeline"
  },
  {
    term: "Z-Score Anomaly Metric",
    category: "Baselines & Anomaly",
    shortDef: "Standardized statistical deviation quantifying how unusual an event's FRP is relative to its baseline.",
    technicalDetails: "Calculated as Z = (Observed_FRP - Mean_FRP) / StdDev_FRP. Divided into NORMAL (<1.5σ), ELEVATED (1.5–<2.5σ), ABNORMAL (2.5–<4.0σ), and CRITICAL (≥4.0σ).",
    sourceRef: "ThermoTrace Anomaly Engine Specification"
  },
  {
    term: "Thermal Persistence",
    category: "Baselines & Anomaly",
    shortDef: "Classification of recurring multi-temporal heat signatures at a fixed geographic location.",
    technicalDetails: "Categorized into TRANSIENT (single pass/short duration), INTERMITTENT (recurring across 2-5 days), and PERSISTENT (continuous activity across 90+ days).",
    sourceRef: "Event Persistence Engine (Phase 8 Specification)"
  },
  {
    term: "Grounded RAG (Retrieval-Augmented Generation)",
    category: "Architecture",
    shortDef: "Natural language conversational framework strictly grounded in validated database facts.",
    technicalDetails: "The local language model receives factual records enclosed in <VERIFIED_DATA> delimiters and is structurally forbidden from inventing telemetry facts.",
    sourceRef: "ThermoTrace Anti-Hallucination Grounding Contract"
  },
  {
    term: "Cryptographic Dossier Hash",
    category: "Architecture",
    shortDef: "Deterministic SHA-256 digital signature embedded in every exported intelligence report.",
    technicalDetails: "Generated over canonical report parameters and stored in response headers (X-Report-SHA256) ensuring regulatory immutability and provenance tracking.",
    sourceRef: "PDFRenderer / CPCB Regulatory Audit Trail"
  },
  {
    term: "Temporal Freshness Windows",
    category: "Baselines & Anomaly",
    shortDef: "Operational classification of hot-spots into Active (<24h), Aging (24–72h), and Historical (>72h) records based on elapsed hours since latest satellite observation.",
    technicalDetails: "Evaluates elapsed time: t < 24h = ACTIVE (rendered with solid vibrant stroke and glow), 24h <= t < 72h = AGING / COOLING (rendered with dashed border and subdued opacity), t >= 72h = HISTORICAL / EXTINGUISHED (retains original anomaly tier while acknowledging lack of recent satellite activity).",
    sourceRef: "ThermoTrace Lifecycle Policy (backend/app/domain/lifecycle.py)"
  },
  {
    term: "Canonical Lifecycle Status",
    category: "Baselines & Anomaly",
    shortDef: "Authoritative state machine governing thermal event life stages: ACTIVE, COOLING, EXTINGUISHED, and legacy RESOLVED.",
    technicalDetails: "A transition model ensuring historical severity (CRITICAL, ABNORMAL, ELEVATED, NORMAL) is preserved for forensic audits, while status reflects whether satellites have detected continuing radiant energy in current orbital passes.",
    sourceRef: "CanonicalLifecycleStatus Schema / PostGIS Event Engine"
  },
  {
    term: "Satellite Orbital Revisits",
    category: "Space & Telemetry",
    shortDef: "Discrete sun-synchronous orbital overpasses by VIIRS and MODIS sensors (typically 10–12 hours between passes).",
    technicalDetails: "Absence of a detection during an interval does not guarantee physical extinction, as orbital blind spots, heavy cloud cover, sensor view angles, and sub-pixel saturation thresholds limit detection opportunity.",
    sourceRef: "NASA LANCE EOSDIS Orbital Ephemeris"
  },
  {
    term: "Tactical Symbology System",
    category: "Architecture",
    shortDef: "Sovereign 4-icon visual standard paired with 3-tier severity color tints and operational freshness states.",
    technicalDetails: "Distinct SVG geometries for Industry (twin factory stacks), Forest Wildfire (pine silhouette with flame tongues), Agricultural Crop Residue (curved grain stalk), and Other/Uncertain (radar diamond). Tinted Red for Critical/Fire, Amber for Abnormal/Flare, and Yellow/Green for Routine/Normal, with dashed strokes for aged events.",
    sourceRef: "ThermalMapMarker (frontend/src/components/ThermalMapMarker.tsx)"
  }
];
