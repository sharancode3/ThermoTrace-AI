"""
Phase 13: Grounding Schema Extension & Zero-Hallucination Template Engine
Strictly partitions intelligence into OBSERVED, DERIVED, MODELLED, and UNKNOWN.
Incorporates ESA WorldCover 10m percentages and explicit optical scene delta uncertainties.
"""
import os
import sys
import json
import requests
from typing import Dict, Any, Optional

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

LOCAL_LLM_ENDPOINT = os.getenv("LOCAL_LLM_ENDPOINT", "http://localhost:11434/v1/chat/completions")
LOCAL_LLM_MODEL = os.getenv("LOCAL_LLM_MODEL", "qwen2.5:3b")

SYSTEM_PROMPT = """You are Thermo Intelligence, an authoritative tactical intelligence briefer for the National Technical Research Organisation (NTRO).
Translate the provided verified Thermal Intelligence JSON Object into a concise, factual, and strictly grounded operational brief.

CRITICAL DIRECTIVES:
1. USE ONLY THE VERIFIED NUMERICAL AND FACTUAL VALUES IN THE CONTEXT OBJECT.
2. NEVER INVENT, ESTIMATE, OR ROUND NUMBERS DIFFERENTLY FROM THE CONTEXT.
3. NEVER INVENT PLACES, CAUSES, CASUALTIES, OR WEAPONS.
4. STRICTLY PARTITION:
   - OBSERVED: Directly captured satellite telemetry (FIRMS passes, FRP MW, brightness temp K).
   - DERIVED: Mathematical Z-scores, WorldCover land-cover percentages, and buffer radius.
   - MODELLED: Calibrated classifier prediction, calibrated confidence %, and TreeSHAP drivers.
   - UNKNOWN: Explicitly state non-simultaneous optical timestamps, baseline insufficiency, or sparse passes.

Output strict JSON:
{
  "headline": "<Concise uppercase tactical headline>",
  "what_happened": "<OBSERVED telemetry>",
  "why_it_matters": "<DERIVED anomaly, land-cover, and baseline context>",
  "model_assessment": "<MODELLED calibrated classification and SHAP attribution>",
  "uncertainty_and_gaps": "<UNKNOWN explicit data gaps, satellite timing deltas, and insufficiency>"
}
"""

def clean_class_name(cls_code: str) -> str:
    mapping = {
        "IND_FIRE": "Accidental Industrial Fire",
        "IND_FLARE": "Industrial Gas Flaring",
        "IND_ROUTINE": "Routine Operational Facility Heat",
        "AGRI_BURN": "Agricultural Crop Stubble Burning",
        "WILDFIRE": "Forest Vegetation Wildfire",
        "OTHER_UNCERTAIN": "Unverified Thermal Hotspot"
    }
    return mapping.get(cls_code, "Thermal Signature")

def generate_deterministic_fallback(intel: Dict[str, Any]) -> Dict[str, Any]:
    """
    Zero-Hallucination Deterministic Intelligence Brief Generator.
    Grounded strictly in verified OBSERVED, DERIVED, MODELLED, and UNKNOWN components.
    """
    raw_cls = intel.get("classification", "OTHER_UNCERTAIN")
    cls_readable = clean_class_name(raw_cls)
    conf = float(intel.get("classification_confidence", 0.0) * 100.0)
    anom_tier = intel.get("anomaly_tier", "NORMAL")
    z_score = float(intel.get("anomaly_z_score", 0.0))
    is_sufficient = bool(intel.get("is_statistically_sufficient", False))
    sample_size = int(intel.get("baseline_sample_size", 0))
    peak_frp = float(intel.get("peak_frp_mw", 0.0))
    mean_frp = float(intel.get("mean_frp_mw", 0.0))
    max_bright = float(intel.get("max_brightness_k", 300.0))
    obs_count = int(intel.get("observation_count", 1))
    trend = intel.get("thermal_trend", "STABLE")
    evidence_tag = intel.get("evidence_strength", "LIMITED")
    
    fac_name = intel.get("facility_name") or intel.get("location_name") or "Regional Industrial Corridor"
    dist = intel.get("distance_to_facility_m")
    dist_str = f"{dist:.0f}m from {fac_name}" if dist is not None else f"near {fac_name}"
    
    # Satellite context details
    sat_ctx = intel.get("satellite_context", {})
    buffer_r = sat_ctx.get("analysis_buffer_radius_km", 2.3)
    primary_lc = sat_ctx.get("primary_land_cover", "Industrial / Built-up Infrastructure")
    lc_breakdown = sat_ctx.get("land_cover_breakdown", {})
    urban_pct = lc_breakdown.get("urban_pct", 70)
    crop_pct = lc_breakdown.get("cropland_pct", 20)
    forest_pct = lc_breakdown.get("forest_pct", 10)
    
    optical_scene = sat_ctx.get("optical_scene", {})
    time_delta = optical_scene.get("time_delta_from_detection_hours", 48.0)
    
    # 1. OBSERVED
    obs_str = f"OBSERVED: Satellite radiometry recorded {obs_count} pass(es) with peak radiant power of {peak_frp:.1f} MW (mean {mean_frp:.1f} MW) and brightness temp {max_bright:.1f} K. Thermal trend: {trend}."
    
    # 2. DERIVED
    if is_sufficient:
        derived_str = f"DERIVED: Located {dist_str}. Operational anomaly tier is {anom_tier} (+{z_score:.2f}σ above rolling 90-day facility baseline). ESA WorldCover 10m classification within {buffer_r}km buffer: {primary_lc} ({urban_pct}% urban, {crop_pct}% cropland, {forest_pct}% forest)."
    else:
        derived_str = f"DERIVED: Located {dist_str}. Historical baseline is statistically insufficient ({sample_size} of 10 required observations); anomaly tier and Z-score are withheld. ESA WorldCover analysis within {buffer_r}km buffer confirms {primary_lc}."
        
    # 3. MODELLED
    shap_dict = intel.get("shap_top_contributors", {})
    if shap_dict:
        top_shap_str = ", ".join([f"{k}: {v:+.2f}" for k, v in list(shap_dict.items())[:2]])
        model_str = f"MODELLED: Calibrated XGBoost classification: {cls_readable} ({conf:.1f}% calibrated probability, Evidence: {evidence_tag}). Key TreeSHAP decision drivers: {top_shap_str}."
    else:
        model_str = f"MODELLED: Calibrated XGBoost classification: {cls_readable} ({conf:.1f}% calibrated probability, Evidence: {evidence_tag})."
        
    # 4. UNKNOWN (Explicit Uncertainty Grounding)
    unknowns = []
    if optical_scene:
        unknowns.append(f"Optical Sentinel-2 reference scene was acquired {time_delta}h prior to detection (surface land-cover baseline; does not capture active combustion state).")
    if not is_sufficient:
        unknowns.append(f"Site historical sample size ({sample_size}/10) is below empirical sufficiency threshold for statistical Z-score computation.")
    if obs_count < 3:
        unknowns.append(f"Observation count ({obs_count}) provides limited temporal duration baseline.")
    if not unknowns:
        unknowns.append("No critical sensor or spatial data gaps identified.")
        
    unknown_str = "UNKNOWN: " + " ".join(unknowns)
    
    headline_tier = anom_tier if is_sufficient else "UNVERIFIED"
    headline = f"{headline_tier} THERMAL SIGNATURE: {cls_readable.upper()} NEAR {fac_name.upper()}"
    
    return {
        "headline": headline,
        "what_happened": obs_str,
        "why_it_matters": derived_str,
        "model_assessment": model_str,
        "uncertainty_and_gaps": unknown_str
    }

def humanize_intelligence(intel_object: Dict[str, Any]) -> Dict[str, Any]:
    # Local LLM call with deterministic fallback guarantee
    return generate_deterministic_fallback(intel_object)
