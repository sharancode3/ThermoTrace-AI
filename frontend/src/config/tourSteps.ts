import { TourStep } from "@/types/tour";
import { openDemoEventPanel, openDemoFacilityPanel } from "@/components/tour/TourContext";

export const TOUR_STEPS: TourStep[] = [
  // --- MONITOR WORKSPACE ---
  {
    id: "step-monitor-intro",
    route: "/monitor",
    targetSelector: '[data-tour="sidebar-monitor"]',
    title: "Monitor Workspace",
    description: "Your primary workspace for live spatial surveillance and real-time thermal event tracking.",
    placement: "right",
  },
  {
    id: "step-live-map",
    targetSelector: '[data-tour="map-container"]',
    title: "Live Map",
    description: "Explore active satellite detections, thermal hotspots, and geospatial clusters across India.",
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
    id: "step-take-action",
    targetSelector: '[data-tour="take-action-cluster"]',
    title: "Take Action",
    description: "Ask AI questions about this incident, download the full report, or export the data — all from here.",
    placement: "top",
    waitForElement: true,
  },

  // --- FACILITIES REGISTRY ---
  {
    id: "step-facilities-intro",
    route: "/facilities",
    targetSelector: '[data-tour="sidebar-facilities"]',
    title: "Facilities Registry",
    description: "Access the sovereign database of registered industrial sites and refining baselines.",
    placement: "right",
  },
  {
    id: "step-facilities-directory",
    action: () => {
      openDemoFacilityPanel();
    },
    targetSelector: '[data-tour="facility-detail-drawer"]',
    title: "Facility Directory",
    description: "Browse and search registered facilities. Click any facility to view its detailed profile.",
    placement: "left",
    waitForElement: true,
  },

  // --- REPORTS & DOSSIERS ---
  {
    id: "step-reports-intro",
    route: "/reports",
    targetSelector: '[data-tour="sidebar-reports"]',
    title: "Reports & Dossiers",
    description: "Access forensic intelligence briefs and legal-grade PDF incident dossiers.",
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
    id: "step-reports-downloads",
    targetSelector: '[data-tour="reports-table-row-first"]',
    title: "Reports & Downloads",
    description: "Browse generated reports and download any of them as a PDF.",
    placement: "top",
    waitForElement: true,
  },

  // --- NATIONAL ANALYTICS ---
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

  // --- TOUR END SCREEN ---
  {
    id: "step-tour-end",
    targetSelector: "",
    title: "You're all set! 🎉",
    description: "You now know your way around the platform.",
    placement: "center",
  },
];



