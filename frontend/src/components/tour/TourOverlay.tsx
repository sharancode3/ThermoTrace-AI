"use client";

import { useTour } from "./TourContext";

export function TourOverlay() {
  const { isActive, targetRect, isWaitingForElement } = useTour();

  if (!isActive) return null;

  // If waiting for element or placement is center/no rect, show clean backdrop
  if (!targetRect || isWaitingForElement) {
    return (
      <div className="fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in pointer-events-auto" />
    );
  }

  // Padding around highlighted element
  const padding = 6;
  const top = Math.max(0, targetRect.top - padding);
  const left = Math.max(0, targetRect.left - padding);
  const width = targetRect.width + padding * 2;
  const height = targetRect.height + padding * 2;

  return (
    <div className="fixed inset-0 z-[80] pointer-events-none overflow-hidden animate-in fade-in duration-200">
      {/* Spotlight highlight box with box-shadow cutout */}
      <div
        className="absolute rounded-xl transition-all duration-300 ease-out border-2 border-orange-500/80 shadow-[0_0_0_9999px_rgba(2,6,23,0.65)] pointer-events-none"
        style={{
          top: `${top}px`,
          left: `${left}px`,
          width: `${width}px`,
          height: `${height}px`,
        }}
      />
    </div>
  );
}
