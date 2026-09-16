"use client";

import { useEffect, useState } from "react";
import { useTour } from "./TourContext";

export function TourOverlay() {
  const { isActive, targetRect, isWaitingForElement } = useTour();
  const [showSpinner, setShowSpinner] = useState(false);

  useEffect(() => {
    if (!isWaitingForElement) {
      setShowSpinner(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowSpinner(true);
    }, 700);

    return () => clearTimeout(timer);
  }, [isWaitingForElement]);

  if (!isActive) return null;

  // If waiting for element or placement is center/no rect, show clean backdrop
  if (!targetRect || isWaitingForElement) {
    return (
      <div className="fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in pointer-events-auto flex items-center justify-center">
        {isWaitingForElement && showSpinner && (
          <div className="flex items-center gap-2.5 px-4 py-2 bg-slate-900/90 border border-slate-700/70 rounded-xl text-white text-xs font-bold shadow-2xl animate-pulse font-mono">
            <div className="w-3.5 h-3.5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <span>Loading workspace view...</span>
          </div>
        )}
      </div>
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
