"use client";

import { useFirmsPoller } from "@/hooks/useFirmsPoller";

export function GlobalFirmsPoller() {
  useFirmsPoller();
  return null;
}
