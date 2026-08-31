"use client";

import React from "react";

interface ThermalMapMarkerProps {
  classification?: string;
  anomalyTier?: string;
  isSelected?: boolean;
  size?: number;
  onClick?: () => void;
}

/**
 * 9-Icon Tactical Symbology System (+1 Neutral Insufficient Treatment)
 * Resolves (3 Classification Shapes: Industrial Factory, Vegetation Sprout, Target Diamond) 
 * x (3 Severity Colors: Green, Amber, Red) + 1 Neutral Slate Insufficient deterministically.
 */
export const ThermalMapMarker: React.FC<ThermalMapMarkerProps> = ({
  classification = "OTHER_UNCERTAIN",
  anomalyTier = "NORMAL",
  isSelected = false,
  size = 28,
  onClick
}) => {
  // 1. Resolve Semantic Color Mapping
  const isInsufficient = anomalyTier === "BASELINE_INSUFFICIENT";
  const isCritical = anomalyTier === "CRITICAL";
  const isAbnormal = anomalyTier === "ABNORMAL";

  let fillColor = "#16A34A"; // Green (Nominal & Elevated default)
  let glowColor = "rgba(22, 163, 74, 0.4)";

  if (isInsufficient) {
    fillColor = "#64748B"; // Neutral Slate
    glowColor = "rgba(100, 116, 139, 0.3)";
  } else if (isCritical) {
    fillColor = "#DC2626"; // Red (Critical)
    glowColor = "rgba(220, 38, 38, 0.5)";
  } else if (isAbnormal) {
    fillColor = "#EA580C"; // Amber/Orange (Abnormal)
    glowColor = "rgba(234, 88, 12, 0.45)";
  }

  // 2. Resolve Base Shape by Classification
  const isIndustrial = classification.startsWith("IND_") || classification === "INDUSTRIAL";
  const isAgri = (
    classification === "AGRI_BURN" || 
    classification === "WILDFIRE" || 
    classification === "AGRICULTURE" || 
    classification === "VEGETATION" ||
    classification === "STUBBLE"
  );

  return (
    <button
      onClick={onClick}
      className={`group relative flex items-center justify-center transition-all duration-300 focus:outline-none ${
        isSelected ? "scale-125 z-40" : "hover:scale-115 z-10"
      }`}
      style={{ width: size, height: size }}
      title={`${classification} — ${anomalyTier}`}
    >
      {/* Outer Selection / Pulse Glow Ring */}
      {isSelected && (
        <span 
          className="absolute -inset-2 rounded-full animate-ping opacity-60 pointer-events-none"
          style={{ backgroundColor: glowColor }}
        />
      )}

      {/* SVG Icon Base */}
      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        className="filter drop-shadow-[0_2px_5px_rgba(0,0,0,0.35)] transition-colors"
      >
        {isIndustrial ? (
          /* Industrial Icon: Modern Minimal Factory Stack */
          <g fill={fillColor} stroke="#FFFFFF" strokeWidth="1.5" strokeLinejoin="round">
            <path d="M4 26V16L12 20V12L20 16V6H28V26H4Z" />
            <line x1="12" y1="20" x2="12" y2="26" stroke="#FFFFFF" strokeWidth="1" />
            <line x1="20" y1="16" x2="20" y2="26" stroke="#FFFFFF" strokeWidth="1" />
            {isCritical && (
              <circle cx="24" cy="4" r="2" fill="#FEE2E2" stroke="#DC2626" strokeWidth="0.8" />
            )}
          </g>
        ) : isAgri ? (
          /* Agricultural / Vegetation Icon: True Sprout / Leaf */
          <g fill={fillColor} stroke="#FFFFFF" strokeWidth="1.5" strokeLinejoin="round">
            <path d="M16 28C16 28 8 22 8 14C8 8 14 4 16 4C18 4 24 8 24 14C24 22 16 28 16 28Z" />
            <path d="M16 10V22" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M16 15L11 11" stroke="#FFFFFF" strokeWidth="1.3" strokeLinecap="round" />
            <path d="M16 18L21 14" stroke="#FFFFFF" strokeWidth="1.3" strokeLinecap="round" />
          </g>
        ) : (
          /* Unclassified / Uncertain Icon: Diamond Crosshair Beacon */
          <g fill={fillColor} stroke="#FFFFFF" strokeWidth="1.5" strokeLinejoin="round">
            <polygon points="16,3 29,16 16,29 3,16" />
            <circle cx="16" cy="16" r="4.5" fill="#FFFFFF" />
            {isInsufficient ? (
              <line x1="12" y1="16" x2="20" y2="16" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
            ) : (
              <circle cx="16" cy="16" r="2" fill={fillColor} />
            )}
          </g>
        )}
      </svg>
    </button>
  );
};
