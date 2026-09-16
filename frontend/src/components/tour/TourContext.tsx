"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TOUR_STEPS } from "@/config/tourSteps";
import { TargetRect, TourStep } from "@/types/tour";
import { fetchNationalAnalytics, fetchFacilities, fetchReports } from "@/lib/apiClient";

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

  const prewarmTourPages = useCallback(() => {
    try {
      // Prefetch Next.js route JS bundles
      router.prefetch("/monitor");
      router.prefetch("/facilities");
      router.prefetch("/reports");
      router.prefetch("/analytics");

      // Pre-fetch and cache API datasets in background
      fetchNationalAnalytics("ALL").catch(() => {});
      fetchFacilities().catch(() => {});
      fetchReports().catch(() => {});
    } catch (e) {
      // ignore
    }
  }, [router]);

  // On mount: check localStorage for hasSeenTour & prewarm if new user
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "true") {
        setHasSeenTour(true);
      } else {
        setHasSeenTour(false);
        setShowIntroModal(true);
        prewarmTourPages();
      }
    } catch (e) {
      setHasSeenTour(false);
    }
  }, [prewarmTourPages]);

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

    // Determine if next step is on the same page/route as current pathname
    const isSameRoute = !currentStep.route || pathname === currentStep.route;

    // 1. Navigation if step defines a route different from current pathname
    if (currentStep.route && pathname !== currentStep.route) {
      setIsWaitingForElement(true);
      setTargetRect(null);
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

    // 3. Poll/observe for target element to mount in DOM and position rect
    let pollCount = 0;
    const maxPolls = 60; // 3 seconds max (50ms interval)

    const tryPositionElement = () => {
      if (!isSubscribed) return false;

      const routeMatched = !currentStep.route || pathname === currentStep.route;
      const isCenterPlacement = currentStep.placement === "center" || !currentStep.targetSelector;
      const targetEl = currentStep.targetSelector ? document.querySelector(currentStep.targetSelector) : null;

      if (routeMatched && (targetEl || isCenterPlacement)) {
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

        if (isSameRoute) {
          // SAME PAGE: Immediate snappy calculation with 0 artificial wait
          updateTargetRect();
          setIsWaitingForElement(false);
        } else {
          // CROSS PAGE: Brief 250ms wait for layout reflow on newly mounted page
          setTimeout(() => {
            if (!isSubscribed) return;
            updateTargetRect();
            setIsWaitingForElement(false);
          }, 250);
        }

        return true;
      }
      return false;
    };

    // Attempt immediate positioning for same-page steps
    const immediateSuccess = tryPositionElement();
    if (immediateSuccess && isSameRoute) {
      return () => {
        isSubscribed = false;
      };
    }

    // Otherwise poll until element is available
    const pollInterval = setInterval(() => {
      if (!isSubscribed) return;
      pollCount++;
      const done = tryPositionElement();
      if (done || pollCount >= maxPolls) {
        clearInterval(pollInterval);
        if (!done) {
          setIsWaitingForElement(false);
        }
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
    prewarmTourPages();
    setShowIntroModal(false);
    setCurrentStepIndex(0);
    setIsActive(true);
    setIsWaitingForElement(false);
  }, [prewarmTourPages]);

  const startTourAtStep = useCallback((index: number) => {
    closeDemoPanels();
    prewarmTourPages();
    setShowIntroModal(false);
    setCurrentStepIndex(index);
    setIsActive(true);
    setIsWaitingForElement(false);
  }, [prewarmTourPages]);

  const retriggerTour = useCallback(() => {
    closeDemoPanels();
    prewarmTourPages();
    setIsActive(false);
    setCurrentStepIndex(0);
    setShowIntroModal(true);
  }, [prewarmTourPages]);

  const nextStep = useCallback(() => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      const nextIdx = currentStepIndex + 1;
      const currentStepObj = TOUR_STEPS[currentStepIndex];
      const nextStepObj = TOUR_STEPS[nextIdx];

      if (
        currentStepObj?.id === "step-take-action" ||
        currentStepObj?.id === "step-facilities-directory"
      ) {
        closeDemoPanels();
      }

      const isSameRoute = !nextStepObj?.route || nextStepObj.route === (currentStepObj?.route || pathname);

      if (!isSameRoute) {
        setIsWaitingForElement(true);
        setTargetRect(null);
      }

      setCurrentStepIndex(nextIdx);
    } else {
      closeDemoPanels();
      setIsActive(false);
      markTourSeen();
    }
  }, [currentStepIndex, pathname]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      const prevIdx = currentStepIndex - 1;
      const currentStepObj = TOUR_STEPS[currentStepIndex];
      const prevStepObj = TOUR_STEPS[prevIdx];

      if (
        currentStepObj?.id === "step-facilities-directory" ||
        currentStepObj?.id === "step-take-action"
      ) {
        closeDemoPanels();
      }

      const isSameRoute = !prevStepObj?.route || prevStepObj.route === (currentStepObj?.route || pathname);

      if (!isSameRoute) {
        setIsWaitingForElement(true);
        setTargetRect(null);
      }

      setCurrentStepIndex(prevIdx);
    }
  }, [currentStepIndex, pathname]);

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
