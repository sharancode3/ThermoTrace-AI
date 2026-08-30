# THERMO INTELLIGENCE — STAGE 3 CORRECTION + REAL-DATA INTELLIGENCE IMPLEMENTATION

IMPORTANT:
This is a continuation of the existing Thermo Intelligence project.

Stage 1 and Stage 2 are already implemented.
Stage 3 is now being implemented.

This prompt is specifically intended to correct the current Stage 3 implementation where necessary and make the intelligence layer work from REAL DATA rather than demo/hard-coded intelligence.

DO NOT START BY WRITING NEW FEATURES.

FIRST:
Read the complete current repository and all authoritative project documents listed below, inspect the current implementation, and determine what Stage 1/2/3 functionality already exists.

============================================================
AUTHORITATIVE DOCUMENTS — MUST BE REFERRED TO THROUGHOUT
============================================================

Read and continuously refer back to:

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

These are the project's source of truth.

Do NOT silently redesign the architecture.
Do NOT invent a new database schema.
Do NOT invent new API fields.
Do NOT create duplicate implementations.
Do NOT replace the agreed architecture with a different ML architecture just because it looks more advanced.

For every Stage 3 implementation decision:
check the relevant authoritative document first.

============================================================
PRIMARY GOAL
============================================================

The most important requirement of this Stage 3 implementation is:

REAL FIRMS DATA
        ↓
REAL THERMAL EVENTS
        ↓
REAL INDUSTRIAL / NON-INDUSTRIAL CONTEXT
        ↓
REAL FEATURE VECTOR
        ↓
ACTUAL TRAINED ML MODEL
        ↓
ACTUAL CLASSIFICATION
        ↓
ACTUAL PERSISTENCE / BASELINE
        ↓
ACTUAL ANOMALY
        ↓
USER-UNDERSTANDABLE INTELLIGENCE

There must be NO fake intelligence.

Do not use:
- hard-coded classifications
- hard-coded confidence values
- hard-coded Z-scores
- hard-coded anomaly values
- hard-coded facility names
- hard-coded "critical" events
- demo event values presented as real
- frontend-only fake AI results

The intelligence shown in the product must come from the real Stage 2 data and actual Stage 3 processing.

============================================================
MOST IMPORTANT PRODUCT CORRECTION
============================================================

The user-facing product must NOT force users to understand statistical terminology before they understand the main answer.

The primary question for a user is:

"Is this thermal event industrial or non-industrial?"

The product should make this immediately understandable.

Therefore the UI must prioritize:

PRIMARY CLASSIFICATION:
    INDUSTRIAL
    NON-INDUSTRIAL

Then, only when useful, provide:

SECONDARY SOURCE TYPE:
    Industrial Fire
    Industrial Flare
    Routine Industrial Heat
    Agricultural Burn
    Wildfire
    Other / Uncertain

Then provide:
    Confidence
    Persistence
    Behaviour
    Anomaly

This does NOT mean changing the authoritative database/API classification enums.

Keep the canonical backend classification values:

IND_FIRE
IND_FLARE
IND_ROUTINE
AGRI_BURN
WILDFIRE
OTHER_UNCERTAIN

Create a clear derived presentation grouping:

IND_FIRE
IND_FLARE
IND_ROUTINE
    ↓
INDUSTRIAL

AGRI_BURN
WILDFIRE
OTHER_UNCERTAIN
    ↓
NON-INDUSTRIAL / UNCERTAIN

IMPORTANT:
Do not falsely call OTHER_UNCERTAIN "non-industrial".
It should remain:
    UNCERTAIN
where appropriate.

The user-facing interface may therefore present:

Industrial
Non-Industrial
Uncertain

while the detailed subtype remains available.

Do NOT destroy the canonical multi-class classification system merely to simplify the UI.

============================================================
USER EXPERIENCE RULE
============================================================

Users should NOT need to know what sigma means.

If the system stores:

7.62σ

the UI should communicate something like:

    VERY HIGH ABOVE NORMAL

and provide a small explanation:

    "Current thermal intensity is far above this facility's historical baseline."

A user can expand:

    Statistical detail:
    7.62 standard deviations above baseline

The technical value can remain visible for analysts, reports, and advanced users.

DO NOT build the product around unexplained:
- sigma
- Z-score
- standard deviation
- FRP
- convex hull
- ST-DBSCAN

These are analytical details, not the first-level user message.

The screen should answer:

WHAT IS IT?
IS IT NORMAL?
HOW STRONG IS THE EVIDENCE?
WHY DID THE SYSTEM SAY THAT?

before showing deep statistical terminology.

============================================================
REAL-TIME / FIRMS REQUIREMENT
============================================================

The application must use REAL NASA FIRMS data.

Do NOT use synthetic/demo FIRMS observations for the live Monitor screen once real ingestion is available.

The FIRMS API key must remain backend-only.

The application is India-focused according to the project contract.

Use the defined India geographic coverage.

IMPORTANT:
Do NOT falsely claim:

"FIRMS updates every 5 minutes"

unless the actual FIRMS source/data availability supports that statement.

Polling frequency and satellite observation availability are NOT the same thing.

The system may poll the FIRMS API at the project's configured interval, but polling more frequently does not manufacture new satellite observations.

Therefore:

1. Inspect the current Stage 3/Stage 2 configuration.
2. Keep the polling interval configurable.
3. Respect the current authoritative project workflow/configuration.
4. If the repository currently uses a different interval than the documented workflow, do not silently create two competing schedulers.
5. Do not present the UI as "new satellite data every 5 minutes" unless there is actual new source data.
6. Show the actual observation/data timestamp to the user.
7. Show data freshness separately from polling frequency.

The user should be able to understand:

    Latest satellite observation:
    14:20 UTC

    Data refreshed:
    14:25 UTC

instead of being misled into thinking that a new satellite observation exists every five minutes.

============================================================
REMOVE DEMO INTELLIGENCE FROM THE REAL PATH
============================================================

Inspect the current repository for demo/sample intelligence such as:

EVT-DEMO-001

or hard-coded:

critical
7.62 sigma
150 MW
25 MW
340.5 MW

If these are development fixtures, they must remain isolated to tests/demo fixtures.

They must NOT appear in the production/default real-data path.

The application should display:

REAL EVENT IDs
REAL FIRMS OBSERVATIONS
REAL FACILITY INFORMATION
REAL CALCULATED RESULTS

If the real database currently has no completed analytical result for an event:

display:

    Analysis pending

NOT:

    fake classification

NOT:

    fake confidence

NOT:

    fake anomaly

============================================================
STAGE 3 ANALYTICAL PIPELINE
============================================================

Implement and verify:

thermal_observations
        ↓
ST-DBSCAN
        ↓
thermal_events
        ↓
facility context
        +
land-cover context
        ↓
14-feature canonical feature vector
        ↓
XGBoost
        ↓
classification probabilities
        ↓
primary industrial/non-industrial presentation
        ↓
persistence
        ↓
facility baseline
        ↓
anomaly
        ↓
complete Intelligence Object

Do NOT collapse these into one calculation.