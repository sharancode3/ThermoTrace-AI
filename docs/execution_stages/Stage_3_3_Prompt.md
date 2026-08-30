THERMO INTELLIGENCE — STAGE 3.3
THERMAL INTELLIGENCE FINAL HARDENING + LIVE INDIA FIRMS + HUMANIZED VERIFIED OUTPUT

============================================================
MISSION
============================================================

You are continuing the existing Thermo Intelligence SIH 2026 project.

Stages 1, 2, 3 and 3.2 already exist.

DO NOT treat previous agent completion messages as proof of correctness.

The purpose of Stage 3.3 is to take the CURRENT analytical engine and make it:

- more correct
- more internally consistent
- more uncertainty-aware
- more information-rich
- more explainable
- more useful for actual investigation
- more robust with sparse data
- more reliable for real FIRMS data
- immediately testable through the existing frontend

This is STILL the THERMAL INTELLIGENCE stage.

DO NOT move into full Stage 4 feature implementation.

The priority order is:

1. analytical correctness
2. thermal intelligence quality
3. live FIRMS ingestion correctness
4. real frontend visibility for testing
5. local LLM humanization only after verified analytics

============================================================
MANDATORY DOCUMENT RULE
============================================================

Before modifying ANY code:

Read the COMPLETE CURRENT versions of:

1. Thermo_Intelligence_PRD.md
2. Thermo_Intelligence_TRD.md
3. Thermo_Intelligence_Workflow.md
4. Thermo_Intelligence_Database_Storage.md
5. Thermo_Intelligence_UIUX.md
6. Thermo_Intelligence_DB_API_Contract.md
7. openapi.yaml
8. Thermo_Intelligence_System_Architecture.md
9. Thermo_Intelligence_Frontend_Architecture.md
10. Thermo_Intelligence_Backend_Architecture.md
11. Thermo_Intelligence_Data_ML_GIS_Architecture.md
12. Thermo_Intelligence_LLM_Reports_Notifications_Architecture.md

Then inspect the actual repository and current database.

Keep referring to these documents throughout the implementation.

DO NOT invent alternate contracts.

============================================================
CURRENT ARCHITECTURAL TRUTH
============================================================

The system is:

NASA FIRMS
      ↓
thermal_observations
      ↓
ST-DBSCAN
      ↓
thermal_events
      ↓
facility + land-cover context
      ↓
canonical feature vector
      ↓
XGBoost classification
      ↓
persistence
      ↓
facility baseline
      ↓
anomaly
      ↓
Thermal Intelligence Object
      ↓
frontend / News / future Chat / future Reports

Raw telemetry remains immutable.

Classification, persistence and anomaly remain separate dimensions.

The LLM remains downstream of verified intelligence.

The frontend does not calculate analytical truth.

============================================================
CRITICAL CORRECTIONS TO VERIFY FIRST
============================================================

The current Stage 3.2 reported output contains:

Classification:
"IND_FLARE / AGRI_BURN"

This is INVALID.

The classification field must contain exactly ONE canonical class:

IND_FIRE
IND_FLARE
IND_ROUTINE
AGRI_BURN
WILDFIRE
OTHER_UNCERTAIN

If multiple class probabilities exist:

classification = highest validated class

and:

class_probabilities = complete probability distribution

Do NOT concatenate multiple classes into the primary class field.

============================================================

The current report also used:

EPHEMERAL

This is NOT one of the canonical persistence values.

Use:

TRANSIENT
INTERMITTENT
PERSISTENT

exactly as defined by the current DB/API contract.

============================================================

The current report used:

Z <= 2.0 NORMAL
2.0–3.0 ELEVATED
3.0–4.0 ABNORMAL
>4 CRITICAL

This conflicts with the authoritative contract.

The implementation must use the current canonical thresholds:

NORMAL:
Z < 1.5

ELEVATED:
1.5 <= Z < 2.5

ABNORMAL:
2.5 <= Z < 4.0

CRITICAL:
Z >= 4.0

Also preserve the documented critical footprint-expansion rule where applicable.

Do not silently keep old thresholds because existing tests were written around them.

Update tests to the authoritative values.

============================================================
PHASES 0 TO 57 OVERVIEW
============================================================
(Full Stage 3.3 Prompt Instructions for Checkpoints A to K, Local LLM benchmark, FIRMS polling, and final scientific review as specified)
