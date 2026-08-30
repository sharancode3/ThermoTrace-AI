import os
import sys
import json
import re
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
4. STRICTLY SEPARATE:
   - OBSERVED: Directly captured satellite telemetry.
   - DERIVED: Mathematical Z-scores, spatial proximity, and thermal trends.
   - MODELLED: Calibrated classifier predictions and SHAP feature drivers.
   - UNKNOWN: Missing history, single observations, or unverified boundaries.

Output strict JSON with the following structure:
{
  "headline": "<Concise uppercase tactical headline>",
  "what_happened": "<OBSERVED: Satellite sensor detections, peak FRP MW, and brightness>",
  "why_it_matters": "<DERIVED: Operational anomaly Z-score, baseline comparison, and facility proximity>",
  "model_assessment": "<MODELLED: Calibrated classification, confidence %, and primary SHAP drivers>",
  "uncertainty_and_gaps": "<UNKNOWN: Explicitly state data gaps or observation limitations>"
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
    event_id = intel.get("event_id", "UNKNOWN")
    raw_cls = intel.get("classification", "OTHER_UNCERTAIN")
    cls_readable = clean_class_name(raw_cls)
    conf = intel.get("classification_confidence", 0.0) * 100.0
    anom_tier = intel.get("anomaly_tier", "NORMAL")
    z_score = intel.get("anomaly_z_score", 0.0)
    peak_frp = intel.get("peak_frp_mw", 0.0)
    fac_name = intel.get("facility_name") or intel.get("location_name") or "Regional Industrial Corridor"
    dist = intel.get("distance_to_facility_m")
    obs_count = intel.get("observation_count", 1)
    trend = intel.get("thermal_trend", "STABLE")
    
    dist_str = f"{dist:.1f} m from {fac_name}" if dist is not None else f"near {fac_name}"
    
    return {
        "headline": f"{anom_tier} THERMAL EVENT: {cls_readable.upper()} DETECTED NEAR {fac_name.upper()}",
        "what_happened": f"OBSERVED: Satellite radiometry recorded {obs_count} thermal observation(s) with peak radiant power of {peak_frp:.1f} MW. Current thermal trend is assessed as {trend}.",
        "why_it_matters": f"DERIVED: The thermal signature is located {dist_str}. Operational anomaly severity is {anom_tier} (Statistical Z-score: +{z_score:.2f} sigma).",
        "model_assessment": f"MODELLED: Calibrated classification is {cls_readable} ({conf:.1f}% confidence). Primary drivers include spatial proximity and radiant intensity.",
        "uncertainty_and_gaps": "UNKNOWN: Single-sensor pass limits long-term duration forecasting. Continued 5-minute polling active."
    }

def validate_llm_output(llm_json: Dict[str, Any], source_intel: Dict[str, Any]) -> bool:
    if not isinstance(llm_json, dict):
        return False
        
    required_keys = ["headline", "what_happened", "why_it_matters", "model_assessment", "uncertainty_and_gaps"]
    for k in required_keys:
        if k not in llm_json or not isinstance(llm_json[k], str):
            return False
            
    expected_cls = source_intel.get("classification", "OTHER_UNCERTAIN")
    readable_cls = clean_class_name(expected_cls)
    if expected_cls not in llm_json["headline"] and expected_cls not in llm_json["model_assessment"] and readable_cls.lower() not in llm_json["headline"].lower():
        return False
        
    return True

def humanize_intelligence(intel_object: Dict[str, Any]) -> Dict[str, Any]:
    try:
        payload = {
            "model": LOCAL_LLM_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Verified Intelligence Object:\n{json.dumps(intel_object, indent=2)}"}
            ],
            "temperature": 0.1,
            "response_format": {"type": "json_object"}
        }
        res = requests.post(LOCAL_LLM_ENDPOINT, json=payload, timeout=2.5)
        if res.ok:
            data = res.json()
            content = data["choices"][0]["message"]["content"]
            parsed = json.loads(content)
            if validate_llm_output(parsed, intel_object):
                return parsed
    except Exception:
        pass
        
    return generate_deterministic_fallback(intel_object)
