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

  // Authoritative severity level: Critical (Red), Abnormal (Orange), Normal (Yellow for industry)
  const isCritical = normTier === "CRITICAL" || normClass === "IND_FIRE";
  const isAbnormal = !isCritical && (normTier === "ABNORMAL" || normClass === "IND_FLARE");
  const isNormal = !isCritical && !isAbnormal;

  let fillColor = "#10B981";
  let glowColor = "rgba(16, 185, 129, 0.45)";
  let strokeColor = "#059669";

  if (isIndustry) {
    // 1. INDUSTRY: Normal = Yellow, Flare = Orange, Fire/Critical = Red
    if (normClass === "IND_FIRE" || normTier === "CRITICAL") {
      fillColor = isCooled ? "#FECACA" : "#EF4444"; // Red (Emergency Fire / Critical Anomaly)
      glowColor = isCooled ? "rgba(239, 68, 68, 0.15)" : "rgba(239, 68, 68, 0.65)";
      strokeColor = isCooled ? "#DC2626" : "#B91C1C";
    } else if (normClass === "IND_FLARE" || normTier === "ABNORMAL") {
      fillColor = isCooled ? "#FED7AA" : "#F97316"; // Orange (Elevated Flare / Gas Flaring)
      glowColor = isCooled ? "rgba(249, 115, 22, 0.15)" : "rgba(249, 115, 22, 0.60)";
      strokeColor = isCooled ? "#EA580C" : "#C2410C";
    } else {
      fillColor = isCooled ? "#FEF08A" : "#FACC15"; // Yellow (Nominal Routine Industrial Process)
      glowColor = isCooled ? "rgba(250, 204, 21, 0.15)" : "rgba(250, 204, 21, 0.55)";
      strokeColor = isCooled ? "#CA8A04" : "#854D0E";
    }
  } else if (isWildfire) {
    // 2. WILDFIRE: Forest Teal
    if (normTier === "CRITICAL") {
      fillColor = isCooled ? "#FECACA" : "#EF4444";
      glowColor = isCooled ? "rgba(239, 68, 68, 0.15)" : "rgba(239, 68, 68, 0.65)";
      strokeColor = isCooled ? "#DC2626" : "#B91C1C";
    } else {
      fillColor = isCooled ? "#99F6E4" : "#0D9488"; // Forest Teal
      glowColor = isCooled ? "rgba(13, 148, 136, 0.15)" : "rgba(13, 148, 136, 0.45)";
      strokeColor = isCooled ? "#0D9488" : "#042F2E";
    }
  } else if (isAgri) {
    // 3. AGRICULTURE: Emerald Green
    if (normTier === "CRITICAL") {
      fillColor = isCooled ? "#FECACA" : "#EF4444";
      glowColor = isCooled ? "rgba(239, 68, 68, 0.15)" : "rgba(239, 68, 68, 0.60)";
      strokeColor = isCooled ? "#DC2626" : "#B91C1C";
    } else {
      fillColor = isCooled ? "#A7F3D0" : "#10B981"; // Emerald Green
      glowColor = isCooled ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.45)";
      strokeColor = isCooled ? "#059669" : "#047857";
    }
  } else {
    // 4. UNCERTAIN: Neutral Slate Grey
    fillColor = isCooled ? "#CBD5E1" : "#64748B";
    glowColor = isCooled ? "rgba(100, 116, 139, 0.15)" : "rgba(100, 116, 139, 0.35)";
    strokeColor = isCooled ? "#64748B" : "#334155";
  }

  // Intense thermal radiance glow for high FRP / hot temperatures (only when active)
  const isHighThermal = !isCooled && (peakFrp >= 50.0 || maxBrightnessK >= 350.0);

  return (
    <div
      onClick={onClick}
      className={`group relative flex items-center justify-center transition-all duration-300 cursor-pointer select-none ${
        isCooled ? "opacity-60 hover:opacity-100 grayscale-[20%]" : ""
      } ${
        isSelected ? "scale-125 z-40" : "hover:scale-115 z-10"
      }`}
      style={{ width: size, height: size }}
      title={`${normClass} — ${normTier}${isCooled ? " (Cooled)" : ""} (${peakFrp.toFixed(1)} MW)`}
    >
      {/* Outer Selection / Pulse Glow Ring */}
      {isSelected ? (
        <span 
          className="absolute -inset-2.5 rounded-full animate-ping opacity-75 pointer-events-none"
          style={{ backgroundColor: glowColor }}
        />
      ) : (!isCooled && (isCritical || isAbnormal || isHighThermal)) ? (
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
        className={`filter transition-transform duration-200 ${
          isCooled 
            ? "drop-shadow-[0_1px_4px_rgba(0,0,0,0.25)]" 
            : "drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]"
        }`}
      >
        {isIndustry ? (
          /* 1. INDUSTRY: Modern Factory Twin Stacks (Normal: Yellow, Abnormal: Orange, Critical: Red, Cooled: Faded) */
          <g 
            fill={fillColor} 
            stroke={isCooled ? strokeColor : "#FFFFFF"} 
            strokeWidth={isCooled ? "1.2" : "1.6"} 
            strokeDasharray={isCooled ? "3,1.5" : undefined}
            strokeLinejoin="round"
          >
            <path d="M4 26V16L12 20V12L20 16V6H28V26H4Z" />
            <line x1="12" y1="20" x2="12" y2="26" stroke={isCooled ? strokeColor : "#FFFFFF"} strokeWidth={isCooled ? "1.0" : "1.2"} />
            <line x1="20" y1="16" x2="20" y2="26" stroke={isCooled ? strokeColor : "#FFFFFF"} strokeWidth={isCooled ? "1.0" : "1.2"} />
          </g>
        ) : isWildfire ? (
          /* 2. FOREST WILDFIRE: Pine Tree + Fire Overlay */
          <g 
            fill={fillColor} 
            stroke={isCooled ? strokeColor : "#FFFFFF"} 
            strokeWidth={isCooled ? "1.2" : "1.5"} 
            strokeDasharray={isCooled ? "3,1.5" : undefined}
            strokeLinejoin="round"
          >
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
          <g 
            fill={fillColor} 
            stroke={isCooled ? strokeColor : "#FFFFFF"} 
            strokeWidth={isCooled ? "1.2" : "1.5"} 
            strokeDasharray={isCooled ? "3,1.5" : undefined}
            strokeLinejoin="round"
          >
            <path d="M16 28C16 28 8 22 8 14C8 8 14 4 16 4C18 4 24 8 24 14C24 22 16 28 16 28Z" />
            <path d="M16 10V22" stroke={isCooled ? strokeColor : "#FFFFFF"} strokeWidth="1.6" strokeLinecap="round" />
            <path d="M16 14L11 10" stroke={isCooled ? strokeColor : "#FFFFFF"} strokeWidth="1.4" strokeLinecap="round" />
            <path d="M16 18L21 14" stroke={isCooled ? strokeColor : "#FFFFFF"} strokeWidth="1.4" strokeLinecap="round" />
          </g>
        ) : (
          /* 4. OTHER / UNCERTAIN: Tactical Radar Diamond Crosshair */
          <g 
            fill={fillColor} 
            stroke={isCooled ? strokeColor : "#FFFFFF"} 
            strokeWidth={isCooled ? "1.2" : "1.6"} 
            strokeDasharray={isCooled ? "3,1.5" : undefined}
            strokeLinejoin="round"
          >
            <polygon points="16,3 29,16 16,29 3,16" />
            <circle cx="16" cy="16" r="4" fill="#FFFFFF" />
            <circle cx="16" cy="16" r="1.8" fill={fillColor} />
          </g>
        )}
      </svg>
    </div>
  );
};
