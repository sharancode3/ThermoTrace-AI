"use client";

import { useFirmsPoller } from "@/hooks/useFirmsPoller";

export function GlobalFirmsPoller() {
  useFirmsPoller(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("thermo-data-refreshed"));
    }
  });
  return null;
}
