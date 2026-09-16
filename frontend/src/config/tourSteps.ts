import { TourStep } from "@/types/tour";
import { openDemoEventPanel } from "@/components/tour/TourContext";

export const TOUR_STEPS: TourStep[] = [
  // --- PHASE 3: MONITOR WALKTHROUGH ---
  {
    id: "step-monitor-intro",
    route: "/monitor",
    targetSelector: '[data-tour="sidebar-monitor"]',
    title: "Monitor Workspace",
    description: "This is your live monitoring workspace, where you can view activity and incidents on the map.",
    placement: "right",
  },
  {
    id: "step-live-map",
    targetSelector: '[data-tour="map-container"]',
    title: "Live Map",
    description: "View detected incidents and activity directly on the map.",
    placement: "center",
  },
  {
    id: "step-incident",
    targetSelector: '[data-tour="map-marker"]',
    title: "Incident Marker",
    description: "Click an incident to view detailed information and related actions.",
    placement: "top",
    waitForElement: true,
  },
  {
    id: "step-incident-panel",
    action: () => {
      openDemoEventPanel("EVT-IN-MAD-0005");
    },
    targetSelector: '[data-tour="event-detail-drawer"]',
    title: "Incident Panel",
    description: "Explore incident details, alerts, and available actions here.",
    placement: "left",
    waitForElement: true,
  },
  {
    id: "step-ask-ai",
    targetSelector: '[data-tour="ask-ai-button"]',
    title: "Ask AI",
    description: "Get AI-powered insights and ask questions about the selected incident.",
    placement: "top",
    waitForElement: true,
  },
  {
    id: "step-download",
    targetSelector: '[data-tour="download-report-button"]',
    title: "Download Report",
    description: "Download the available incident information for further use.",
    placement: "top",
    waitForElement: true,
  },

  // --- PHASE 4: FACILITIES WALKTHROUGH ---
  {
    id: "step-facilities-intro",
    route: "/facilities",
    targetSelector: '[data-tour="sidebar-facilities"]',
    title: "Facilities Registry",
    description: "Explore and monitor the facilities available on the platform.",
    placement: "right",
  },
  {
    id: "step-facilities-filter",
    targetSelector: '[data-tour="facilities-filter-bar"]',
    title: "Search & Sector Filters",
    description: "Filter industrial units by name, state, operator, or sector category.",
    placement: "bottom",
    waitForElement: true,
  },
  {
    id: "step-facilities-grid",
    targetSelector: '[data-tour="facilities-directory-grid"]',
    title: "Facility Directory",
    description: "Browse priority industrial units with live flaring baseline metrics.",
    placement: "top",
    waitForElement: true,
  },
  {
    id: "step-facility-card",
    targetSelector: '[data-tour="facility-card-first"]',
    title: "Facility Intelligence",
    description: "Click any facility card to inspect historical baselines, coordinates, and telemetry.",
    placement: "top",
    waitForElement: true,
  },

  // --- PHASE 5: REPORTS WALKTHROUGH ---
  {
    id: "step-reports-intro",
    route: "/reports",
    targetSelector: '[data-tour="sidebar-reports"]',
    title: "Reports & Dossiers",
    description: "View generated reports and access detailed information about monitored activity.",
    placement: "right",
  },
  {
    id: "step-reports-generate",
    targetSelector: '[data-tour="reports-generate-btn"]',
    title: "Generate Custom Dossier",
    description: "Compile tailored PDF forensic dossiers with verified satellite evidence.",
    placement: "bottom",
    waitForElement: true,
  },
  {
    id: "step-reports-search",
    targetSelector: '[data-tour="reports-search-bar"]',
    title: "Search Dossiers",
    description: "Filter dossiers by Report ID, Event ID, or custom title.",
    placement: "bottom",
    waitForElement: true,
  },
  {
    id: "step-reports-row",
    targetSelector: '[data-tour="reports-table-row-first"]',
    title: "Dossier Record",
    description: "Inspect stored report records, anomaly severity tags, and UTC timestamps.",
    placement: "top",
    waitForElement: true,
  },
  {
    id: "step-reports-download",
    targetSelector: '[data-tour="reports-download-btn-first"]',
    title: "Download PDF Action",
    description: "Export court-admissible PDF intelligence briefs with SHA-256 integrity seals.",
    placement: "top",
    waitForElement: true,
  },

  // --- PHASE 6: ANALYTICS WALKTHROUGH ---
  {
    id: "step-analytics-intro",
    route: "/analytics",
    targetSelector: '[data-tour="sidebar-analytics"]',
    title: "National Analytics",
    description: "Understand trends and patterns through visual insights and data.",
    placement: "right",
  },
  {
    id: "step-analytics-historical",
    targetSelector: '[data-tour="analytics-historical-row"]',
    title: "Historical Progression",
    description: "Track day-by-day hotspot counts, peak radiative power (MW), and dominant anomaly categories over time.",
    placement: "bottom",
    waitForElement: true,
  },
  {
    id: "step-analytics-classification",
    targetSelector: '[data-tour="analytics-source-breakdown"]',
    title: "Source Classification Breakdown",
    description: "Analyze ground-truth interpretations categorizing thermal events into agricultural burns, wildfires, and industrial flares.",
    placement: "right",
    waitForElement: true,
  },
  {
    id: "step-analytics-territories",
    targetSelector: '[data-tour="analytics-territories-panel"]',
    title: "Territory Intelligence Console",
    description: "Inspect state-by-state hotspot distributions, peak MW intensity, and territorial risk profiles.",
    placement: "top",
    waitForElement: true,
  },

  // --- PHASE 7: END SCREEN ---
  {
    id: "step-tour-end",
    targetSelector: "",
    title: "You're all set! 🎉",
    description: "You now know your way around the platform.",
    placement: "center",
  },
];



