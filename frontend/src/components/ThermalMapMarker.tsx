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
 * Resolves (3 Classification Shapes: Industrial Factory Stack, Vegetation Sprout, Target Diamond) 
 * x (3 Severity Colors: Emerald Green, Amber/Orange, Ruby Red) + 1 Slate Neutral Insufficient deterministically.
 */
export const ThermalMapMarker: React.FC<ThermalMapMarkerProps> = ({
  classification = "OTHER_UNCERTAIN",
  anomalyTier = "NORMAL",
  isSelected = false,
  size = 32,
  onClick
}) => {
  const normTier = (anomalyTier || "NORMAL").toUpperCase();
  const normClass = (classification || "OTHER_UNCERTAIN").toUpperCase();

  // 1. Semantic Color Mapping
  const isInsufficient = normTier === "BASELINE_INSUFFICIENT";
  const isCritical = normTier === "CRITICAL";
  const isAbnormal = normTier === "ABNORMAL";
  const isElevated = normTier === "ELEVATED";

  let fillColor = "#10B981"; // Emerald Green (Nominal)
  let glowColor = "rgba(16, 185, 129, 0.45)";
  let strokeColor = "#059669";

  if (isInsufficient) {
    fillColor = "#64748B"; // Slate Neutral
    glowColor = "rgba(100, 116, 139, 0.35)";
    strokeColor = "#475569";
  } else if (isCritical) {
    fillColor = "#EF4444"; // Vivid Red (Critical)
    glowColor = "rgba(239, 68, 68, 0.6)";
    strokeColor = "#DC2626";
  } else if (isAbnormal) {
    fillColor = "#F59E0B"; // Vivid Amber/Orange (Abnormal)
    glowColor = "rgba(245, 158, 11, 0.55)";
    strokeColor = "#D97706";
  } else if (isElevated) {
    fillColor = "#FBBF24"; // Warm Gold/Amber
    glowColor = "rgba(251, 191, 36, 0.45)";
    strokeColor = "#D97706";
  }

  // 2. Base Shape Classification
  const isIndustrial = normClass.startsWith("IND_") || normClass === "INDUSTRIAL" || normClass === "REFINERY" || normClass === "POWER";
  const isAgri = (
    normClass === "AGRI_BURN" || 
    normClass === "WILDFIRE" || 
    normClass === "AGRICULTURE" || 
    normClass === "VEGETATION" ||
    normClass === "STUBBLE"
  );

  return (
    <div
      onClick={onClick}
      className={`group relative flex items-center justify-center transition-all duration-300 cursor-pointer select-none ${
        isSelected ? "scale-125 z-40" : "hover:scale-115 z-10"
      }`}
      style={{ width: size, height: size }}
      title={`${normClass} — ${normTier}`}
    >
      {/* Outer Selection / Pulse Glow Ring */}
      {isSelected ? (
        <span 
          className="absolute -inset-2.5 rounded-full animate-ping opacity-75 pointer-events-none"
          style={{ backgroundColor: glowColor }}
        />
      ) : (isCritical || isAbnormal) ? (
        <span 
          className="absolute -inset-1 rounded-full animate-pulse opacity-40 pointer-events-none"
          style={{ backgroundColor: glowColor }}
        />
      ) : null}

      {/* SVG Tactical Icon */}
      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        className="filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] transition-transform duration-200"
      >
        {isIndustrial ? (
          /* Industrial Icon: Modern Minimal Factory Stack */
          <g fill={fillColor} stroke="#FFFFFF" strokeWidth="1.6" strokeLinejoin="round">
            <path d="M4 26V16L12 20V12L20 16V6H28V26H4Z" />
            <line x1="12" y1="20" x2="12" y2="26" stroke="#FFFFFF" strokeWidth="1.2" />
            <line x1="20" y1="16" x2="20" y2="26" stroke="#FFFFFF" strokeWidth="1.2" />
            {isCritical && (
              <circle cx="24" cy="4" r="2.2" fill="#FEE2E2" stroke="#DC2626" strokeWidth="0.8" />
            )}
          </g>
        ) : isAgri ? (
          /* Agricultural / Vegetation Icon: True Sprout / Leaf */
          <g fill={fillColor} stroke="#FFFFFF" strokeWidth="1.6" strokeLinejoin="round">
            <path d="M16 28C16 28 8 22 8 14C8 8 14 4 16 4C18 4 24 8 24 14C24 22 16 28 16 28Z" />
            <path d="M16 10V22" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M16 15L11 11" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M16 18L21 14" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" />
          </g>
        ) : (
          /* Unclassified / Uncertain Icon: Diamond Crosshair Beacon */
          <g fill={fillColor} stroke="#FFFFFF" strokeWidth="1.6" strokeLinejoin="round">
            <polygon points="16,3 29,16 16,29 3,16" />
            <circle cx="16" cy="16" r="4.5" fill="#FFFFFF" />
            {isInsufficient ? (
              <line x1="12" y1="16" x2="20" y2="16" stroke="#475569" strokeWidth="1.6" strokeLinecap="round" />
            ) : (
              <circle cx="16" cy="16" r="2" fill={fillColor} />
            )}
          </g>
        )}
      </svg>
    </div>
  );
};
