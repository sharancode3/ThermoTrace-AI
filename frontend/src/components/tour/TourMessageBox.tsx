"use client";

import { useTour } from "./TourContext";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";

export function TourMessageBox() {
  const {
    isActive,
    currentStep,
    currentStepIndex,
    totalSteps,
    targetRect,
    isWaitingForElement,
    nextStep,
    prevStep,
    exitTour,
  } = useTour();

  const [positionStyle, setPositionStyle] = useState<React.CSSProperties>({});

  // Compute position relative to targetRect with auto-flipping logic
  useEffect(() => {
    if (!isActive || !currentStep) return;

    if (currentStep.placement === "center" || !targetRect) {
      setPositionStyle({
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      });
      return;
    }

    const margin = 16;
    const boxWidth = 340;
    const boxHeight = 180;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let placement = currentStep.placement;
    let top = 0;
    let left = 0;

    // Auto-flip placement if overflowing viewport
    if (placement === "right" && targetRect.left + targetRect.width + margin + boxWidth > viewportWidth) {
      placement = "left";
    } else if (placement === "left" && targetRect.left - margin - boxWidth < 0) {
      placement = "right";
    } else if (placement === "bottom" && targetRect.top + targetRect.height + margin + boxHeight > viewportHeight) {
      placement = "top";
    } else if (placement === "top" && targetRect.top - margin - boxHeight < 0) {
      placement = "bottom";
    }

    if (placement === "right") {
      top = targetRect.top + targetRect.height / 2 - boxHeight / 2;
      left = targetRect.left + targetRect.width + margin;
    } else if (placement === "left") {
      top = targetRect.top + targetRect.height / 2 - boxHeight / 2;
      left = targetRect.left - boxWidth - margin;
    } else if (placement === "bottom") {
      top = targetRect.top + targetRect.height + margin;
      left = targetRect.left + targetRect.width / 2 - boxWidth / 2;
    } else if (placement === "top") {
      top = targetRect.top - boxHeight - margin;
      left = targetRect.left + targetRect.width / 2 - boxWidth / 2;
    }

    // Keep within screen edges
    top = Math.max(16, Math.min(top, viewportHeight - boxHeight - 16));
    left = Math.max(16, Math.min(left, viewportWidth - boxWidth - 16));

    setPositionStyle({
      top: `${top}px`,
      left: `${left}px`,
    });
  }, [isActive, currentStep, targetRect]);

  if (!isActive || !currentStep || isWaitingForElement) return null;

  const isLastStep = currentStepIndex === totalSteps - 1;
  const isCentered = currentStep.placement === "center";

  return (
    <>
      {/* DESKTOP CARD VIEW (md and up) */}
      <div
        style={positionStyle}
        className={`hidden md:flex fixed z-[90] ${
          isCentered ? "w-[380px] p-6 text-center" : "w-[340px] p-5"
        } bg-white border border-slate-200 rounded-2xl shadow-2xl flex-col text-slate-900 transition-all duration-300 ease-out animate-in zoom-in-95 duration-200`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between gap-2 mb-2">
          {!isLastStep ? (
            <div className="flex items-center gap-1.5 text-xs font-bold text-orange-600 uppercase tracking-wider font-mono">
              <span>Step {currentStepIndex + 1} of {totalSteps}</span>
            </div>
          ) : (
            <div />
          )}
          <button
            onClick={exitTour}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer ml-auto"
            title="Exit Tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <h4 className={`text-sm font-bold text-slate-900 leading-tight mb-1.5 ${isCentered ? "text-base font-extrabold" : ""}`}>
          {currentStep.title}
        </h4>
        <p className={`text-xs text-slate-600 leading-relaxed mb-4 flex-1 ${isCentered ? "text-sm text-slate-600" : ""}`}>
          {currentStep.description}
        </p>

        {/* Controls */}
        {isLastStep ? (
          <div className="pt-2">
            <button
              type="button"
              onClick={nextStep}
              className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl shadow-md shadow-orange-600/20 transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>Good to go</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1">
              {Array.from({ length: totalSteps }).map((_, idx) => (
                <span
                  key={`dot-${idx}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentStepIndex
                      ? "w-4 bg-orange-600"
                      : "w-1.5 bg-slate-200"
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              {currentStepIndex > 0 && (
                <button
                  type="button"
                  onClick={prevStep}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                  title="Previous step"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={nextStep}
                className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl shadow-md shadow-orange-600/20 transition cursor-pointer flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MOBILE VIEW (< md) */}
      {isCentered ? (
        /* Mobile Centered Card for Center/End Steps */
        <div className="flex md:hidden fixed inset-0 z-[90] items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 text-center text-slate-900 animate-in zoom-in-95 duration-200">
            <div className="flex justify-end mb-1">
              <button
                onClick={exitTour}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                title="Exit Tour"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <h4 className="text-base font-extrabold text-slate-900 leading-tight mb-2">
              {currentStep.title}
            </h4>
            <p className="text-sm text-slate-600 leading-relaxed mb-5">
              {currentStep.description}
            </p>
            <button
              type="button"
              onClick={nextStep}
              className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl shadow-md shadow-orange-600/20 transition cursor-pointer flex items-center justify-center"
            >
              <span>{isLastStep ? "Good to go" : "Next"}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Mobile Bottom Sheet View for Targeted Steps */
        <div className="flex md:hidden fixed bottom-0 left-0 right-0 z-[90] bg-white border-t border-slate-200 rounded-t-2xl shadow-2xl p-5 flex-col text-slate-900 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-orange-600 uppercase tracking-wider font-mono">
              <span>Step {currentStepIndex + 1} of {totalSteps}</span>
            </div>
            <button
              onClick={exitTour}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              title="Exit Tour"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <h4 className="text-sm font-bold text-slate-900 leading-tight mb-1">
            {currentStep.title}
          </h4>
          <p className="text-xs text-slate-600 leading-relaxed mb-4">
            {currentStep.description}
          </p>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1">
              {Array.from({ length: totalSteps }).map((_, idx) => (
                <span
                  key={`mob-dot-${idx}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentStepIndex
                      ? "w-4 bg-orange-600"
                      : "w-1.5 bg-slate-200"
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {currentStepIndex > 0 && (
                <button
                  type="button"
                  onClick={prevStep}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={nextStep}
                className="px-4 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl shadow-md shadow-orange-600/20 transition flex items-center gap-1"
              >
                <span>{isLastStep ? "Good to go" : "Next"}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

