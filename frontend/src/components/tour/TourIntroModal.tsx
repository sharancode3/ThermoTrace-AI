"use client";

import { useTour } from "./TourContext";
import { Sparkles, X } from "lucide-react";

export function TourIntroModal() {
  const { showIntroModal, proceedFromIntro, skipIntro } = useTour();

  if (!showIntroModal) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 text-slate-900 space-y-4 animate-in zoom-in-95 duration-200">
        <button
          onClick={skipIntro}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          title="Close intro modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="p-3 bg-orange-100 border border-orange-200 rounded-xl text-orange-600 shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 leading-tight">
              Want a quick tour?
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              ThermoTrace Sovereign Thermal Intelligence
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed">
          We'll show you how the platform works — takes about a minute.
        </p>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={skipIntro}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={proceedFromIntro}
            className="px-5 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 rounded-xl shadow-md shadow-orange-600/20 transition cursor-pointer flex items-center gap-1.5"
          >
            <span>Proceed</span>
            <span>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
