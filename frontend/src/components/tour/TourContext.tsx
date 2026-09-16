"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TOUR_STEPS } from "@/config/tourSteps";
import { TargetRect, TourStep } from "@/types/tour";

export function openDemoEventPanel(eventId = "EVT-IN-MAD-0005") {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("eventId", eventId);
  window.history.pushState({}, "", url.toString());
  window.dispatchEvent(new Event("popstate"));
  window.dispatchEvent(new CustomEvent("thermo-open-event-drawer", { detail: { eventId } }));
}

export function openDemoFacilityPanel(facilityId?: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (facilityId) {
    url.searchParams.set("facilityId", facilityId);
  } else {
    url.searchParams.set("facilityId", "demo");
  }
  window.history.pushState({}, "", url.toString());
  window.dispatchEvent(new Event("popstate"));
  window.dispatchEvent(new CustomEvent("thermo-open-facility-drawer", { detail: { facilityId } }));
}

export function closeDemoPanels() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  let changed = false;
  if (url.searchParams.has("eventId")) {
    url.searchParams.delete("eventId");
    changed = true;
  }
  if (url.searchParams.has("overlay")) {
    url.searchParams.delete("overlay");
    changed = true;
  }
  if (url.searchParams.has("facilityId")) {
    url.searchParams.delete("facilityId");
    changed = true;
  }
  if (changed) {
    window.history.pushState({}, "", url.toString());
    window.dispatchEvent(new Event("popstate"));
  }
  window.dispatchEvent(new CustomEvent("thermo-close-facility-drawer"));
}

interface TourContextType {
  isActive: boolean;
  showIntroModal: boolean;
  currentStepIndex: number;
  currentStep: TourStep | null;
  totalSteps: number;
  hasSeenTour: boolean;
  targetRect: TargetRect | null;
  isWaitingForElement: boolean;
  startTour: () => void;
  startTourAtStep: (index: number) => void;
  retriggerTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  exitTour: () => void;
  skipIntro: () => void;
  proceedFromIntro: () => void;
}

const TourContext = createContext<TourContextType | null>(null);

const STORAGE_KEY = "thermo_has_seen_tour";

export function TourProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [isActive, setIsActive] = useState(false);
  const [showIntroModal, setShowIntroModal] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [hasSeenTour, setHasSeenTour] = useState(true);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [isWaitingForElement, setIsWaitingForElement] = useState(false);

  const currentStep = isActive && TOUR_STEPS[currentStepIndex] ? TOUR_STEPS[currentStepIndex] : null;

  // On mount: check localStorage for hasSeenTour
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "true") {
        setHasSeenTour(true);
      } else {
        setHasSeenTour(false);
        setShowIntroModal(true);
      }
    } catch (e) {
      setHasSeenTour(false);
    }
  }, []);

  // Update target rect with bounding rect calculation
  const updateTargetRect = useCallback(() => {
    if (!currentStep) {
      setTargetRect(null);
      return;
    }

    if (currentStep.placement === "center" || !currentStep.targetSelector) {
      setTargetRect(null);
      return;
    }

    const el = document.querySelector(currentStep.targetSelector);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    } else {
      setTargetRect(null);
    }
  }, [currentStep]);

  // Recalculate rect on window resize & scroll
  useEffect(() => {
    if (!isActive) return;

    const handleLayoutChange = () => {
      updateTargetRect();
    };

    window.addEventListener("resize", handleLayoutChange);
    window.addEventListener("scroll", handleLayoutChange, true);

    return () => {
      window.removeEventListener("resize", handleLayoutChange);
      window.removeEventListener("scroll", handleLayoutChange, true);
    };
  }, [isActive, updateTargetRect]);

  // Execute step transitions, route navigation, and actions
  useEffect(() => {
    if (!isActive || !currentStep) return;

    let isSubscribed = true;
    setIsWaitingForElement(true);
    setTargetRect(null);

    // 1. Navigation if step defines a route different from current pathname
    if (currentStep.route && pathname !== currentStep.route) {
      router.push(currentStep.route);
    }

    // 2. Execute custom step action if defined
    if (currentStep.action) {
      try {
        currentStep.action();
      } catch (err) {
        console.error("Tour step action error:", err);
      }
    }

    // 3. Poll/observe for element to mount in DOM and for route to match
    let pollCount = 0;
    const maxPolls = 60; // 3 seconds max (50ms interval)
    const pollInterval = setInterval(() => {
      if (!isSubscribed) return;
      pollCount++;

      const routeMatched = !currentStep.route || pathname === currentStep.route;
      const isCenterPlacement = currentStep.placement === "center" || !currentStep.targetSelector;
      const targetEl = currentStep.targetSelector ? document.querySelector(currentStep.targetSelector) : null;

      if ((routeMatched && (targetEl || isCenterPlacement)) || pollCount >= maxPolls) {
        clearInterval(pollInterval);
        
        if (pollCount >= maxPolls && !targetEl && !isCenterPlacement) {
          console.warn(`[Tour Engine] Target selector not found after 3s: ${currentStep.targetSelector}`);
        }

        // Auto-scroll target element into view before measuring bounding rect
        if (targetEl && !isCenterPlacement) {
          try {
            targetEl.scrollIntoView({
              behavior: "smooth",
              block: "center",
              inline: "nearest",
            });
          } catch (e) {
            console.error("[Tour Engine] scrollIntoView failed:", e);
          }
        }

        // Wait 450ms for smooth scroll animation & reflow to complete before measuring position
        setTimeout(() => {
          if (!isSubscribed) return;
          updateTargetRect();
          setIsWaitingForElement(false);
        }, 450);
      }
    }, 50);

    return () => {
      isSubscribed = false;
      clearInterval(pollInterval);
    };
  }, [isActive, currentStepIndex, currentStep, pathname, router, updateTargetRect]);

  const markTourSeen = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch (e) {}
    setHasSeenTour(true);
  };

  const startTour = useCallback(() => {
    closeDemoPanels();
    setShowIntroModal(false);
    setCurrentStepIndex(0);
    setIsActive(true);
    setIsWaitingForElement(true);
  }, []);

  const startTourAtStep = useCallback((index: number) => {
    closeDemoPanels();
    setShowIntroModal(false);
    setCurrentStepIndex(index);
    setIsActive(true);
    setIsWaitingForElement(true);
  }, []);

  const retriggerTour = useCallback(() => {
    closeDemoPanels();
    setIsActive(false);
    setCurrentStepIndex(0);
    setShowIntroModal(true);
  }, []);

  const nextStep = useCallback(() => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      const nextIdx = currentStepIndex + 1;
      // If moving past step-take-action or step-facilities-directory, close demo panels
      if (
        TOUR_STEPS[currentStepIndex]?.id === "step-take-action" ||
        TOUR_STEPS[currentStepIndex]?.id === "step-facilities-directory"
      ) {
        closeDemoPanels();
      }
      setIsWaitingForElement(true);
      setTargetRect(null);
      setCurrentStepIndex(nextIdx);
    } else {
      closeDemoPanels();
      setIsActive(false);
      markTourSeen();
    }
  }, [currentStepIndex]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      if (
        TOUR_STEPS[currentStepIndex]?.id === "step-facilities-directory" ||
        TOUR_STEPS[currentStepIndex]?.id === "step-take-action"
      ) {
        closeDemoPanels();
      }
      setIsWaitingForElement(true);
      setTargetRect(null);
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  const exitTour = useCallback(() => {
    closeDemoPanels();
    setIsActive(false);
    setShowIntroModal(false);
    markTourSeen();
  }, []);

  const skipIntro = useCallback(() => {
    setShowIntroModal(false);
    markTourSeen();
  }, []);

  const proceedFromIntro = useCallback(() => {
    startTour();
  }, [startTour]);

  return (
    <TourContext.Provider
      value={{
        isActive,
        showIntroModal,
        currentStepIndex,
        currentStep,
        totalSteps: TOUR_STEPS.length,
        hasSeenTour,
        targetRect,
        isWaitingForElement,
        startTour,
        startTourAtStep,
        retriggerTour,
        nextStep,
        prevStep,
        exitTour,
        skipIntro,
        proceedFromIntro,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error("useTour must be used within a TourProvider");
  }
  return ctx;
}
