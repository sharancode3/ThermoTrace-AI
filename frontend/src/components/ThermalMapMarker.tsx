"use client";

import React from "react";

interface ThermalMapMarkerProps {
  classification?: string;
  anomalyTier?: string;
  isSelected?: boolean;
  size?: number;
  peakFrp?: number;
  maxBrightnessK?: number;
  isCooled?: boolean;
  onClick?: () => void;
}

/**
 * Sovereign Tactical Symbology System
 * Distinct Icons:
 * - WILDFIRE: Pine / Forest Tree Silhouette surrounded by Wildfire Flame tongues (Vivid Flame Ember)
 * - AGRI_BURN: Curved Golden Agricultural Crop Stalk / Harvest Stubble
 * - IND_FIRE: Emergency Fire Flame / Incident Beacon (Vivid Crimson)
 * - IND_FLARE: Industrial Flare Stack with tip flame (Vivid Orange)
 * - IND_ROUTINE: Factory Complex with Twin Stacks (Industrial Cyan / Slate)
 * - OTHER_UNCERTAIN: Radar Diamond Crosshair (Neutral Slate)
 */
export const ThermalMapMarker: React.FC<ThermalMapMarkerProps> = ({
  classification = "OTHER_UNCERTAIN",
  anomalyTier = "NORMAL",
  isSelected = false,
  size = 32,
  peakFrp = 0,
  maxBrightnessK = 0,
  isCooled = false,
  onClick
}) => {
  const normTier = (anomalyTier || "NORMAL").toUpperCase();
  const normClass = (classification || "OTHER_UNCERTAIN").toUpperCase();

  const isWildfire = normClass === "WILDFIRE" || normClass === "FOREST_FIRE";
  const isAgri = normClass === "AGRI_BURN" || normClass === "AGRICULTURE" || normClass === "STUBBLE";
  const isIndustry = normClass.startsWith("IND_") || normClass === "INDUSTRIAL" || normClass === "INDUSTRY";

  // Level evaluation taking into account Anomaly Tier, FRP heat radiance, and Temperature
  const isCritical = normTier === "CRITICAL" || normClass === "IND_FIRE" || peakFrp >= 50.0 || maxBrightnessK >= 365.0;
  const isAbnormal = !isCritical && (normTier === "ABNORMAL" || normTier === "ELEVATED" || normClass === "IND_FLARE" || peakFrp >= 15.0 || maxBrightnessK >= 340.0);

  let fillColor = "#10B981";
  let glowColor = "rgba(16, 185, 129, 0.45)";
  let strokeColor = "#059669";

  if (isIndustry) {
    // 1. INDUSTRY: 3 Colors according to critical severity / heat level
    if (isCritical) {
      fillColor = "#DC2626"; // Level 1: Red (Emergency Fire / Critical Anomaly)
      glowColor = "rgba(220, 38, 38, 0.65)";
      strokeColor = "#991B1B";
    } else if (isAbnormal) {
      fillColor = "#EA580C"; // Level 2: Amber-Orange (Elevated Flare / Abnormal Radiance)
      glowColor = "rgba(234, 88, 12, 0.55)";
      strokeColor = "#C2410C";
    } else {
      fillColor = "#EAB308"; // Level 3: Industrial Yellow (Nominal Routine Process)
      glowColor = "rgba(234, 179, 8, 0.45)";
      strokeColor = "#A16207";
    }
  } else if (isWildfire) {
    // 2. WILDFIRE: Colors according to severity / heat
    if (isCritical) {
      fillColor = "#DC2626"; // Critical Forest Blaze
      glowColor = "rgba(220, 38, 38, 0.65)";
      strokeColor = "#991B1B";
    } else if (isAbnormal) {
      fillColor = "#EA580C"; // Elevated Wildfire
      glowColor = "rgba(234, 88, 12, 0.55)";
      strokeColor = "#C2410C";
    } else {
      fillColor = "#D97706"; // Early Stage Wildfire
      glowColor = "rgba(217, 119, 6, 0.45)";
      strokeColor = "#B45309";
    }
  } else if (isAgri) {
    // 3. AGRICULTURE: Colors according to critical level / heat
    if (isCritical) {
      fillColor = "#EF4444"; // Severe Crop Stubble Fire
      glowColor = "rgba(239, 68, 68, 0.60)";
      strokeColor = "#DC2626";
    } else if (isAbnormal) {
      fillColor = "#F59E0B"; // Elevated Crop Residue Fire
      glowColor = "rgba(245, 158, 11, 0.50)";
      strokeColor = "#D97706";
    } else {
      fillColor = "#10B981"; // Nominal Crop Residue
      glowColor = "rgba(16, 185, 129, 0.45)";
      strokeColor = "#059669";
    }
  } else {
    // 4. UNCERTAIN: Neutral Slate Grey
    fillColor = "#64748B";
    glowColor = "rgba(100, 116, 139, 0.35)";
    strokeColor = "#475569";
  }

  // Intense thermal radiance glow for high FRP / hot temperatures
  const isHighThermal = (peakFrp >= 50.0 || maxBrightnessK >= 350.0);

  return (
    <div
      onClick={onClick}
      className={`group relative flex items-center justify-center transition-all duration-300 cursor-pointer select-none ${
        isCooled ? "opacity-40 hover:opacity-100" : ""
      } ${
        isSelected ? "scale-125 z-40" : "hover:scale-115 z-10"
      }`}
      style={{ width: size, height: size }}
      title={`${normClass} — ${normTier} (${peakFrp.toFixed(1)} MW)`}
    >
      {/* Outer Selection / Pulse Glow Ring */}
      {isSelected ? (
        <span 
          className="absolute -inset-2.5 rounded-full animate-ping opacity-75 pointer-events-none"
          style={{ backgroundColor: glowColor }}
        />
      ) : (isCritical || isAbnormal || isHighThermal) ? (
        <span 
          className="absolute -inset-1 rounded-full animate-pulse opacity-45 pointer-events-none"
          style={{ backgroundColor: glowColor }}
        />
      ) : null}

      {/* SVG Tactical 4-Icon System */}
      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        className="filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] transition-transform duration-200"
      >
        {isIndustry ? (
          /* 1. INDUSTRY: Modern Factory Twin Stacks (3 severity colors: Red, Orange, Yellow) */
          <g fill={fillColor} stroke="#FFFFFF" strokeWidth="1.6" strokeLinejoin="round">
            <path d="M4 26V16L12 20V12L20 16V6H28V26H4Z" />
            <line x1="12" y1="20" x2="12" y2="26" stroke="#FFFFFF" strokeWidth="1.2" />
            <line x1="20" y1="16" x2="20" y2="26" stroke="#FFFFFF" strokeWidth="1.2" />
          </g>
        ) : isWildfire ? (
          /* 2. FOREST WILDFIRE: Pine Tree + Fire Overlay */
          <g fill={fillColor} stroke="#FFFFFF" strokeWidth="1.5" strokeLinejoin="round">
            <path d="M16 4L9 13H12L7 20H13V27H19V20H25L20 13H23L16 4Z" />
            <path
              d="M16 11C18 14 18 16 16.5 19C19 18 20.5 15 19.5 13"
              stroke="#FEF08A"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="16" cy="18" r="1.8" fill="#FEF08A" stroke="none" />
          </g>
        ) : isAgri ? (
          /* 3. AGRICULTURAL CROP RESIDUE: Curved Wheat Ear / Crop Stalk */
          <g fill={fillColor} stroke="#FFFFFF" strokeWidth="1.5" strokeLinejoin="round">
            <path d="M16 28C16 28 8 22 8 14C8 8 14 4 16 4C18 4 24 8 24 14C24 22 16 28 16 28Z" />
            <path d="M16 10V22" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M16 14L11 10" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M16 18L21 14" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" />
          </g>
        ) : (
          /* 4. OTHER / UNCERTAIN: Tactical Radar Diamond Crosshair */
          <g fill={fillColor} stroke="#FFFFFF" strokeWidth="1.6" strokeLinejoin="round">
            <polygon points="16,3 29,16 16,29 3,16" />
            <circle cx="16" cy="16" r="4" fill="#FFFFFF" />
            <circle cx="16" cy="16" r="1.8" fill={fillColor} />
          </g>
        )}
      </svg>
    </div>
  );
};
